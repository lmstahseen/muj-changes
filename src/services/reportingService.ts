import { supabase } from '../lib/supabase';
import meetingService from './meetingService';

export interface Report {
  id: string;
  community_id: string;
  meeting_session_id?: string;
  reporter_id: string;
  reported_member_id: string;
  violation_type: 'not_working' | 'wrong_task' | 'inappropriate_behavior' | 'other';
  description: string;
  evidence_url?: string;
  status: 'pending' | 'voting' | 'resolved_disqualify' | 'resolved_no_action' | 'resolved_false_report';
  resolution_reason?: string;
  created_at: string;
  updated_at?: string;
  resolved_at?: string;
  vote_counts?: {
    disqualify?: number;
    no_action?: number;
    false_report?: number;
  };
  total_eligible_voters?: number;
  was_reported?: boolean;
}

export interface ReportVote {
  id: string;
  report_id: string;
  voter_id: string;
  community_id: string;
  vote_type: 'disqualify' | 'no_action' | 'false_report';
  reasoning?: string;
  created_at: string;
}

export interface MeetingRecording {
  id: string;
  meeting_session_id: string;
  file_path: string;
  file_size: number;
  duration_seconds: number;
  upload_status: 'uploading' | 'completed' | 'failed' | 'pending_deletion' | 'deleted';
  retention_policy?: 'standard' | 'extended' | 'permanent';
  created_at: string;
  updated_at: string;
}

export interface MemberPenalty {
  id: string;
  community_id: string;
  member_id: string;
  report_id?: string;
  penalty_type: 'warning' | 'stake_forfeit' | 'disqualification' | 'ban';
  penalty_amount: number;
  description: string;
  is_active: boolean;
  applied_at: string;
  expires_at?: string;
}

export interface ReportAnalytics {
  total_reports: number;
  pending_reports: number;
  resolved_reports: number;
  false_reports: number;
  disqualified_members: number;
  average_resolution_hours: number;
}

class ReportingService {
  // Create a new member report
  async createReport(data: {
    communityId: string;
    meetingSessionId?: string;
    reporterId: string;
    reportedMemberId: string;
    violationType: Report['violation_type'];
    description: string;
    evidenceUrl?: string;
  }): Promise<{ success: boolean; reportId?: string; error?: string }> {
    try {
      // Validate input
      if (!data.description.trim()) {
        return { success: false, error: 'Description is required' };
      }

      if (data.description.length > 1000) {
        return { success: false, error: 'Description too long (max 1000 characters)' };
      }

      if (data.reporterId === data.reportedMemberId) {
        return { success: false, error: 'Cannot report yourself' };
      }

      // Insert report
      const { data: report, error } = await supabase
        .from('reports')
        .insert({
          community_id: data.communityId,
          meeting_session_id: data.meetingSessionId,
          reporter_id: data.reporterId,
          reported_member_id: data.reportedMemberId,
          violation_type: data.violationType,
          description: data.description.trim(),
          evidence_url: data.evidenceUrl,
          status: 'pending',
          was_reported: false
        })
        .select()
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      // Mark meeting as reported
      if (data.meetingSessionId) {
        await meetingService.markMeetingAsReported(data.meetingSessionId);
      }

      // Create moderation log
      await supabase
        .from('moderation_logs')
        .insert({
          community_id: data.communityId,
          moderator_id: data.reporterId,
          action_type: 'report_created',
          target_member_id: data.reportedMemberId,
          report_id: report.id,
          details: {
            violation_type: data.violationType,
            meeting_session_id: data.meetingSessionId
          }
        });

      // Notify community members about the report
      await this.notifyCommunityAboutReport(data.communityId, report.id, data.reportedMemberId);

      return { success: true, reportId: report.id };
    } catch (error) {
      console.error('Error creating report:', error);
      return { success: false, error: 'An unexpected error occurred while creating the report' };
    }
  }

  // Notify community members about a new report
  private async notifyCommunityAboutReport(communityId: string, reportId: string, reportedMemberId: string): Promise<void> {
    try {
      // Get all community members except the reported member
      const { data: members } = await supabase
        .from('community_members')
        .select('user_id')
        .eq('community_id', communityId)
        .neq('user_id', reportedMemberId);

      if (!members || members.length === 0) return;

      // Create notifications for all eligible voters
      const notifications = members.map(member => ({
        user_id: member.user_id,
        community_id: communityId,
        notification_type: 'community_update',
        title: 'New Report Requires Your Vote',
        content: 'A community member has been reported. Please review and cast your vote.',
        is_read: false
      }));

      await supabase
        .from('chat_notifications')
        .insert(notifications);
    } catch (error) {
      console.error('Error notifying about report:', error);
    }
  }

  // Cast a vote on a report
  async castVote(data: {
    reportId: string;
    voterId: string;
    voteType: ReportVote['vote_type'];
    reasoning?: string;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      if (data.reasoning && data.reasoning.length > 500) {
        return { success: false, error: 'Reasoning too long (max 500 characters)' };
      }

      // Get report and community info
      const { data: report, error: reportError } = await supabase
        .from('reports')
        .select('community_id, reported_member_id, status')
        .eq('id', data.reportId)
        .single();

      if (reportError || !report) {
        return { success: false, error: 'Report not found' };
      }

      if (report.status !== 'pending') {
        return { success: false, error: 'This report has already been resolved' };
      }

      // Insert vote
      const { error } = await supabase
        .from('report_votes')
        .insert({
          report_id: data.reportId,
          voter_id: data.voterId,
          community_id: report.community_id,
          vote_type: data.voteType,
          reasoning: data.reasoning?.trim()
        });

      if (error) {
        if (error.code === '23505') { // Unique violation
          return { success: false, error: 'You have already voted on this report' };
        }
        return { success: false, error: error.message };
      }

      // Create moderation log
      await supabase
        .from('moderation_logs')
        .insert({
          community_id: report.community_id,
          moderator_id: data.voterId,
          action_type: 'vote_cast',
          target_member_id: report.reported_member_id,
          report_id: data.reportId,
          details: {
            vote_type: data.voteType,
            reasoning: data.reasoning
          }
        });

      // Check if we have enough votes to resolve the report
      await this.checkReportResolution(data.reportId);

      return { success: true };
    } catch (error) {
      console.error('Error casting vote:', error);
      return { success: false, error: 'An unexpected error occurred while casting vote' };
    }
  }

  // Check if a report has enough votes to be resolved
  private async checkReportResolution(reportId: string): Promise<void> {
    try {
      // Get report details
      const { data: report } = await supabase
        .from('reports')
        .select('community_id, reported_member_id, reporter_id')
        .eq('id', reportId)
        .single();

      if (!report) return;

      // Get community member count (for eligible voters)
      const { count: totalMembers } = await supabase
        .from('community_members')
        .select('*', { count: 'exact', head: true })
        .eq('community_id', report.community_id);

      // Get vote counts
      const { data: votes } = await supabase
        .from('report_votes')
        .select('vote_type')
        .eq('report_id', reportId);

      if (!votes || votes.length === 0) return;

      // Calculate vote percentages
      const voteCounts = {
        disqualify: votes.filter(v => v.vote_type === 'disqualify').length,
        no_action: votes.filter(v => v.vote_type === 'no_action').length,
        false_report: votes.filter(v => v.vote_type === 'false_report').length
      };

      const totalVotes = votes.length;
      const votingThreshold = Math.max(3, Math.ceil((totalMembers || 0) * 0.5)); // At least 3 votes or 50% of members

      // Check if we have enough votes
      if (totalVotes >= votingThreshold) {
        // Determine outcome based on majority vote
        let resolution: Report['status'] = 'pending';
        let resolutionReason = '';

        if (voteCounts.disqualify > voteCounts.no_action && voteCounts.disqualify > voteCounts.false_report) {
          resolution = 'resolved_disqualify';
          resolutionReason = `Member disqualified based on community vote (${voteCounts.disqualify}/${totalVotes} votes)`;
          
          // Apply penalty to reported member
          await this.applyMemberPenalty(report.community_id, report.reported_member_id, reportId, 'disqualification');
        } 
        else if (voteCounts.false_report > voteCounts.no_action && voteCounts.false_report > voteCounts.disqualify) {
          resolution = 'resolved_false_report';
          resolutionReason = `Report deemed false based on community vote (${voteCounts.false_report}/${totalVotes} votes)`;
          
          // Apply penalty to reporter for false report
          await this.applyMemberPenalty(report.community_id, report.reporter_id, reportId, 'warning');
        } 
        else {
          resolution = 'resolved_no_action';
          resolutionReason = `No action taken based on community vote (${voteCounts.no_action}/${totalVotes} votes)`;
        }

        // Update report status
        await supabase
          .from('reports')
          .update({
            status: resolution,
            resolution_reason: resolutionReason,
            resolved_at: new Date().toISOString()
          })
          .eq('id', reportId);

        // Create moderation log
        await supabase
          .from('moderation_logs')
          .insert({
            community_id: report.community_id,
            moderator_id: '00000000-0000-0000-0000-000000000000', // System
            action_type: 'report_resolved',
            target_member_id: report.reported_member_id,
            report_id: reportId,
            details: {
              resolution,
              vote_counts: voteCounts,
              total_votes: totalVotes,
              resolution_reason: resolutionReason
            }
          });

        // Notify members about resolution
        await this.notifyReportResolution(report.community_id, reportId, resolution);
      }
    } catch (error) {
      console.error('Error checking report resolution:', error);
    }
  }

  // Apply penalty to member based on report outcome
  private async applyMemberPenalty(
    communityId: string,
    memberId: string,
    reportId: string,
    penaltyType: MemberPenalty['penalty_type']
  ): Promise<void> {
    try {
      // Get community stake amount
      const { data: community } = await supabase
        .from('communities')
        .select('stake_amount')
        .eq('id', communityId)
        .single();

      if (!community) return;

      // Calculate penalty amount based on type
      let penaltyAmount = 0;
      let description = '';

      switch (penaltyType) {
        case 'disqualification':
          penaltyAmount = community.stake_amount; // Full stake amount
          description = 'Disqualified from community due to violation';
          
          // Mark member as disqualified
          await supabase
            .from('community_members')
            .update({ is_disqualified: true })
            .eq('community_id', communityId)
            .eq('user_id', memberId);
          break;
        
        case 'warning':
          penaltyAmount = 0; // No financial penalty for warning
          description = 'Warning for submitting a false report';
          break;
          
        case 'stake_forfeit':
          penaltyAmount = Math.round(community.stake_amount * 0.5); // 50% of stake
          description = 'Partial stake forfeited due to violation';
          break;
          
        case 'ban':
          penaltyAmount = community.stake_amount; // Full stake amount
          description = 'Banned from community due to severe violation';
          
          // Mark member as disqualified
          await supabase
            .from('community_members')
            .update({ is_disqualified: true })
            .eq('community_id', communityId)
            .eq('user_id', memberId);
          break;
      }

      // Record penalty
      await supabase
        .from('member_penalties')
        .insert({
          community_id: communityId,
          member_id: memberId,
          report_id: reportId,
          penalty_type: penaltyType,
          penalty_amount: penaltyAmount,
          description,
          is_active: true,
          applied_at: new Date().toISOString()
        });

      // If there's a financial penalty, record it
      if (penaltyAmount > 0) {
        await supabase
          .from('earnings')
          .insert({
            user_id: memberId,
            community_id: communityId,
            amount: -penaltyAmount, // Negative amount for penalty
            type: 'forfeit',
            description,
            metadata: { report_id: reportId, penalty_type: penaltyType }
          });
      }

      // Create moderation log
      await supabase
        .from('moderation_logs')
        .insert({
          community_id: communityId,
          moderator_id: '00000000-0000-0000-0000-000000000000', // System
          action_type: 'penalty_applied',
          target_member_id: memberId,
          report_id: reportId,
          details: {
            penalty_type: penaltyType,
            penalty_amount: penaltyAmount,
            description
          }
        });
    } catch (error) {
      console.error('Error applying member penalty:', error);
    }
  }

  // Notify community members about report resolution
  private async notifyReportResolution(communityId: string, reportId: string, resolution: Report['status']): Promise<void> {
    try {
      // Get report details
      const { data: report } = await supabase
        .from('reports')
        .select('reported_member_id, reporter_id')
        .eq('id', reportId)
        .single();

      if (!report) return;

      // Create notification for reported member
      if (resolution === 'resolved_disqualify') {
        await supabase
          .from('chat_notifications')
          .insert({
            user_id: report.reported_member_id,
            community_id: communityId,
            notification_type: 'community_update',
            title: 'You Have Been Disqualified',
            content: 'The community has voted to disqualify you based on a report. Your stake has been forfeited.',
            is_read: false
          });
      } else if (resolution === 'resolved_no_action') {
        await supabase
          .from('chat_notifications')
          .insert({
            user_id: report.reported_member_id,
            community_id: communityId,
            notification_type: 'community_update',
            title: 'Report Resolved: No Action',
            content: 'A report against you has been resolved with no action taken.',
            is_read: false
          });
      }

      // Create notification for reporter
      if (resolution === 'resolved_false_report') {
        await supabase
          .from('chat_notifications')
          .insert({
            user_id: report.reporter_id,
            community_id: communityId,
            notification_type: 'community_update',
            title: 'False Report Warning',
            content: 'Your report has been deemed false by the community. Please ensure all reports are legitimate.',
            is_read: false
          });
      } else {
        await supabase
          .from('chat_notifications')
          .insert({
            user_id: report.reporter_id,
            community_id: communityId,
            notification_type: 'community_update',
            title: 'Report Resolution',
            content: `Your report has been resolved. The community has voted to ${resolution.replace('resolved_', '').replace('_', ' ')}.`,
            is_read: false
          });
      }
    } catch (error) {
      console.error('Error notifying about report resolution:', error);
    }
  }

  // Get reports for a community
  async getCommunityReports(
    communityId: string,
    statusFilter?: Report['status'],
    limit: number = 50,
    offset: number = 0
  ): Promise<{ success: boolean; reports?: Report[]; error?: string }> {
    try {
      let query = supabase
        .from('reports')
        .select(`
          *,
          meeting_sessions (id, start_time, end_time)
        `)
        .eq('community_id', communityId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (statusFilter) {
        query = query.eq('status', statusFilter);
      }

      const { data: reports, error } = await query;

      if (error) {
        return { success: false, error: error.message };
      }

      // Enhance reports with vote counts and total eligible voters
      const enhancedReports = await Promise.all((reports || []).map(async (report) => {
        // Get vote counts
        const { data: votes } = await supabase
          .from('report_votes')
          .select('vote_type')
          .eq('report_id', report.id);

        // Get total eligible voters (all community members except reported member and reporter)
        const { count: totalEligibleVoters } = await supabase
          .from('community_members')
          .select('*', { count: 'exact', head: true })
          .eq('community_id', communityId)
          .not('user_id', 'in', `(${report.reported_member_id},${report.reporter_id})`);

        const voteCounts = {
          disqualify: votes?.filter(v => v.vote_type === 'disqualify').length || 0,
          no_action: votes?.filter(v => v.vote_type === 'no_action').length || 0,
          false_report: votes?.filter(v => v.vote_type === 'false_report').length || 0
        };

        return {
          ...report,
          vote_counts: voteCounts,
          total_eligible_voters: totalEligibleVoters || 0
        };
      }));

      return { success: true, reports: enhancedReports };
    } catch (error) {
      console.error('Error getting community reports:', error);
      return { success: false, error: 'An unexpected error occurred while fetching reports' };
    }
  }

  // Get report by ID
  async getReportById(reportId: string): Promise<{ success: boolean; report?: Report; error?: string }> {
    try {
      const { data: report, error } = await supabase
        .from('reports')
        .select(`
          *,
          meeting_sessions (id, start_time, end_time)
        `)
        .eq('id', reportId)
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, report };
    } catch (error) {
      console.error('Error getting report:', error);
      return { success: false, error: 'An unexpected error occurred while fetching report' };
    }
  }

  // Get votes for a report
  async getReportVotes(reportId: string): Promise<{ success: boolean; votes?: ReportVote[]; error?: string }> {
    try {
      const { data: votes, error } = await supabase
        .from('report_votes')
        .select('*')
        .eq('report_id', reportId)
        .order('created_at', { ascending: true });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, votes: votes || [] };
    } catch (error) {
      console.error('Error getting report votes:', error);
      return { success: false, error: 'An unexpected error occurred while fetching votes' };
    }
  }

  // Check if user has voted on a report
  async hasUserVoted(reportId: string, userId: string): Promise<{ success: boolean; hasVoted?: boolean; vote?: ReportVote; error?: string }> {
    try {
      const { data: vote, error } = await supabase
        .from('report_votes')
        .select('*')
        .eq('report_id', reportId)
        .eq('voter_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
        return { success: false, error: error.message };
      }

      return { success: true, hasVoted: !!vote, vote };
    } catch (error) {
      console.error('Error checking user vote:', error);
      return { success: false, error: 'An unexpected error occurred while checking vote status' };
    }
  }

  // Get meeting recording
  async getMeetingRecording(meetingSessionId: string): Promise<{ success: boolean; recording?: MeetingRecording; error?: string }> {
    try {
      const { data: recording, error } = await supabase
        .from('meeting_recordings')
        .select('*')
        .eq('meeting_session_id', meetingSessionId)
        .eq('upload_status', 'completed')
        .single();

      if (error && error.code !== 'PGRST116') {
        return { success: false, error: error.message };
      }

      return { success: true, recording };
    } catch (error) {
      console.error('Error getting meeting recording:', error);
      return { success: false, error: 'An unexpected error occurred while fetching recording' };
    }
  }

  // Generate signed URL for recording access
  async getRecordingUrl(filePath: string, expiresIn: number = 3600): Promise<{ success: boolean; url?: string; error?: string }> {
    try {
      const { data, error } = await supabase.storage
        .from('meeting-recordings')
        .createSignedUrl(filePath, expiresIn);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, url: data.signedUrl };
    } catch (error) {
      console.error('Error generating recording URL:', error);
      return { success: false, error: 'An unexpected error occurred while generating recording URL' };
    }
  }

  // Get member penalties
  async getMemberPenalties(
    communityId: string,
    memberId?: string,
    activeOnly: boolean = true
  ): Promise<{ success: boolean; penalties?: MemberPenalty[]; error?: string }> {
    try {
      let query = supabase
        .from('member_penalties')
        .select('*')
        .eq('community_id', communityId)
        .order('applied_at', { ascending: false });

      if (memberId) {
        query = query.eq('member_id', memberId);
      }

      if (activeOnly) {
        query = query.eq('is_active', true);
      }

      const { data: penalties, error } = await query;

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, penalties: penalties || [] };
    } catch (error) {
      console.error('Error getting member penalties:', error);
      return { success: false, error: 'An unexpected error occurred while fetching penalties' };
    }
  }

  // Get report analytics
  async getReportAnalytics(
    communityId: string,
    days: number = 30
  ): Promise<{ success: boolean; analytics?: ReportAnalytics; error?: string }> {
    try {
      // Get report counts
      const { data: reports } = await supabase
        .from('reports')
        .select('id, status, created_at, resolved_at')
        .eq('community_id', communityId)
        .gte('created_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString());

      if (!reports) {
        return { success: false, error: 'No reports found' };
      }

      // Calculate analytics
      const totalReports = reports.length;
      const pendingReports = reports.filter(r => r.status === 'pending').length;
      const resolvedReports = reports.filter(r => r.status.startsWith('resolved_')).length;
      const falseReports = reports.filter(r => r.status === 'resolved_false_report').length;
      
      // Get disqualified members
      const { data: penalties } = await supabase
        .from('member_penalties')
        .select('id')
        .eq('community_id', communityId)
        .eq('penalty_type', 'disqualification')
        .gte('applied_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString());
      
      const disqualifiedMembers = penalties?.length || 0;
      
      // Calculate average resolution time
      let totalResolutionTimeHours = 0;
      let resolvedCount = 0;
      
      reports.forEach(report => {
        if (report.status.startsWith('resolved_') && report.resolved_at) {
          const createdAt = new Date(report.created_at).getTime();
          const resolvedAt = new Date(report.resolved_at).getTime();
          const resolutionTimeHours = (resolvedAt - createdAt) / (1000 * 60 * 60);
          
          totalResolutionTimeHours += resolutionTimeHours;
          resolvedCount++;
        }
      });
      
      const averageResolutionTimeHours = resolvedCount > 0 
        ? totalResolutionTimeHours / resolvedCount 
        : 0;

      const analytics: ReportAnalytics = {
        total_reports: totalReports,
        pending_reports: pendingReports,
        resolved_reports: resolvedReports,
        false_reports: falseReports,
        disqualified_members: disqualifiedMembers,
        average_resolution_hours: parseFloat(averageResolutionTimeHours.toFixed(2))
      };

      return { success: true, analytics };
    } catch (error) {
      console.error('Error getting report analytics:', error);
      return { success: false, error: 'An unexpected error occurred while fetching analytics' };
    }
  }

  // Subscribe to real-time report updates
  subscribeToReports(
    communityId: string,
    callbacks: {
      onReportCreated?: (report: Report) => void;
      onVoteCast?: (vote: ReportVote) => void;
      onReportResolved?: (report: Report) => void;
    }
  ): () => void {
    const channel = supabase.channel(`reports_${communityId}`, {
      config: {
        broadcast: { self: true }
      }
    });

    // Listen for new reports
    if (callbacks.onReportCreated) {
      channel.on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'reports',
          filter: `community_id=eq.${communityId}`
        },
        (payload) => {
          callbacks.onReportCreated?.(payload.new as Report);
        }
      );
    }

    // Listen for new votes
    if (callbacks.onVoteCast) {
      channel.on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'report_votes',
          filter: `community_id=eq.${communityId}`
        },
        (payload) => {
          callbacks.onVoteCast?.(payload.new as ReportVote);
        }
      );
    }

    // Listen for report resolutions
    if (callbacks.onReportResolved) {
      channel.on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'reports',
          filter: `community_id=eq.${communityId}`
        },
        (payload) => {
          if (payload.new.status.startsWith('resolved_')) {
            callbacks.onReportResolved?.(payload.new as Report);
          }
        }
      );
    }

    channel.subscribe();

    return () => {
      channel.unsubscribe();
    };
  }
}

export default new ReportingService();