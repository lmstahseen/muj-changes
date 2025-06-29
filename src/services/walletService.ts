import { supabase } from '../lib/supabase';

export interface WalletSummary {
  total_earnings: number;
  total_losses: number;
  net_balance: number;
  pending_stakes: number;
  total_communities: number;
  won_communities: number;
  success_rate: number;
  recent_transactions: Transaction[];
  earnings_by_community?: any[];
  losses_by_community?: any[];
  active_communities?: any[];
}

export interface Transaction {
  id: string;
  amount: number;
  type: 'stake_payment' | 'reward' | 'forfeit' | 'refund';
  description: string;
  created_at: string;
  transaction_id: string;
  transaction_status?: 'pending' | 'completed' | 'failed' | 'reversed';
  balance_before?: number;
  balance_after?: number;
  platform_fee_amount?: number;
  metadata?: any;
  community_id?: string;
  community_title?: string;
}

export interface PayoutDetails {
  id?: string;
  user_id: string;
  preferred_method: 'bank_transfer' | 'paypal' | 'crypto';
  bank_account_number?: string;
  bank_routing_number?: string;
  bank_account_holder?: string;
  paypal_email?: string;
  crypto_wallet_address?: string;
  crypto_currency?: string;
  minimum_payout_threshold: number;
  auto_payout_enabled: boolean;
  verification_status: 'unverified' | 'pending' | 'verified' | 'rejected';
  verification_documents?: any;
  created_at?: string;
  updated_at?: string;
}

export interface ROIAnalysis {
  period_days: number;
  total_invested: number;
  total_returned: number;
  net_profit: number;
  roi_percentage: number;
  monthly_breakdown: Array<{
    month: string;
    invested: number;
    returned: number;
    net: number;
  }>;
}

export interface PlatformStats {
  total_users: number;
  active_users: number;
  total_stakes_collected: number;
  total_rewards_distributed: number;
  platform_fees_collected: number;
  average_success_rate: number;
}

export interface PaymentSimulation {
  success: boolean;
  transaction_id?: string;
  amount?: number;
  new_balance?: number;
  receipt_number?: string;
  error?: string;
  retry_allowed?: boolean;
}

class WalletService {
  // Simulate stake payment with realistic flow
  async simulateStakePayment(
    userId: string,
    communityId: string,
    amount: number,
    description: string,
    paymentMethod: 'credit_card' | 'paypal' | 'bank_transfer' = 'credit_card'
  ): Promise<{ success: boolean; result?: PaymentSimulation; error?: string }> {
    try {
      // Validate amount
      if (amount < 1000) { // $10.00 minimum
        return { success: false, error: 'Minimum stake amount is $10.00' };
      }

      if (amount > 100000) { // $1000.00 maximum
        return { success: false, error: 'Maximum stake amount is $1000.00' };
      }

      const { data: result, error } = await supabase.rpc('simulate_stake_payment', {
        p_user_id: userId,
        p_community_id: communityId,
        p_amount: amount,
        p_description: description,
        p_payment_method: paymentMethod
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, result };
    } catch (error) {
      console.error('Error simulating stake payment:', error);
      return { success: false, error: 'An unexpected error occurred during payment simulation' };
    }
  }

  // Get comprehensive wallet summary
  async getWalletSummary(userId: string): Promise<{ success: boolean; summary?: WalletSummary; error?: string }> {
    try {
      const { data: summary, error } = await supabase.rpc('get_user_wallet_summary', {
        p_user_id: userId
      });

      if (error) {
        return { success: false, error: error.message };
      }

      // Get earnings by community
      const { data: earningsByCommunity } = await supabase
        .from('earnings')
        .select('amount, community_id, communities(title)')
        .eq('user_id', userId)
        .gt('amount', 0)
        .order('amount', { ascending: false });
      
      // Get losses by community
      const { data: lossesByCommunity } = await supabase
        .from('earnings')
        .select('amount, community_id, communities(title)')
        .eq('user_id', userId)
        .lt('amount', 0)
        .order('amount', { ascending: true });
      
      // Get active communities
      const { data: activeCommunities } = await supabase
        .from('community_members')
        .select(`
          community_id,
          communities!inner(title, stake_amount, status)
        `)
        .eq('user_id', userId)
        .eq('communities.status', 'active');

      // Format the community data
      const formattedEarnings = earningsByCommunity?.map(item => ({
        community_id: item.community_id,
        community_title: item.communities?.title,
        amount: item.amount / 100
      })) || [];
      
      const formattedLosses = lossesByCommunity?.map(item => ({
        community_id: item.community_id,
        community_title: item.communities?.title,
        amount: Math.abs(item.amount) / 100
      })) || [];
      
      const formattedActiveCommunities = activeCommunities?.map(item => ({
        community_id: item.community_id,
        community_title: item.communities?.title,
        stake_amount: item.communities?.stake_amount / 100
      })) || [];

      // Convert amounts from cents to dollars for display
      const formattedSummary: WalletSummary = {
        ...summary,
        total_earnings: summary.total_earnings / 100,
        total_losses: summary.total_losses / 100,
        net_balance: summary.net_balance / 100,
        pending_stakes: summary.pending_stakes / 100,
        recent_transactions: summary.recent_transactions.map((tx: any) => ({
          ...tx,
          amount: tx.amount / 100
        })),
        earnings_by_community: formattedEarnings,
        losses_by_community: formattedLosses,
        active_communities: formattedActiveCommunities
      };

      return { success: true, summary: formattedSummary };
    } catch (error) {
      console.error('Error getting wallet summary:', error);
      return { success: false, error: 'An unexpected error occurred while fetching wallet summary' };
    }
  }

  // Get detailed transaction history
  async getTransactionHistory(
    userId: string,
    limit: number = 50,
    offset: number = 0,
    type?: Transaction['type'],
    communityId?: string,
    startDate?: string,
    searchTerm?: string
  ): Promise<{ success: boolean; transactions?: Transaction[]; total?: number; error?: string }> {
    try {
      let query = supabase
        .from('earnings')
        .select(`
          *,
          communities(id, title)
        `, { count: 'exact' })
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (type) {
        query = query.eq('type', type);
      }
      
      if (communityId) {
        query = query.eq('community_id', communityId);
      }
      
      if (startDate) {
        query = query.gte('created_at', startDate);
      }
      
      if (searchTerm) {
        query = query.ilike('description', `%${searchTerm}%`);
      }

      const { data: transactions, error, count } = await query;

      if (error) {
        return { success: false, error: error.message };
      }

      // Format transactions for display
      const formattedTransactions: Transaction[] = (transactions || []).map(tx => ({
        ...tx,
        amount: tx.amount / 100, // Convert from cents to dollars
        platform_fee_amount: tx.platform_fee_amount ? tx.platform_fee_amount / 100 : undefined,
        community_id: tx.community_id,
        community_title: tx.communities?.title
      }));

      return { 
        success: true, 
        transactions: formattedTransactions,
        total: count || 0
      };
    } catch (error) {
      console.error('Error getting transaction history:', error);
      return { success: false, error: 'An unexpected error occurred while fetching transaction history' };
    }
  }

  // Calculate ROI analysis
  async calculateROI(
    userId: string,
    days: number = 30
  ): Promise<{ success: boolean; analysis?: ROIAnalysis; error?: string }> {
    try {
      const { data: analysis, error } = await supabase.rpc('calculate_user_roi', {
        p_user_id: userId,
        p_days: days
      });

      if (error) {
        return { success: false, error: error.message };
      }

      // Convert amounts from cents to dollars
      const formattedAnalysis: ROIAnalysis = {
        ...analysis,
        total_invested: analysis.total_invested / 100,
        total_returned: analysis.total_returned / 100,
        net_profit: analysis.net_profit / 100,
        monthly_breakdown: analysis.monthly_breakdown.map((month: any) => ({
          ...month,
          invested: month.invested / 100,
          returned: month.returned / 100,
          net: month.net / 100
        }))
      };

      return { success: true, analysis: formattedAnalysis };
    } catch (error) {
      console.error('Error calculating ROI:', error);
      return { success: false, error: 'An unexpected error occurred while calculating ROI' };
    }
  }

  // Get or create payout details
  async getPayoutDetails(userId: string): Promise<{ success: boolean; details?: PayoutDetails; error?: string }> {
    try {
      const { data: details, error } = await supabase
        .from('user_payout_details')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
        return { success: false, error: error.message };
      }

      // Convert threshold from cents to dollars
      const formattedDetails = details ? {
        ...details,
        minimum_payout_threshold: details.minimum_payout_threshold / 100
      } : null;

      return { success: true, details: formattedDetails };
    } catch (error) {
      console.error('Error getting payout details:', error);
      return { success: false, error: 'An unexpected error occurred while fetching payout details' };
    }
  }

  // Update payout details
  async updatePayoutDetails(
    userId: string,
    details: Partial<PayoutDetails>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Convert threshold from dollars to cents
      const formattedDetails = {
        ...details,
        minimum_payout_threshold: details.minimum_payout_threshold 
          ? details.minimum_payout_threshold * 100 
          : undefined
      };

      const { error } = await supabase
        .from('user_payout_details')
        .upsert({
          user_id: userId,
          ...formattedDetails
        }, {
          onConflict: 'user_id'
        });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error('Error updating payout details:', error);
      return { success: false, error: 'An unexpected error occurred while updating payout details' };
    }
  }

  // Request payout (simulation)
  async requestPayout(
    userId: string,
    amount: number,
    method: PayoutDetails['preferred_method']
  ): Promise<{ success: boolean; requestId?: string; estimatedProcessingDays?: number; error?: string }> {
    try {
      // Validate payout amount
      const { data: balance } = await supabase.rpc('get_user_wallet_summary', {
        p_user_id: userId
      });

      if (!balance || balance.net_balance < amount * 100) {
        return { success: false, error: 'Insufficient balance for payout request' };
      }

      // Get payout details
      const payoutResult = await this.getPayoutDetails(userId);
      if (!payoutResult.success || !payoutResult.details) {
        return { success: false, error: 'Please set up your payout details first' };
      }

      const minThreshold = payoutResult.details.minimum_payout_threshold;
      if (amount < minThreshold) {
        return { success: false, error: `Minimum payout amount is $${minThreshold.toFixed(2)}` };
      }

      // Simulate payout request processing
      const requestId = `PAYOUT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const estimatedDays = method === 'bank_transfer' ? 5 : method === 'paypal' ? 3 : 7;

      // Record the payout request in transaction logs
      const { error } = await supabase
        .from('transaction_logs')
        .insert({
          transaction_id: requestId,
          user_id: userId,
          transaction_type: 'payout_request',
          amount: amount * 100, // Convert to cents
          description: `Payout request via ${method.replace('_', ' ')}`,
          metadata: {
            method,
            status: 'pending',
            requested_at: new Date().toISOString(),
            estimated_completion_date: new Date(Date.now() + estimatedDays * 24 * 60 * 60 * 1000).toISOString()
          }
        });

      if (error) {
        console.error('Error recording payout request:', error);
      }

      return { 
        success: true, 
        requestId,
        estimatedProcessingDays: estimatedDays
      };
    } catch (error) {
      console.error('Error requesting payout:', error);
      return { success: false, error: 'An unexpected error occurred while processing payout request' };
    }
  }

  // Get platform financial statistics
  async getPlatformStats(): Promise<{ success: boolean; stats?: PlatformStats; error?: string }> {
    try {
      const { data: stats, error } = await supabase.rpc('get_platform_financial_stats');

      if (error) {
        return { success: false, error: error.message };
      }

      // Convert amounts from cents to dollars
      const formattedStats: PlatformStats = {
        ...stats,
        total_stakes_collected: stats.total_stakes_collected / 100,
        total_rewards_distributed: stats.total_rewards_distributed / 100,
        platform_fees_collected: stats.platform_fees_collected / 100
      };

      return { success: true, stats: formattedStats };
    } catch (error) {
      console.error('Error getting platform stats:', error);
      return { success: false, error: 'An unexpected error occurred while fetching platform statistics' };
    }
  }

  // Get wallet analytics for charts
  async getWalletAnalytics(
    userId: string,
    days: number = 30
  ): Promise<{ success: boolean; analytics?: any[]; error?: string }> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data: analytics, error } = await supabase
        .from('wallet_analytics')
        .select('*')
        .eq('user_id', userId)
        .gte('date', startDate.toISOString().split('T')[0])
        .order('date', { ascending: true });

      if (error) {
        return { success: false, error: error.message };
      }

      // Convert amounts from cents to dollars
      const formattedAnalytics = (analytics || []).map(day => ({
        ...day,
        total_earnings: day.total_earnings / 100,
        total_losses: day.total_losses / 100,
        net_balance: day.net_balance / 100
      }));

      return { success: true, analytics: formattedAnalytics };
    } catch (error) {
      console.error('Error getting wallet analytics:', error);
      return { success: false, error: 'An unexpected error occurred while fetching wallet analytics' };
    }
  }

  // Get community distribution details
  async getCommunityDistribution(
    communityId: string
  ): Promise<{ success: boolean; distribution?: any; error?: string }> {
    try {
      const { data: distribution, error } = await supabase
        .from('community_rewards')
        .select('*')
        .eq('community_id', communityId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        return { success: false, error: error.message };
      }

      // Convert amounts from cents to dollars
      const formattedDistribution = distribution ? {
        ...distribution,
        total_stake_pool: distribution.total_stake_pool / 100,
        platform_fee_amount: distribution.platform_fee_amount / 100,
        distributable_amount: distribution.distributable_amount / 100,
        reward_per_winner: distribution.reward_per_winner / 100
      } : null;

      return { success: true, distribution: formattedDistribution };
    } catch (error) {
      console.error('Error getting community distribution:', error);
      return { success: false, error: 'An unexpected error occurred while fetching distribution details' };
    }
  }

  // Get user's communities
  async getUserCommunities(userId: string): Promise<{ success: boolean; communities?: any[]; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('community_members')
        .select(`
          community_id,
          communities(id, title, status)
        `)
        .eq('user_id', userId);

      if (error) {
        return { success: false, error: error.message };
      }

      const communities = data?.map(item => ({
        id: item.community_id,
        title: item.communities?.title,
        status: item.communities?.status
      })) || [];

      return { success: true, communities };
    } catch (error) {
      console.error('Error getting user communities:', error);
      return { success: false, error: 'An unexpected error occurred' };
    }
  }

  // Format currency for display
  formatCurrency(amountInCents: number): string {
    return `$${(amountInCents / 100).toLocaleString('en-US', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    })}`;
  }

  // Format currency for input (dollars to cents)
  parseCurrency(dollarAmount: number): number {
    return Math.round(dollarAmount * 100);
  }
}

export default new WalletService();