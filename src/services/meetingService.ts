import { supabase } from '../lib/supabase';

export interface MeetingSession {
  id: string;
  community_id: string;
  session_date: string;
  start_time: string;
  end_time?: string;
  status: 'scheduled' | 'active' | 'completed' | 'cancelled';
  meeting_url?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  was_reported: boolean;
}

export interface MeetingAttendance {
  id: string;
  meeting_session_id: string;
  user_id: string;
  community_id: string;
  joined_at?: string;
  left_at?: string;
  duration_seconds: number;
  screen_shared: boolean;
  participation_score: number;
  created_at: string;
}

export interface MeetingParticipant {
  id: string;
  meeting_session_id: string;
  user_id: string;
  community_id: string;
  joined_at: string;
  left_at?: string;
  is_active: boolean;
  stream_type: 'camera' | 'screen' | 'audio_only';
  peer_id?: string;
  connection_quality: 'good' | 'fair' | 'poor';
  last_seen: string;
  created_at: string;
}

export interface MeetingStatistics {
  totalMeetings: number;
  totalDuration: number;
  averageDuration: number;
  screenSharePercentage: number;
}

class MeetingService {
  private autoEndTimers: Map<string, NodeJS.Timeout> = new Map();

  // Start a new meeting session with enhanced error handling
  async startMeeting(communityId: string, userId: string): Promise<{ success: boolean; meetingSession?: MeetingSession; error?: string }> {
    try {
      // Check if there's already an active meeting for this community
      const { data: existingMeetings, error: checkError } = await supabase
        .from('meeting_sessions')
        .select('*')
        .eq('community_id', communityId)
        .eq('status', 'active')
        .limit(1);

      if (checkError) {
        return { success: false, error: checkError.message };
      }

      if (existingMeetings && existingMeetings.length > 0) {
        return { success: true, meetingSession: existingMeetings[0] };
      }

      // Verify user is a member of the community
      const { data: membership } = await supabase
        .from('community_members')
        .select('id')
        .eq('community_id', communityId)
        .eq('user_id', userId)
        .single();

      if (!membership) {
        return { success: false, error: 'You must be a member of this community to start meetings' };
      }

      // Create new meeting session
      const { data: meetingSession, error } = await supabase
        .from('meeting_sessions')
        .insert({
          community_id: communityId,
          session_date: new Date().toISOString().split('T')[0],
          start_time: new Date().toISOString(),
          status: 'active',
          was_reported: false
        })
        .select()
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      // Send notification to community members
      await this.sendMeetingNotification(communityId, 'meeting_started', 'A new meeting has started!');
      
      // Start auto-end timer (2 minutes)
      this.startAutoEndTimer(meetingSession.id, communityId);

      return { success: true, meetingSession };
    } catch (error) {
      console.error('Error starting meeting:', error);
      return { success: false, error: 'An unexpected error occurred while starting the meeting' };
    }
  }

  // Start auto-end timer for empty meetings
  private startAutoEndTimer(meetingId: string, communityId: string): void {
    // Clear any existing timer for this meeting
    if (this.autoEndTimers.has(meetingId)) {
      clearTimeout(this.autoEndTimers.get(meetingId)!);
    }
    
    // Set new timer (2 minutes = 120000 ms)
    const timer = setTimeout(async () => {
      // Check if meeting is still active and has no participants
      const { data: participants } = await supabase
        .from('meeting_participants')
        .select('id')
        .eq('meeting_session_id', meetingId)
        .eq('is_active', true);
      
      if (!participants || participants.length === 0) {
        // End the meeting automatically
        await this.endMeeting(meetingId, 'system');
        console.log(`Meeting ${meetingId} automatically ended due to inactivity`);
      }
      
      // Remove the timer reference
      this.autoEndTimers.delete(meetingId);
    }, 120000);
    
    // Store the timer reference
    this.autoEndTimers.set(meetingId, timer);
  }

  // Reset auto-end timer when a participant joins
  private resetAutoEndTimer(meetingId: string, communityId: string): void {
    // Only reset if timer exists (meeting is at risk of auto-ending)
    if (this.autoEndTimers.has(meetingId)) {
      this.startAutoEndTimer(meetingId, communityId);
    }
  }

  // Join an existing meeting with participant tracking
  async joinMeeting(meetingSessionId: string, userId: string, communityId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Verify meeting exists and is active
      const { data: meeting } = await supabase
        .from('meeting_sessions')
        .select('status')
        .eq('id', meetingSessionId)
        .single();

      if (!meeting || meeting.status !== 'active') {
        return { success: false, error: 'Meeting is not active or does not exist' };
      }

      // Verify user is a member of the community
      const { data: membership } = await supabase
        .from('community_members')
        .select('id')
        .eq('community_id', communityId)
        .eq('user_id', userId)
        .single();

      if (!membership) {
        return { success: false, error: 'You must be a member of this community to join meetings' };
      }

      // Check if participant already exists and is active
      const { data: existingParticipant } = await supabase
        .from('meeting_participants')
        .select('id, is_active')
        .eq('meeting_session_id', meetingSessionId)
        .eq('user_id', userId)
        .eq('is_active', true)
        .single();

      if (existingParticipant) {
        // User is already an active participant
        return { success: true };
      }

      // First, mark any existing inactive participants as inactive (cleanup)
      await supabase
        .from('meeting_participants')
        .update({ is_active: false })
        .eq('meeting_session_id', meetingSessionId)
        .eq('user_id', userId)
        .eq('is_active', false);

      // Add new participant record
      const { error: participantError } = await supabase
        .from('meeting_participants')
        .insert({
          meeting_session_id: meetingSessionId,
          user_id: userId,
          community_id: communityId,
          is_active: true,
          stream_type: 'camera',
          connection_quality: 'good',
          last_seen: new Date().toISOString()
        });

      if (participantError) {
        return { success: false, error: participantError.message };
      }

      // Record attendance - use upsert here since attendance table has proper unique constraint
      const { error: attendanceError } = await supabase
        .from('meeting_attendance')
        .upsert({
          meeting_session_id: meetingSessionId,
          user_id: userId,
          community_id: communityId,
          joined_at: new Date().toISOString(),
          screen_shared: false,
          participation_score: 0.5
        }, {
          onConflict: 'meeting_session_id,user_id'
        });

      if (attendanceError) {
        console.error('Error recording attendance:', attendanceError);
      }
      
      // Reset auto-end timer since a participant joined
      this.resetAutoEndTimer(meetingSessionId, communityId);

      return { success: true };
    } catch (error) {
      console.error('Error joining meeting:', error);
      return { success: false, error: 'An unexpected error occurred while joining the meeting' };
    }
  }

  // Leave a meeting with comprehensive cleanup
  async leaveMeeting(meetingSessionId: string, userId: string, durationSeconds: number, screenShared: boolean): Promise<{ success: boolean; error?: string }> {
    try {
      const now = new Date().toISOString();

      // Update participant status
      const { error: participantError } = await supabase
        .from('meeting_participants')
        .update({
          is_active: false,
          left_at: now
        })
        .eq('meeting_session_id', meetingSessionId)
        .eq('user_id', userId);

      if (participantError) {
        console.error('Error updating participant status:', participantError);
      }

      // Update attendance record
      const { error: attendanceError } = await supabase
        .from('meeting_attendance')
        .update({
          left_at: now,
          duration_seconds: durationSeconds,
          screen_shared: screenShared,
          participation_score: screenShared ? 1.0 : 0.8
        })
        .eq('meeting_session_id', meetingSessionId)
        .eq('user_id', userId)
        .is('left_at', null);

      if (attendanceError) {
        console.error('Error updating attendance:', attendanceError);
      }

      // Update member's total meeting seconds
      await this.updateMemberMeetingTime(meetingSessionId, userId, durationSeconds);
      
      // Check if this was the last participant and start auto-end timer if so
      const { data: activeParticipants } = await supabase
        .from('meeting_participants')
        .select('id')
        .eq('meeting_session_id', meetingSessionId)
        .eq('is_active', true);
      
      if (!activeParticipants || activeParticipants.length === 0) {
        // Get community ID for the meeting
        const { data: meeting } = await supabase
          .from('meeting_sessions')
          .select('community_id')
          .eq('id', meetingSessionId)
          .single();
        
        if (meeting) {
          // Start auto-end timer since no participants are left
          this.startAutoEndTimer(meetingSessionId, meeting.community_id);
        }
      }

      return { success: true };
    } catch (error) {
      console.error('Error leaving meeting:', error);
      return { success: false, error: 'An unexpected error occurred while leaving the meeting' };
    }
  }

  // End a meeting (host only) with proper cleanup
  async endMeeting(meetingSessionId: string, userId: string | 'system'): Promise<{ success: boolean; error?: string }> {
    try {
      const now = new Date().toISOString();

      // Update meeting session status
      const { error: sessionError } = await supabase
        .from('meeting_sessions')
        .update({
          end_time: now,
          status: 'completed'
        })
        .eq('id', meetingSessionId);

      if (sessionError) {
        return { success: false, error: sessionError.message };
      }

      // Mark all participants as inactive
      const { error: participantsError } = await supabase
        .from('meeting_participants')
        .update({
          is_active: false,
          left_at: now
        })
        .eq('meeting_session_id', meetingSessionId)
        .eq('is_active', true);

      if (participantsError) {
        console.error('Error updating participants:', participantsError);
      }

      // Update all active attendances
      const { error: attendanceError } = await supabase
        .from('meeting_attendance')
        .update({
          left_at: now
        })
        .eq('meeting_session_id', meetingSessionId)
        .is('left_at', null);

      if (attendanceError) {
        console.error('Error updating attendances:', attendanceError);
      }

      // Get community ID for notification
      const { data: meeting } = await supabase
        .from('meeting_sessions')
        .select('community_id')
        .eq('id', meetingSessionId)
        .single();

      if (meeting) {
        await this.sendMeetingNotification(
          meeting.community_id, 
          'meeting_ended', 
          userId === 'system' 
            ? 'Meeting has automatically ended due to inactivity' 
            : 'Meeting has been ended'
        );
      }
      
      // Clear any auto-end timer for this meeting
      if (this.autoEndTimers.has(meetingSessionId)) {
        clearTimeout(this.autoEndTimers.get(meetingSessionId)!);
        this.autoEndTimers.delete(meetingSessionId);
      }

      return { success: true };
    } catch (error) {
      console.error('Error ending meeting:', error);
      return { success: false, error: 'An unexpected error occurred while ending the meeting' };
    }
  }

  // Check if user can end meeting (only if they're the only participant)
  async canEndMeeting(meetingSessionId: string, userId: string): Promise<boolean> {
    try {
      const { data: activeParticipants } = await supabase
        .from('meeting_participants')
        .select('user_id')
        .eq('meeting_session_id', meetingSessionId)
        .eq('is_active', true);
      
      // User can end meeting if they're the only participant
      return activeParticipants?.length === 1 && activeParticipants[0].user_id === userId;
    } catch (error) {
      console.error('Error checking if user can end meeting:', error);
      return false;
    }
  }

  // Get active meeting for a community
  async getActiveMeeting(communityId: string): Promise<{ success: boolean; meetingSession?: MeetingSession; error?: string }> {
    try {
      const { data: meetingSessions, error } = await supabase
        .from('meeting_sessions')
        .select('*')
        .eq('community_id', communityId)
        .eq('status', 'active')
        .order('start_time', { ascending: false })
        .limit(1);

      if (error) {
        return { success: false, error: error.message };
      }

      const meetingSession = meetingSessions && meetingSessions.length > 0 ? meetingSessions[0] : undefined;
      return { success: true, meetingSession };
    } catch (error) {
      console.error('Error getting active meeting:', error);
      return { success: false, error: 'An unexpected error occurred while checking for active meetings' };
    }
  }

  // Get meeting participants with real-time data
  async getMeetingParticipants(meetingSessionId: string): Promise<{ success: boolean; participants?: MeetingParticipant[]; error?: string }> {
    try {
      const { data: participants, error } = await supabase
        .from('meeting_participants')
        .select('*')
        .eq('meeting_session_id', meetingSessionId)
        .eq('is_active', true)
        .order('joined_at', { ascending: true });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, participants: participants || [] };
    } catch (error) {
      console.error('Error getting meeting participants:', error);
      return { success: false, error: 'An unexpected error occurred while fetching participants' };
    }
  }

  // Update participant connection status
  async updateParticipantStatus(
    meetingSessionId: string, 
    userId: string, 
    updates: {
      streamType?: 'camera' | 'screen' | 'audio_only';
      connectionQuality?: 'good' | 'fair' | 'poor';
      peerId?: string;
    }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const updateData: any = {
        last_seen: new Date().toISOString()
      };

      if (updates.streamType) updateData.stream_type = updates.streamType;
      if (updates.connectionQuality) updateData.connection_quality = updates.connectionQuality;
      if (updates.peerId) updateData.peer_id = updates.peerId;

      const { error } = await supabase
        .from('meeting_participants')
        .update(updateData)
        .eq('meeting_session_id', meetingSessionId)
        .eq('user_id', userId)
        .eq('is_active', true);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error('Error updating participant status:', error);
      return { success: false, error: 'An unexpected error occurred while updating participant status' };
    }
  }

  // Send meeting chat message
  async sendChatMessage(meetingSessionId: string, userId: string, message: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('meeting_chat')
        .insert({
          meeting_session_id: meetingSessionId,
          user_id: userId,
          message: message.trim(),
          message_type: 'text'
        });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error('Error sending chat message:', error);
      return { success: false, error: 'An unexpected error occurred while sending message' };
    }
  }

  // Get meeting chat history
  async getChatHistory(meetingSessionId: string): Promise<{ success: boolean; messages?: any[]; error?: string }> {
    try {
      const { data: messages, error } = await supabase
        .from('meeting_chat')
        .select('*')
        .eq('meeting_session_id', meetingSessionId)
        .order('created_at', { ascending: true });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, messages: messages || [] };
    } catch (error) {
      console.error('Error getting chat history:', error);
      return { success: false, error: 'An unexpected error occurred while fetching chat history' };
    }
  }

  // Update member's total meeting time
  private async updateMemberMeetingTime(meetingSessionId: string, userId: string, durationSeconds: number): Promise<void> {
    try {
      // Get community ID from meeting session
      const { data: meetingSession } = await supabase
        .from('meeting_sessions')
        .select('community_id')
        .eq('id', meetingSessionId)
        .single();

      if (!meetingSession) return;

      // Update community member's total meeting seconds
      const { data: currentMember } = await supabase
        .from('community_members')
        .select('total_meeting_seconds')
        .eq('community_id', meetingSession.community_id)
        .eq('user_id', userId)
        .single();

      if (currentMember) {
        const newTotal = (currentMember.total_meeting_seconds || 0) + durationSeconds;
        
        await supabase
          .from('community_members')
          .update({ total_meeting_seconds: newTotal })
          .eq('community_id', meetingSession.community_id)
          .eq('user_id', userId);
      }
    } catch (error) {
      console.error('Error updating member meeting time:', error);
    }
  }

  // Send meeting notification
  private async sendMeetingNotification(communityId: string, type: string, message: string): Promise<void> {
    try {
      await supabase.rpc('send_meeting_notification', {
        p_community_id: communityId,
        p_notification_type: type,
        p_message: message
      });
    } catch (error) {
      console.error('Error sending meeting notification:', error);
    }
  }

  // Get meeting history for a community
  async getMeetingHistory(communityId: string): Promise<{ success: boolean; meetings?: MeetingSession[]; error?: string }> {
    try {
      const { data: meetings, error } = await supabase
        .from('meeting_sessions')
        .select('*')
        .eq('community_id', communityId)
        .order('start_time', { ascending: false });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, meetings: meetings || [] };
    } catch (error) {
      console.error('Error getting meeting history:', error);
      return { success: false, error: 'An unexpected error occurred while fetching meeting history' };
    }
  }

  // Get user's meeting statistics
  async getUserMeetingStats(userId: string, communityId?: string): Promise<{ 
    success: boolean; 
    stats?: MeetingStatistics; 
    error?: string 
  }> {
    try {
      const { data, error } = await supabase.rpc('get_meeting_statistics', {
        p_community_id: communityId || null,
        p_user_id: userId
      });

      if (error) {
        return { success: false, error: error.message };
      }

      const stats = data && data.length > 0 ? data[0] : {
        total_meetings: 0,
        total_duration_seconds: 0,
        average_duration_seconds: 0,
        screen_share_percentage: 0
      };

      return {
        success: true,
        stats: {
          totalMeetings: stats.total_meetings || 0,
          totalDuration: stats.total_duration_seconds || 0,
          averageDuration: stats.average_duration_seconds || 0,
          screenSharePercentage: stats.screen_share_percentage || 0
        }
      };
    } catch (error) {
      console.error('Error getting meeting statistics:', error);
      return { success: false, error: 'An unexpected error occurred while fetching meeting statistics' };
    }
  }

  // Mark meeting as reported
  async markMeetingAsReported(meetingSessionId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('meeting_sessions')
        .update({ was_reported: true })
        .eq('id', meetingSessionId);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error('Error marking meeting as reported:', error);
      return { success: false, error: 'An unexpected error occurred' };
    }
  }

  // Get meeting recording URL
  async getMeetingRecordingUrl(meetingSessionId: string): Promise<{ success: boolean; url?: string; error?: string }> {
    try {
      // Get recording file path
      const { data: recording, error } = await supabase
        .from('meeting_recordings')
        .select('file_path')
        .eq('meeting_session_id', meetingSessionId)
        .eq('upload_status', 'completed')
        .single();

      if (error) {
        return { success: false, error: 'Recording not found' };
      }

      // Generate signed URL
      const { data, error: urlError } = await supabase.storage
        .from('meeting-recordings')
        .createSignedUrl(recording.file_path, 3600); // 1 hour expiry

      if (urlError) {
        return { success: false, error: 'Failed to generate recording URL' };
      }

      return { success: true, url: data.signedUrl };
    } catch (error) {
      console.error('Error getting recording URL:', error);
      return { success: false, error: 'An unexpected error occurred' };
    }
  }

  // Update participant heartbeat (for connection monitoring)
  async updateParticipantHeartbeat(meetingSessionId: string, userId: string): Promise<void> {
    try {
      await supabase.rpc('update_participant_last_seen', {
        p_meeting_session_id: meetingSessionId,
        p_user_id: userId
      });
    } catch (error) {
      console.error('Error updating participant heartbeat:', error);
    }
  }

  // Delete meeting recording
  async deleteMeetingRecording(filePath: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('meeting-recordings')
        .remove([filePath]);
      
      if (storageError) {
        return { success: false, error: storageError.message };
      }
      
      // Update database record
      const { error: dbError } = await supabase
        .from('meeting_recordings')
        .update({ upload_status: 'deleted' })
        .eq('file_path', filePath);
      
      if (dbError) {
        console.error('Error updating recording status:', dbError);
      }
      
      return { success: true };
    } catch (error) {
      console.error('Error deleting recording:', error);
      return { success: false, error: 'An unexpected error occurred while deleting recording' };
    }
  }
}

export default new MeetingService();