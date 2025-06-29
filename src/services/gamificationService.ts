import { supabase } from '../lib/supabase';

export interface UserStreak {
  current_streak: number;
  longest_streak: number;
  last_active_date: string;
  streak_start_date: string;
}

export interface UserBadge {
  badge_id: string;
  badge_name: string;
  badge_description: string;
  badge_category: 'achievement' | 'consistency' | 'participation' | 'community';
  badge_rarity: 'common' | 'rare' | 'epic' | 'legendary';
  awarded_at: string;
}

export interface LeaderboardPosition {
  leaderboard_type: 'earnings' | 'hours' | 'streak' | 'communities_won';
  period: 'all_time' | 'monthly' | 'weekly';
  rank: number;
  total_users: number;
  value: number;
}

export interface UserStatistics {
  total_hours_logged: number;
  communities_joined: number;
  communities_won: number;
  communities_lost: number;
  total_earnings: number;
  total_losses: number;
  longest_streak: number;
  current_streak: number;
  meetings_attended: number;
  goals_completed: number;
  success_rate: number;
  platform_tenure_days: number;
}

export interface UserGamificationData {
  user_id: string;
  statistics: UserStatistics;
  streak: UserStreak | null;
  leaderboard_positions: LeaderboardPosition[];
  badges: UserBadge[];
}

class GamificationService {
  // Get user's comprehensive gamification data
  async getUserGamificationData(userId: string): Promise<{ success: boolean; data?: UserGamificationData; error?: string }> {
    try {
      const { data, error } = await supabase.rpc('get_user_statistics', {
        p_user_id: userId
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data };
    } catch (error) {
      console.error('Error getting user gamification data:', error);
      return { success: false, error: 'An unexpected error occurred while fetching gamification data' };
    }
  }

  // Get user's streak information
  async getUserStreak(userId: string, communityId?: string): Promise<{ success: boolean; streak?: UserStreak; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('user_streaks')
        .select('current_streak, longest_streak, last_active_date, streak_start_date')
        .eq('user_id', userId)
        .eq('community_id', communityId || null)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
        return { success: false, error: error.message };
      }

      return { success: true, streak: data || null };
    } catch (error) {
      console.error('Error getting user streak:', error);
      return { success: false, error: 'An unexpected error occurred while fetching streak data' };
    }
  }

  // Get user's badges
  async getUserBadges(userId: string): Promise<{ success: boolean; badges?: UserBadge[]; error?: string }> {
    try {
      const { data, error } = await supabase.rpc('get_user_badges', {
        p_user_id: userId
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, badges: data || [] };
    } catch (error) {
      console.error('Error getting user badges:', error);
      return { success: false, error: 'An unexpected error occurred while fetching badges' };
    }
  }

  // Get user's leaderboard positions
  async getUserLeaderboardPositions(userId: string): Promise<{ success: boolean; positions?: LeaderboardPosition[]; error?: string }> {
    try {
      const { data, error } = await supabase.rpc('get_user_leaderboard_positions', {
        p_user_id: userId
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, positions: data || [] };
    } catch (error) {
      console.error('Error getting leaderboard positions:', error);
      return { success: false, error: 'An unexpected error occurred while fetching leaderboard positions' };
    }
  }

  // Get global leaderboard
  async getLeaderboard(
    type: 'earnings' | 'hours' | 'streak' | 'communities_won' = 'earnings',
    period: 'all_time' | 'monthly' | 'weekly' = 'all_time',
    year?: number,
    month?: number,
    week?: number
  ): Promise<{ success: boolean; leaderboard?: any[]; error?: string }> {
    try {
      let query = supabase
        .from('leaderboards')
        .select('rankings, calculated_at')
        .eq('leaderboard_type', type)
        .eq('period', period);

      if (period === 'monthly' && year && month) {
        query = query.eq('year', year).eq('month', month);
      } else if (period === 'weekly' && year && week) {
        query = query.eq('year', year).eq('week', week);
      }

      const { data, error } = await query.single();

      if (error && error.code !== 'PGRST116') {
        return { success: false, error: error.message };
      }

      // If no leaderboard found, return empty array
      if (!data) {
        return { success: true, leaderboard: [] };
      }

      // Enhance leaderboard with user information
      const rankings = data.rankings || [];
      const userIds = rankings.map((r: any) => r.user_id);

      if (userIds.length === 0) {
        return { success: true, leaderboard: [] };
      }

      // Get user information for the leaderboard entries
      const { data: users } = await supabase
        .from('profiles')
        .select('id, name, avatar_url')
        .in('id', userIds);

      // Map user info to leaderboard entries
      const leaderboard = rankings.map((entry: any) => {
        const user = users?.find(u => u.id === entry.user_id) || { name: 'User', avatar_url: null };
        return {
          ...entry,
          user_name: user.name,
          user_avatar: user.avatar_url
        };
      });

      return { 
        success: true, 
        leaderboard,
        lastUpdated: data.calculated_at
      };
    } catch (error) {
      console.error('Error getting leaderboard:', error);
      return { success: false, error: 'An unexpected error occurred while fetching leaderboard' };
    }
  }

  // Manually trigger streak calculation (for testing)
  async calculateUserStreak(userId: string, communityId?: string): Promise<{ success: boolean; streak?: number; error?: string }> {
    try {
      const { data, error } = await supabase.rpc('calculate_user_streak', {
        p_user_id: userId,
        p_community_id: communityId || null
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, streak: data };
    } catch (error) {
      console.error('Error calculating user streak:', error);
      return { success: false, error: 'An unexpected error occurred while calculating streak' };
    }
  }

  // Manually trigger user statistics update (for testing)
  async updateUserStatistics(userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase.rpc('update_user_statistics', {
        p_user_id: userId
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error('Error updating user statistics:', error);
      return { success: false, error: 'An unexpected error occurred while updating statistics' };
    }
  }
}

export default new GamificationService();