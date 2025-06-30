import { supabase, Community, CommunityMember, CreateCommunityData, Earning, isDemoMode } from '../lib/supabase';

// Extended interfaces for new functionality
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

export interface MemberProgress {
  id: string;
  community_id: string;
  user_id: string;
  date: string;
  hours_logged: number;
  meetings_attended: number;
  goals_completed: number;
  daily_goal_met: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface CommunityAnalytics {
  id: string;
  community_id: string;
  date: string;
  total_members: number;
  active_members: number;
  total_meetings_held: number;
  average_attendance_rate: number;
  total_hours_logged: number;
  completion_rate: number;
  created_at: string;
}

export interface CommunityReward {
  id: string;
  community_id: string;
  total_stake_pool: number;
  winner_count: number;
  reward_per_winner: number;
  distribution_date?: string;
  status: 'pending' | 'calculated' | 'distributed';
  created_at: string;
}

class CommunityService {
  // Ensure user profile exists before creating community
  private async ensureUserProfile(userId: string, userEmail?: string, userName?: string): Promise<{ success: boolean; error?: string }> {
    try {
      // If running in demo mode, bypass Supabase profile operations
      if (isDemoMode) {
        return { success: true };
      }

      // Check if profile already exists
      const { data: existingProfile, error: checkError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .limit(1);

      if (checkError) {
        console.error('Error checking profile:', checkError);
        return { success: false, error: 'Failed to check user profile' };
      }

      // If profile exists, we're good
      if (existingProfile && existingProfile.length > 0) {
        return { success: true };
      }

      // Create profile if it doesn't exist
      const { error: insertError } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          email: userEmail || 'user@example.com',
          name: userName || 'User',
          avatar_url: null
        });

      if (insertError) {
        console.error('Error creating profile:', insertError);
        return { success: false, error: 'Failed to create user profile' };
      }

      return { success: true };
    } catch (error) {
      console.error('Unexpected error ensuring user profile:', error);
      return { success: false, error: 'An unexpected error occurred while setting up user profile' };
    }
  }

  // Create a new community with comprehensive validation
  async createCommunity(data: CreateCommunityData, creatorId: string): Promise<{ success: boolean; community?: Community; error?: string }> {
    try {
      // Validate input data
      const validationError = this.validateCommunityData(data);
      if (validationError) {
        return { success: false, error: validationError };
      }

      // Ensure user profile exists first
      const profileResult = await this.ensureUserProfile(creatorId);
      if (!profileResult.success) {
        return { success: false, error: profileResult.error };
      }

      // Convert stake amount to cents
      const stakeAmountCents = Math.round(data.stake_amount * 100);
      
      // Insert community
      const { data: community, error: communityError } = await supabase
        .from('communities')
        .insert({
          title: data.title.trim(),
          goal: data.goal.trim(),
          stake_amount: stakeAmountCents,
          start_date: data.start_date,
          end_date: data.end_date,
          category: data.category,
          max_members: data.max_members,
          weekly_meeting_days: data.weekly_meeting_days,
          total_minimum_hours: data.total_minimum_hours,
          preferred_time_period: data.preferred_time_period,
          preferred_time: data.preferred_time,
          start_time: data.start_time,
          end_time: data.end_time,
          description: data.description?.trim() || '',
          creator_id: creatorId,
          status: 'waiting'
        })
        .select()
        .single();

      if (communityError) {
        console.error('Error creating community:', communityError);
        return { success: false, error: this.formatError(communityError.message) };
      }

      // Add creator as first member
      const { error: memberError } = await supabase
        .from('community_members')
        .insert({
          community_id: community.id,
          user_id: creatorId,
          is_creator: true,
          stake_paid: true
        });

      if (memberError) {
        console.error('Error adding creator as member:', memberError);
        // Clean up the community if member insertion fails
        await supabase.from('communities').delete().eq('id', community.id);
        return { success: false, error: 'Failed to add creator as member' };
      }

      // Record creator stake payment (same as member stake)
      const creatorStakeAmount = stakeAmountCents;
      await this.recordStakePayment(creatorId, community.id, creatorStakeAmount, 'Creator stake payment');

      // Initialize community analytics
      await this.initializeCommunityAnalytics(community.id);

      return { success: true, community };
    } catch (error) {
      console.error('Unexpected error creating community:', error);
      return { success: false, error: 'An unexpected error occurred while creating the community' };
    }
  }

  // Validate community creation data
  private validateCommunityData(data: CreateCommunityData): string | null {
    if (!data.title?.trim()) return 'Community title is required';
    if (data.title.trim().length < 3) return 'Community title must be at least 3 characters';
    if (data.title.trim().length > 100) return 'Community title must be less than 100 characters';
    
    if (!data.goal?.trim()) return 'Goal description is required';
    if (data.goal.trim().length < 10) return 'Goal description must be at least 10 characters';
    if (data.goal.trim().length > 500) return 'Goal description must be less than 500 characters';
    
    if (!data.stake_amount || data.stake_amount < 10) return 'Stake amount must be at least $10';
    if (data.stake_amount > 1000) return 'Stake amount cannot exceed $1000';
    
    if (!data.start_date) return 'Start date is required';
    if (!data.end_date) return 'End date is required';
    
    const startDate = new Date(data.start_date);
    const endDate = new Date(data.end_date);
    const today = new Date();
    
    // Allow same-day start if the time is in the future
    if (startDate.toDateString() === today.toDateString()) {
      const startTime = data.start_time.split(':');
      const startHour = parseInt(startTime[0]);
      const startMinute = parseInt(startTime[1]);
      
      const currentHour = today.getHours();
      const currentMinute = today.getMinutes();
      
      if (startHour < currentHour || (startHour === currentHour && startMinute <= currentMinute)) {
        return 'Start time must be in the future';
      }
    } else if (startDate < today) {
      return 'Start date must be in the future';
    }
    
    if (endDate <= startDate) return 'End date must be after start date';
    
    const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff < 1) return 'Community duration must be at least 1 day';
    if (daysDiff > 365) return 'Community duration cannot exceed 365 days';
    
    if (!data.category) return 'Category is required';
    if (!data.max_members || data.max_members < 3) return 'Maximum members must be at least 3';
    if (data.max_members > 50) return 'Maximum members cannot exceed 50';
    
    if (!data.weekly_meeting_days || data.weekly_meeting_days.length === 0) {
      return 'At least one meeting day is required';
    }
    if (data.weekly_meeting_days.length > 7) return 'Cannot have more than 7 meeting days';
    
    if (!data.total_minimum_hours || data.total_minimum_hours < 10) return 'Total minimum hours must be at least 10';
    if (data.total_minimum_hours > 500) return 'Total minimum hours cannot exceed 500';
    
    if (!data.preferred_time_period) return 'Preferred meeting time period is required';
    if (!data.preferred_time) return 'Preferred meeting time is required';
    if (!data.start_time) return 'Start time is required';
    if (!data.end_time) return 'End time is required';
    
    return null;
  }

  // Format error messages for better user experience
  private formatError(errorMessage: string): string {
    if (errorMessage.includes('new row violates row-level security')) {
      return 'You do not have permission to create communities. Please ensure you are logged in.';
    }
    if (errorMessage.includes('invalid input syntax for type uuid')) {
      return 'Invalid user session. Please log out and log back in.';
    }
    if (errorMessage.includes('duplicate key value')) {
      return 'A community with similar details already exists.';
    }
    if (errorMessage.includes('null value in column')) {
      return 'Please fill in all required fields.';
    }
    return errorMessage;
  }

  // Record stake payment in earnings table
  private async recordStakePayment(userId: string, communityId: string, amount: number, description: string): Promise<void> {
    try {
      await supabase.from('earnings').insert({
        user_id: userId,
        community_id: communityId,
        amount: -amount, // Negative for payment
        type: 'stake_payment',
        description
      });
    } catch (error) {
      console.error('Error recording stake payment:', error);
    }
  }

  // Initialize community analytics
  private async initializeCommunityAnalytics(communityId: string): Promise<void> {
    try {
      await supabase.from('community_analytics').insert({
        community_id: communityId,
        total_members: 1,
        active_members: 1,
        total_meetings_held: 0,
        average_attendance_rate: 0,
        total_hours_logged: 0,
        completion_rate: 0
      });
    } catch (error) {
      console.error('Error initializing community analytics:', error);
    }
  }

  // Get all communities with enhanced data
  async getAllCommunities(): Promise<{ success: boolean; communities?: Community[]; error?: string }> {
    try {
      // Update community statuses first
      await this.updateCommunityStatuses();

      const { data: communities, error } = await supabase
        .from('communities')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching communities:', error);
        return { success: false, error: error.message };
      }

      // Enhance communities with member counts and analytics
      const enhancedCommunities = await Promise.all(
        (communities || []).map(async (community) => {
          const memberCount = await this.getCommunityMemberCount(community.id);
          const analytics = await this.getCommunityAnalytics(community.id);
          
          return {
            ...community,
            member_count: memberCount,
            creator_name: 'Community Creator',
            analytics
          };
        })
      );

      return { success: true, communities: enhancedCommunities };
    } catch (error) {
      console.error('Unexpected error fetching communities:', error);
      return { success: false, error: 'An unexpected error occurred while fetching communities' };
    }
  }

  // Update community statuses based on dates
  async updateCommunityStatuses(): Promise<void> {
    try {
      const { error } = await supabase.rpc('update_community_status');
      if (error) {
        console.error('Error updating community statuses:', error);
      }
    } catch (error) {
      console.error('Error calling update_community_status:', error);
    }
  }

  // Get community member count
  private async getCommunityMemberCount(communityId: string): Promise<number> {
    try {
      const { count } = await supabase
        .from('community_members')
        .select('*', { count: 'exact', head: true })
        .eq('community_id', communityId);
      return count || 0;
    } catch (error) {
      console.error('Error getting member count:', error);
      return 0;
    }
  }

  // Get community analytics
  private async getCommunityAnalytics(communityId: string): Promise<CommunityAnalytics | null> {
    try {
      const { data, error } = await supabase
        .from('community_analytics')
        .select('*')
        .eq('community_id', communityId)
        .order('date', { ascending: false })
        .limit(1);

      if (error || !data || data.length === 0) return null;
      return data[0];
    } catch (error) {
      return null;
    }
  }

  // Search communities with filters
  async searchCommunities(filters: {
    searchTerm?: string;
    category?: string;
    minStake?: number;
    maxStake?: number;
    status?: string;
  }): Promise<{ success: boolean; communities?: Community[]; error?: string }> {
    try {
      // Update community statuses first
      await this.updateCommunityStatuses();
      
      let query = supabase.from('communities').select('*');

      // Apply filters
      if (filters.searchTerm) {
        query = query.or(`title.ilike.%${filters.searchTerm}%,goal.ilike.%${filters.searchTerm}%`);
      }
      
      if (filters.category && filters.category !== 'All') {
        query = query.eq('category', filters.category);
      }
      
      if (filters.minStake) {
        query = query.gte('stake_amount', filters.minStake * 100);
      }
      
      if (filters.maxStake) {
        query = query.lte('stake_amount', filters.maxStake * 100);
      }
      
      if (filters.status && filters.status !== 'All') {
        query = query.eq('status', filters.status);
      }

      const { data: communities, error } = await query.order('created_at', { ascending: false });

      if (error) {
        return { success: false, error: error.message };
      }

      // Enhance with member counts
      const enhancedCommunities = await Promise.all(
        (communities || []).map(async (community) => ({
          ...community,
          member_count: await this.getCommunityMemberCount(community.id),
          creator_name: 'Community Creator'
        }))
      );

      return { success: true, communities: enhancedCommunities };
    } catch (error) {
      return { success: false, error: 'An unexpected error occurred while searching communities' };
    }
  }

  // Get community by ID with comprehensive data
  async getCommunityById(id: string): Promise<{ 
    success: boolean; 
    community?: Community; 
    members?: CommunityMember[]; 
    meetings?: MeetingSession[];
    analytics?: CommunityAnalytics;
    error?: string 
  }> {
    try {
      // Update community status first
      await this.updateCommunityStatuses();
      
      // Get community data
      const { data: community, error: communityError } = await supabase
        .from('communities')
        .select('*')
        .eq('id', id)
        .limit(1);

      if (communityError || !community || community.length === 0) {
        return { success: false, error: 'Community not found' };
      }

      // Get members with progress
      const { data: members, error: membersError } = await supabase
        .from('community_members')
        .select('*')
        .eq('community_id', id)
        .order('joined_at', { ascending: true });

      if (membersError) {
        return { success: false, error: membersError.message };
      }

      // Get upcoming meetings
      const { data: meetings } = await supabase
        .from('meeting_sessions')
        .select('*')
        .eq('community_id', id)
        .order('session_date', { ascending: true })
        .limit(10);

      // Get analytics
      const analytics = await this.getCommunityAnalytics(id);

      // Calculate member progress for each member
      for (const member of members || []) {
        await this.calculateMemberProgress(id, member.user_id);
      }

      return { 
        success: true, 
        community: {
          ...community[0],
          member_count: members?.length || 0
        }, 
        members: members || [], 
        meetings: meetings || [],
        analytics
      };
    } catch (error) {
      return { success: false, error: 'An unexpected error occurred while fetching community details' };
    }
  }

  // Calculate member progress using fallback method only
  private async calculateMemberProgress(communityId: string, userId: string): Promise<number> {
    try {
      // Use fallback calculation directly instead of RPC
      return await this.calculateMemberProgressFallback(communityId, userId);
    } catch (error) {
      console.error('Error calculating member progress:', error);
      return 0;
    }
  }

  // Fallback method to calculate member progress manually
  private async calculateMemberProgressFallback(communityId: string, userId: string): Promise<number> {
    try {
      // Get community details
      const { data: community } = await supabase
        .from('communities')
        .select('start_date, end_date, total_minimum_hours')
        .eq('id', communityId)
        .limit(1);

      if (!community || community.length === 0) return 0;

      const startDate = new Date(community[0].start_date);
      const today = new Date();
      const endDate = new Date(community[0].end_date);
      
      // If community hasn't started yet, progress is 0
      if (today < startDate) return 0;
      
      // If community has ended, use end date for calculation
      const calculationDate = today > endDate ? endDate : today;
      
      // Calculate total duration and elapsed duration
      const totalDuration = endDate.getTime() - startDate.getTime();
      const elapsedDuration = calculationDate.getTime() - startDate.getTime();
      
      // Calculate progress percentage based on time elapsed
      const timeProgressPercentage = Math.min(100, (elapsedDuration / totalDuration) * 100);
      
      // Get member's meeting attendance
      const { data: attendanceData } = await supabase
        .from('meeting_attendance')
        .select('duration_seconds')
        .eq('community_id', communityId)
        .eq('user_id', userId);

      // Calculate total hours logged
      const totalHoursLogged = attendanceData?.reduce((sum, a) => sum + (a.duration_seconds / 3600), 0) || 0;
      
      // Calculate progress based on hours logged vs required hours
      const requiredHours = community[0].total_minimum_hours;
      const hoursProgressPercentage = Math.min(100, (totalHoursLogged / requiredHours) * 100);
      
      // Weight the progress: 70% based on hours logged, 30% based on time elapsed
      const progressPercentage = (hoursProgressPercentage * 0.7) + (timeProgressPercentage * 0.3);

      // Update the member's progress
      await supabase
        .from('community_members')
        .update({ 
          progress_percentage: progressPercentage,
          total_meeting_seconds: attendanceData?.reduce((sum, a) => sum + a.duration_seconds, 0) || 0
        })
        .eq('community_id', communityId)
        .eq('user_id', userId);

      return progressPercentage;
    } catch (error) {
      console.error('Error in fallback progress calculation:', error);
      return 0;
    }
  }

  // Join a community with comprehensive validation
  async joinCommunity(communityId: string, userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Ensure user profile exists first
      const profileResult = await this.ensureUserProfile(userId);
      if (!profileResult.success) {
        return { success: false, error: profileResult.error };
      }

      // Check if user is already a member - FIXED: Use limit(1) instead of single()
      const { data: existingMember, error: memberCheckError } = await supabase
        .from('community_members')
        .select('id')
        .eq('community_id', communityId)
        .eq('user_id', userId)
        .limit(1);

      if (memberCheckError) {
        console.error('Error checking existing membership:', memberCheckError);
        return { success: false, error: 'Failed to check membership status' };
      }

      if (existingMember && existingMember.length > 0) {
        return { success: false, error: 'You are already a member of this community' };
      }

      // Get community details for validation
      const { data: community, error: communityError } = await supabase
        .from('communities')
        .select('max_members, stake_amount, status, start_date')
        .eq('id', communityId)
        .limit(1);

      if (communityError || !community || community.length === 0) {
        return { success: false, error: 'Community not found' };
      }

      // Check if community is full
      const memberCount = await this.getCommunityMemberCount(communityId);
      if (memberCount >= community[0].max_members) {
        return { success: false, error: 'This community is full' };
      }

      // Allow joining active communities
      if (community[0].status !== 'waiting' && community[0].status !== 'active') {
        return { success: false, error: 'This community is no longer accepting new members' };
      }

      // Add user as member
      const { error: memberError } = await supabase
        .from('community_members')
        .insert({
          community_id: communityId,
          user_id: userId,
          is_creator: false,
          stake_paid: true
        });

      if (memberError) {
        console.error('Error joining community:', memberError);
        return { success: false, error: memberError.message };
      }

      // Record stake payment
      await this.recordStakePayment(
        userId, 
        communityId, 
        community[0].stake_amount, 
        'Stake payment for joining community'
      );

      // Update community analytics
      await this.updateCommunityMemberCount(communityId);

      return { success: true };
    } catch (error) {
      console.error('Error joining community:', error);
      return { success: false, error: 'An unexpected error occurred while joining the community' };
    }
  }

  // Update community member count in analytics
  private async updateCommunityMemberCount(communityId: string): Promise<void> {
    try {
      const memberCount = await this.getCommunityMemberCount(communityId);
      
      await supabase
        .from('community_analytics')
        .upsert({
          community_id: communityId,
          date: new Date().toISOString().split('T')[0],
          total_members: memberCount,
          active_members: memberCount
        });
    } catch (error) {
      console.error('Error updating community member count:', error);
    }
  }

  // Get user's communities
  async getUserCommunities(userId: string): Promise<{ success: boolean; communities?: Community[]; error?: string }> {
    try {
      // Ensure user profile exists first
      await this.ensureUserProfile(userId);

      // Update community statuses first
      await this.updateCommunityStatuses();
      
      const { data: membershipData, error } = await supabase
        .from('community_members')
        .select(`
          *,
          communities (*)
        `)
        .eq('user_id', userId);

      if (error) {
        return { success: false, error: error.message };
      }

      const communities = membershipData?.map(membership => membership.communities).filter(Boolean) || [];
      
      // Enhance with member counts
      const enhancedCommunities = await Promise.all(
        communities.map(async (community: any) => ({
          ...community,
          member_count: await this.getCommunityMemberCount(community.id)
        }))
      );

      return { success: true, communities: enhancedCommunities };
    } catch (error) {
      return { success: false, error: 'An unexpected error occurred while fetching your communities' };
    }
  }

  // Get user's earnings with detailed breakdown
  async getUserEarnings(userId: string): Promise<{ success: boolean; earnings?: Earning[]; totalEarnings?: number; totalLosses?: number; error?: string }> {
    try {
      // Ensure user profile exists first
      await this.ensureUserProfile(userId);

      const { data: earnings, error } = await supabase
        .from('earnings')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        return { success: false, error: error.message };
      }

      const totalEarnings = earnings?.filter(e => e.amount > 0).reduce((sum, e) => sum + e.amount, 0) || 0;
      const totalLosses = Math.abs(earnings?.filter(e => e.amount < 0).reduce((sum, e) => sum + e.amount, 0) || 0);

      return { 
        success: true, 
        earnings: earnings || [], 
        totalEarnings: totalEarnings / 100, // Convert from cents
        totalLosses: totalLosses / 100 // Convert from cents
      };
    } catch (error) {
      return { success: false, error: 'An unexpected error occurred while fetching earnings' };
    }
  }

  // Log member progress
  async logMemberProgress(data: {
    communityId: string;
    userId: string;
    hoursLogged: number;
    goalsCompleted: number;
    notes?: string;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Validate inputs
      if (data.hoursLogged < 0) {
        return { success: false, error: 'Hours logged cannot be negative' };
      }
      
      if (data.goalsCompleted < 0) {
        return { success: false, error: 'Goals completed cannot be negative' };
      }
      
      // Check if user is a member of the community - FIXED: Use limit(1) instead of single()
      const { data: membership, error: membershipError } = await supabase
        .from('community_members')
        .select('id')
        .eq('community_id', data.communityId)
        .eq('user_id', data.userId)
        .limit(1);
        
      if (membershipError) {
        return { success: false, error: 'Failed to check membership status' };
      }

      if (!membership || membership.length === 0) {
        return { success: false, error: 'You are not a member of this community' };
      }
      
      // Get community details to check if it's active
      const { data: community } = await supabase
        .from('communities')
        .select('status')
        .eq('id', data.communityId)
        .limit(1);
        
      if (!community || community.length === 0 || community[0].status !== 'active') {
        return { success: false, error: 'Progress can only be logged for active communities' };
      }
      
      // Check if user has already logged progress today - FIXED: Use limit(1) instead of single()
      const { data: existingProgress } = await supabase
        .from('member_progress')
        .select('id, hours_logged, goals_completed')
        .eq('community_id', data.communityId)
        .eq('user_id', data.userId)
        .eq('date', today)
        .limit(1);
        
      // Get community requirements
      const { data: communityDetails } = await supabase
        .from('communities')
        .select('total_minimum_hours')
        .eq('id', data.communityId)
        .limit(1);
        
      if (!communityDetails || communityDetails.length === 0) {
        return { success: false, error: 'Community details not found' };
      }
      
      // Calculate daily goal threshold (total_minimum_hours / 30 days)
      const dailyGoalThreshold = communityDetails[0].total_minimum_hours / 30;
      const dailyGoalMet = data.hoursLogged >= dailyGoalThreshold;
      
      // Insert or update progress
      const { error } = await supabase
        .from('member_progress')
        .upsert({
          community_id: data.communityId,
          user_id: data.userId,
          date: today,
          hours_logged: existingProgress && existingProgress.length > 0
            ? existingProgress[0].hours_logged + data.hoursLogged 
            : data.hoursLogged,
          goals_completed: existingProgress && existingProgress.length > 0
            ? existingProgress[0].goals_completed + data.goalsCompleted 
            : data.goalsCompleted,
          daily_goal_met: dailyGoalMet,
          notes: data.notes
        });

      if (error) {
        return { success: false, error: error.message };
      }

      // Recalculate member progress
      await this.calculateMemberProgress(data.communityId, data.userId);
      
      // Update community analytics
      await this.updateCommunityAnalytics(data.communityId);

      return { success: true };
    } catch (error) {
      console.error('Error logging progress:', error);
      return { success: false, error: 'An unexpected error occurred while logging progress' };
    }
  }

  // Update community analytics
  private async updateCommunityAnalytics(communityId: string): Promise<void> {
    try {
      // Get community members
      const { data: members } = await supabase
        .from('community_members')
        .select('user_id, progress_percentage, total_meeting_seconds, is_disqualified')
        .eq('community_id', communityId);
        
      if (!members || members.length === 0) return;
      
      // Get meeting data
      const { data: meetings } = await supabase
        .from('meeting_sessions')
        .select('id')
        .eq('community_id', communityId)
        .eq('status', 'completed');
        
      // Get attendance data
      const { data: attendance } = await supabase
        .from('meeting_attendance')
        .select('user_id, duration_seconds')
        .eq('community_id', communityId);
        
      // Calculate analytics
      const totalMembers = members.length;
      const activeMembers = members.filter(m => !m.is_disqualified).length;
      const totalMeetingsHeld = meetings?.length || 0;
      
      // Calculate average attendance rate
      let averageAttendanceRate = 0;
      if (totalMeetingsHeld > 0 && totalMembers > 0) {
        const uniqueAttendees = new Set(attendance?.map(a => a.user_id) || []);
        averageAttendanceRate = (uniqueAttendees.size / totalMembers) * 100;
      }
      
      // Calculate total hours logged
      const totalHoursLogged = attendance
        ? attendance.reduce((sum, a) => sum + (a.duration_seconds / 3600), 0)
        : 0;
        
      // Calculate completion rate
      const completionRate = members.reduce((sum, m) => sum + m.progress_percentage, 0) / totalMembers;
      
      // Update analytics
      await supabase
        .from('community_analytics')
        .upsert({
          community_id: communityId,
          date: new Date().toISOString().split('T')[0],
          total_members: totalMembers,
          active_members: activeMembers,
          total_meetings_held: totalMeetingsHeld,
          average_attendance_rate: averageAttendanceRate,
          total_hours_logged: totalHoursLogged,
          completion_rate: completionRate
        });
    } catch (error) {
      console.error('Error updating community analytics:', error);
    }
  }

  // Get community meetings
  async getCommunityMeetings(communityId: string): Promise<{ success: boolean; meetings?: MeetingSession[]; error?: string }> {
    try {
      const { data: meetings, error } = await supabase
        .from('meeting_sessions')
        .select('*')
        .eq('community_id', communityId)
        .order('session_date', { ascending: true });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, meetings: meetings || [] };
    } catch (error) {
      return { success: false, error: 'An unexpected error occurred while fetching meetings' };
    }
  }

  // Record meeting attendance
  async recordMeetingAttendance(data: {
    meetingSessionId: string;
    userId: string;
    communityId: string;
    durationSeconds: number;
    screenShared: boolean;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('meeting_attendance')
        .insert({
          meeting_session_id: data.meetingSessionId,
          user_id: data.userId,
          community_id: data.communityId,
          joined_at: new Date().toISOString(),
          duration_seconds: data.durationSeconds,
          screen_shared: data.screenShared,
          participation_score: data.screenShared ? 1.0 : 0.8
        });

      if (error) {
        return { success: false, error: error.message };
      }

      // Recalculate member progress
      await this.calculateMemberProgress(data.communityId, data.userId);

      return { success: true };
    } catch (error) {
      return { success: false, error: 'An unexpected error occurred while recording attendance' };
    }
  }

  // Get community leaderboard
  async getCommunityLeaderboard(communityId: string): Promise<{ success: boolean; leaderboard?: any[]; error?: string }> {
    try {
      const { data: members, error } = await supabase
        .from('community_members')
        .select('user_id, progress_percentage, total_meeting_seconds, is_creator')
        .eq('community_id', communityId)
        .order('progress_percentage', { ascending: false });

      if (error) {
        return { success: false, error: error.message };
      }

      const leaderboard = members?.map((member, index) => ({
        rank: index + 1,
        user_id: member.user_id,
        progress_percentage: member.progress_percentage,
        total_meeting_hours: Math.round(member.total_meeting_seconds / 3600 * 10) / 10,
        is_creator: member.is_creator
      })) || [];

      return { success: true, leaderboard };
    } catch (error) {
      return { success: false, error: 'An unexpected error occurred while fetching leaderboard' };
    }
  }
  
  // Get community distribution details
  async getCommunityDistribution(communityId: string): Promise<{ success: boolean; distribution?: any; error?: string }> {
    try {
      const { data: distribution, error } = await supabase
        .from('community_rewards')
        .select('*')
        .eq('community_id', communityId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error && error.code !== 'PGRST116') {
        return { success: false, error: error.message };
      }

      if (!distribution || distribution.length === 0) {
        // If no distribution exists yet, calculate a preview
        const { data: community } = await supabase
          .from('communities')
          .select('stake_amount, status')
          .eq('id', communityId)
          .limit(1);
          
        if (!community || community.length === 0) {
          return { success: false, error: 'Community not found' };
        }
        
        // Get member count
        const memberCount = await this.getCommunityMemberCount(communityId);
        
        // Calculate estimated distribution
        const totalStakePool = community[0].stake_amount * memberCount;
        const platformFee = Math.round(totalStakePool * 0.1);
        const distributableAmount = totalStakePool - platformFee;
        
        // Assume 50% success rate for potential earnings calculation
        const estimatedWinners = Math.ceil(memberCount * 0.5);
        const rewardPerWinner = estimatedWinners > 0 
          ? Math.floor(distributableAmount / estimatedWinners)
          : 0;
          
        return { 
          success: true, 
          distribution: {
            community_id: communityId,
            total_stake_pool: totalStakePool,
            platform_fee_amount: platformFee,
            distributable_amount: distributableAmount,
            winner_count: estimatedWinners,
            reward_per_winner: rewardPerWinner,
            status: 'pending',
            is_preview: true // Flag to indicate this is a preview calculation
          }
        };
      }

      // Convert amounts from cents to dollars
      const formattedDistribution = {
        ...distribution[0],
        total_stake_pool: distribution[0].total_stake_pool / 100,
        platform_fee_amount: distribution[0].platform_fee_amount / 100,
        distributable_amount: distribution[0].distributable_amount / 100,
        reward_per_winner: distribution[0].reward_per_winner / 100
      };

      return { success: true, distribution: formattedDistribution };
    } catch (error) {
      console.error('Error getting community distribution:', error);
      return { success: false, error: 'An unexpected error occurred while fetching distribution details' };
    }
  }
  
  // Trigger community earnings distribution (for testing)
  async triggerCommunityDistribution(communityId: string): Promise<{ success: boolean; result?: any; error?: string }> {
    try {
      // Check if community is ended
      const { data: community } = await supabase
        .from('communities')
        .select('status')
        .eq('id', communityId)
        .limit(1);
        
      if (!community || community.length === 0) {
        return { success: false, error: 'Community not found' };
      }
      
      if (community[0].status !== 'ended') {
        return { success: false, error: 'Can only distribute earnings for ended communities' };
      }
      
      // Check if distribution already exists
      const { data: existingDistribution } = await supabase
        .from('community_rewards')
        .select('status')
        .eq('community_id', communityId)
        .order('created_at', { ascending: false })
        .limit(1);
        
      if (existingDistribution && existingDistribution.length > 0 && existingDistribution[0].status === 'distributed') {
        return { success: false, error: 'Earnings have already been distributed for this community' };
      }
      
      // Trigger distribution
      const { data: result, error } = await supabase.rpc('process_community_end', {
        p_community_id: communityId
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, result };
    } catch (error) {
      console.error('Error triggering community distribution:', error);
      return { success: false, error: 'An unexpected error occurred while processing distribution' };
    }
  }
}

export default new CommunityService();