import React, { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { useAuth } from '../contexts/AuthContext';
import walletService, { WalletSummary, Transaction, ROIAnalysis, PayoutDetails } from '../services/walletService';
import { PaymentSimulation } from '../components/PaymentSimulation';
import { WalletAnalytics } from '../components/WalletAnalytics';
import { PayoutRequestForm } from '../components/PayoutRequestForm';
import { EarningsDistributionModal } from '../components/EarningsDistributionModal';

export function Wallet() {
  const { user } = useAuth();
  const [walletSummary, setWalletSummary] = useState<WalletSummary | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [roiAnalysis, setROIAnalysis] = useState<ROIAnalysis | null>(null);
  const [payoutDetails, setPayoutDetails] = useState<PayoutDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'transactions' | 'analytics' | 'payout'>('overview');
  const [showBalances, setShowBalances] = useState(true);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [transactionFilter, setTransactionFilter] = useState<'all' | 'earnings' | 'payments'>('all');
  const [roiPeriod, setROIPeriod] = useState(30);
  const [communityFilter, setCommunityFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<'all' | '7days' | '30days' | '90days'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedTransaction, setExpandedTransaction] = useState<string | null>(null);
  const [showDistributionModal, setShowDistributionModal] = useState(false);
  const [selectedCommunityId, setSelectedCommunityId] = useState<string | null>(null);
  const [communities, setCommunities] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [transactionsPerPage] = useState(10);

  useEffect(() => {
    if (user) {
      loadWalletData();
      loadCommunities();
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadTransactions();
    }
  }, [user, transactionFilter, communityFilter, dateFilter, searchTerm, page]);

  const loadWalletData = async () => {
    if (!user) return;
    
    setLoading(true);
    setError('');
    
    try {
      // Load wallet summary
      const summaryResult = await walletService.getWalletSummary(user.id);
      if (summaryResult.success && summaryResult.summary) {
        setWalletSummary(summaryResult.summary);
      }

      // Load ROI analysis
      const roiResult = await walletService.calculateROI(user.id, roiPeriod);
      if (roiResult.success && roiResult.analysis) {
        setROIAnalysis(roiResult.analysis);
      }

      // Load payout details
      const payoutResult = await walletService.getPayoutDetails(user.id);
      if (payoutResult.success) {
        setPayoutDetails(payoutResult.details || null);
      }
    } catch (err) {
      setError('Failed to load wallet data');
    } finally {
      setLoading(false);
    }
  };

  const loadTransactions = async () => {
    if (!user) return;
    
    setLoading(true);
    
    try {
      // Calculate date filter
      let startDate: Date | undefined;
      if (dateFilter !== 'all') {
        startDate = new Date();
        if (dateFilter === '7days') startDate.setDate(startDate.getDate() - 7);
        if (dateFilter === '30days') startDate.setDate(startDate.getDate() - 30);
        if (dateFilter === '90days') startDate.setDate(startDate.getDate() - 90);
      }
      
      // Calculate transaction type
      let type: string | undefined;
      if (transactionFilter === 'earnings') type = 'reward';
      if (transactionFilter === 'payments') type = 'stake_payment';
      
      const result = await walletService.getTransactionHistory(
        user.id,
        transactionsPerPage,
        (page - 1) * transactionsPerPage,
        type,
        communityFilter !== 'all' ? communityFilter : undefined,
        startDate?.toISOString(),
        searchTerm
      );
      
      if (result.success && result.transactions) {
        setTransactions(result.transactions);
        setTotalPages(Math.ceil((result.total || 0) / transactionsPerPage));
      }
    } catch (err) {
      console.error('Error loading transactions:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadCommunities = async () => {
    if (!user) return;
    
    try {
      const result = await walletService.getUserCommunities(user.id);
      if (result.success && result.communities) {
        setCommunities(result.communities);
      }
    } catch (err) {
      console.error('Error loading communities:', err);
    }
  };

  const handlePaymentSuccess = () => {
    setShowPaymentModal(false);
    loadWalletData(); // Refresh data after payment
    loadTransactions();
  };

  const handleRequestPayout = async () => {
    if (!user || !walletSummary || !payoutDetails) return;

    try {
      const result = await walletService.requestPayout(
        user.id,
        walletSummary.net_balance,
        payoutDetails.preferred_method
      );

      if (result.success) {
        alert(`Payout request submitted! Request ID: ${result.requestId}. Estimated processing time: ${result.estimatedProcessingDays} days.`);
      } else {
        alert(result.error || 'Failed to submit payout request');
      }
    } catch (err) {
      alert('An unexpected error occurred');
    }
  };

  const formatCurrency = (amount: number) => {
    return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getTransactionIcon = (type: Transaction['type']) => {
    switch (type) {
      case 'reward': return 'solar:graph-up-bold-duotone';
      case 'stake_payment': return 'solar:card-bold-duotone';
      case 'forfeit': return 'solar:graph-down-bold-duotone';
      default: return 'solar:dollar-bold-duotone';
    }
  };

  const getTransactionColor = (type: Transaction['type']) => {
    switch (type) {
      case 'reward': return 'text-green-600';
      case 'stake_payment': return 'text-blue-600';
      case 'forfeit': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const toggleTransactionExpansion = (transactionId: string) => {
    if (expandedTransaction === transactionId) {
      setExpandedTransaction(null);
    } else {
      setExpandedTransaction(transactionId);
    }
  };

  const handleViewDistribution = (communityId: string) => {
    setSelectedCommunityId(communityId);
    setShowDistributionModal(true);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage > 0 && newPage <= totalPages) {
      setPage(newPage);
    }
  };

  const filteredTransactions = transactions;

  if (loading && !walletSummary) {
    return (
      <div className="pt-20 min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading wallet data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-20 min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Wallet</h1>
              <p className="text-gray-600">Track your earnings, losses, and financial progress.</p>
            </div>
            
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setShowBalances(!showBalances)}
                className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
                title={showBalances ? 'Hide balances' : 'Show balances'}
              >
                <Icon icon={showBalances ? "solar:eye-closed-bold-duotone" : "solar:eye-bold-duotone"} width={20} />
              </button>
              
              <button
                onClick={loadWalletData}
                className="flex items-center space-x-2 bg-primary-600 text-white px-4 py-2 rounded-xl hover:bg-primary-700 transition-colors"
              >
                <Icon icon="solar:refresh-bold-duotone" width={16} />
                <span>Refresh</span>
              </button>
            </div>
          </div>

          {/* Testing Notice */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 mb-8">
            <div className="flex items-start space-x-3">
              <Icon icon="solar:danger-triangle-bold-duotone" width={24} className="text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-lg font-semibold text-yellow-800 mb-2">Testing Mode Active</h3>
                <p className="text-yellow-700">
                  All transactions shown are simulated for testing purposes. No real money has been charged or paid out. 
                  This demonstrates how the platform would track your financial progress in a live environment.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-8 flex items-center space-x-3">
            <Icon icon="solar:danger-triangle-bold-duotone" width={20} className="text-red-600 flex-shrink-0" />
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* Balance Overview */}
        {walletSummary && (
          <div className="grid md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                  <Icon icon="solar:graph-up-bold-duotone" width={24} className="text-green-600" />
                </div>
                <span className="text-sm font-medium text-green-600">
                  {walletSummary.success_rate.toFixed(1)}% Success
                </span>
              </div>
              <div className="text-3xl font-bold text-gray-900 mb-1">
                {showBalances ? formatCurrency(walletSummary.total_earnings) : '••••'}
              </div>
              <div className="text-sm text-gray-600">Total Earnings</div>
              
              {/* Community Breakdown */}
              {showBalances && walletSummary.earnings_by_community && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <div className="text-xs font-medium text-gray-500 mb-2">Earnings by Community</div>
                  <div className="space-y-1 max-h-24 overflow-y-auto">
                    {walletSummary.earnings_by_community.map((item: any) => (
                      <div key={item.community_id} className="flex justify-between text-xs">
                        <span className="text-gray-600 truncate" style={{maxWidth: '70%'}}>{item.community_title || 'Community'}</span>
                        <span className="text-gray-900">${item.amount.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                  <Icon icon="solar:graph-down-bold-duotone" width={24} className="text-red-600" />
                </div>
                <span className="text-sm font-medium text-red-600">
                  {walletSummary.total_communities - walletSummary.won_communities} Lost
                </span>
              </div>
              <div className="text-3xl font-bold text-gray-900 mb-1">
                {showBalances ? formatCurrency(walletSummary.total_losses) : '••••'}
              </div>
              <div className="text-sm text-gray-600">Total Losses</div>
              
              {/* Community Breakdown */}
              {showBalances && walletSummary.losses_by_community && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <div className="text-xs font-medium text-gray-500 mb-2">Losses by Community</div>
                  <div className="space-y-1 max-h-24 overflow-y-auto">
                    {walletSummary.losses_by_community.map((item: any) => (
                      <div key={item.community_id} className="flex justify-between text-xs">
                        <span className="text-gray-600 truncate" style={{maxWidth: '70%'}}>{item.community_title || 'Community'}</span>
                        <span className="text-gray-900">${item.amount.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center">
                  <Icon icon="solar:dollar-bold-duotone" width={24} className="text-primary-600" />
                </div>
                <span className={`text-sm font-medium ${
                  walletSummary.net_balance >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  Net {walletSummary.net_balance >= 0 ? 'Profit' : 'Loss'}
                </span>
              </div>
              <div className={`text-3xl font-bold mb-1 ${
                walletSummary.net_balance >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {showBalances ? formatCurrency(walletSummary.net_balance) : '••••'}
              </div>
              <div className="text-sm text-gray-600">Net Balance</div>
              
              {/* ROI */}
              {showBalances && roiAnalysis && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-600">ROI (30 days):</span>
                    <span className={`font-medium ${
                      roiAnalysis.roi_percentage >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {roiAnalysis.roi_percentage.toFixed(1)}%
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                  <Icon icon="solar:target-bold-duotone" width={24} className="text-orange-600" />
                </div>
                <span className="text-sm font-medium text-orange-600">
                  {walletSummary.total_communities} Total
                </span>
              </div>
              <div className="text-3xl font-bold text-gray-900 mb-1">
                {showBalances ? formatCurrency(walletSummary.pending_stakes) : '••••'}
              </div>
              <div className="text-sm text-gray-600">Pending Stakes</div>
              
              {/* Active Communities */}
              {showBalances && walletSummary.active_communities && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <div className="text-xs font-medium text-gray-500 mb-2">Active Communities</div>
                  <div className="space-y-1 max-h-24 overflow-y-auto">
                    {walletSummary.active_communities.map((item: any) => (
                      <div key={item.community_id} className="flex justify-between text-xs">
                        <span className="text-gray-600 truncate" style={{maxWidth: '70%'}}>{item.community_title || 'Community'}</span>
                        <span className="text-gray-900">${item.stake_amount.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-sm mb-8">
          <div className="border-b border-gray-200">
            <div className="flex space-x-8 px-6 overflow-x-auto">
              {[
                { id: 'overview', label: 'Overview', icon: 'solar:chart-bold-duotone' },
                { id: 'transactions', label: 'Transactions', icon: 'solar:dollar-bold-duotone' },
                { id: 'analytics', label: 'Analytics', icon: 'solar:chart-2-bold-duotone' },
                { id: 'payout', label: 'Payout', icon: 'solar:card-bold-duotone' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center space-x-2 py-4 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Icon icon={tab.icon} width={18} />
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="p-6">
            {/* Overview Tab */}
            {activeTab === 'overview' && walletSummary && (
              <div className="space-y-8">
                {/* Quick Stats */}
                <div className="grid md:grid-cols-3 gap-6">
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6">
                    <div className="flex items-center space-x-3 mb-4">
                      <Icon icon="solar:medal-bold-duotone" width={24} className="text-blue-600" />
                      <h3 className="text-lg font-semibold text-blue-900">Success Rate</h3>
                    </div>
                    <div className="text-3xl font-bold text-blue-600 mb-2">
                      {walletSummary.success_rate.toFixed(1)}%
                    </div>
                    <p className="text-blue-700 text-sm">
                      {walletSummary.won_communities} of {walletSummary.total_communities} communities won
                    </p>
                  </div>

                  <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-6">
                    <div className="flex items-center space-x-3 mb-4">
                      <Icon icon="solar:bolt-bold-duotone" width={24} className="text-green-600" />
                      <h3 className="text-lg font-semibold text-green-900">ROI</h3>
                    </div>
                    <div className="text-3xl font-bold text-green-600 mb-2">
                      {roiAnalysis ? `${roiAnalysis.roi_percentage.toFixed(1)}%` : '0%'}
                    </div>
                    <p className="text-green-700 text-sm">
                      Return on investment (30 days)
                    </p>
                  </div>

                  <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-6">
                    <div className="flex items-center space-x-3 mb-4">
                      <Icon icon="solar:calendar-bold-duotone" width={24} className="text-purple-600" />
                      <h3 className="text-lg font-semibold text-purple-900">Activity</h3>
                    </div>
                    <div className="text-3xl font-bold text-purple-600 mb-2">
                      {walletSummary.recent_transactions.length}
                    </div>
                    <p className="text-purple-700 text-sm">
                      Recent transactions
                    </p>
                  </div>
                </div>

                {/* Recent Transactions Preview */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
                    <button
                      onClick={() => setActiveTab('transactions')}
                      className="text-primary-600 hover:text-primary-700 font-medium text-sm"
                    >
                      View All
                    </button>
                  </div>
                  
                  <div className="space-y-3">
                    {walletSummary.recent_transactions.slice(0, 5).map((transaction) => {
                      const iconName = getTransactionIcon(transaction.type);
                      const colorClass = getTransactionColor(transaction.type);
                      
                      return (
                        <div key={transaction.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                          <div className="flex items-center space-x-3">
                            <div className={`w-10 h-10 rounded-xl bg-white flex items-center justify-center ${colorClass}`}>
                              <Icon icon={iconName} width={20} />
                            </div>
                            <div>
                              <div className="font-medium text-gray-900">{transaction.description}</div>
                              <div className="text-sm text-gray-600">
                                {new Date(transaction.created_at).toLocaleDateString()}
                              </div>
                            </div>
                          </div>
                          <div className={`text-lg font-semibold ${
                            transaction.amount >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {transaction.amount >= 0 ? '+' : ''}{formatCurrency(Math.abs(transaction.amount))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="bg-gradient-to-r from-primary-50 to-primary-100 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-primary-900 mb-4">Quick Actions</h3>
                  <div className="flex flex-col sm:flex-row gap-4">
                    <button
                      onClick={() => setShowPaymentModal(true)}
                      className="flex items-center justify-center space-x-2 bg-primary-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-primary-700 transition-all"
                    >
                      <Icon icon="solar:card-bold-duotone" width={20} />
                      <span>Simulate Payment</span>
                    </button>
                    <button
                      onClick={() => setActiveTab('payout')}
                      className="flex items-center justify-center space-x-2 bg-white text-primary-600 border-2 border-primary-600 px-6 py-3 rounded-xl font-semibold hover:bg-primary-50 transition-all"
                    >
                      <Icon icon="solar:download-bold-duotone" width={20} />
                      <span>Request Payout</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Transactions Tab */}
            {activeTab === 'transactions' && (
              <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Transaction History</h3>
                  
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() => loadTransactions()}
                      className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
                      title="Refresh data"
                    >
                      <Icon icon="solar:refresh-bold-duotone" width={16} className={loading ? 'animate-spin' : ''} />
                    </button>
                    
                    <button className="flex items-center space-x-2 text-primary-600 hover:text-primary-700 font-medium">
                      <Icon icon="solar:download-bold-duotone" width={16} />
                      <span>Export</span>
                    </button>
                  </div>
                </div>
                
                {/* Filters */}
                <div className="bg-gray-50 rounded-xl p-4 mb-6">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {/* Transaction Type Filter */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Transaction Type</label>
                      <select
                        value={transactionFilter}
                        onChange={(e) => {
                          setTransactionFilter(e.target.value as any);
                          setPage(1); // Reset to first page on filter change
                        }}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      >
                        <option value="all">All Transactions</option>
                        <option value="earnings">Earnings Only</option>
                        <option value="payments">Payments Only</option>
                      </select>
                    </div>
                    
                    {/* Community Filter */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Community</label>
                      <select
                        value={communityFilter}
                        onChange={(e) => {
                          setCommunityFilter(e.target.value);
                          setPage(1); // Reset to first page on filter change
                        }}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      >
                        <option value="all">All Communities</option>
                        {communities.map(community => (
                          <option key={community.id} value={community.id}>
                            {community.title}
                          </option>
                        ))}
                      </select>
                    </div>
                    
                    {/* Date Range Filter */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
                      <select
                        value={dateFilter}
                        onChange={(e) => {
                          setDateFilter(e.target.value as any);
                          setPage(1); // Reset to first page on filter change
                        }}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      >
                        <option value="all">All Time</option>
                        <option value="7days">Last 7 Days</option>
                        <option value="30days">Last 30 Days</option>
                        <option value="90days">Last 90 Days</option>
                      </select>
                    </div>
                    
                    {/* Search */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="Search transactions..."
                          value={searchTerm}
                          onChange={(e) => {
                            setSearchTerm(e.target.value);
                            setPage(1); // Reset to first page on search change
                          }}
                          className="w-full px-3 py-2 pl-10 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        />
                        <Icon icon="solar:magnifer-bold-duotone" width={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  {filteredTransactions.length > 0 ? (
                    <>
                      {filteredTransactions.map((transaction) => {
                        const iconName = getTransactionIcon(transaction.type);
                        const colorClass = getTransactionColor(transaction.type);
                        const isExpanded = expandedTransaction === transaction.id;
                        
                        return (
                          <div key={transaction.id} className="bg-white border border-gray-200 rounded-xl hover:shadow-sm transition-shadow overflow-hidden">
                            {/* Transaction Header */}
                            <div 
                              className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                              onClick={() => toggleTransactionExpansion(transaction.id)}
                            >
                              <div className="flex items-center space-x-4">
                                <div className={`w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center ${colorClass}`}>
                                  <Icon icon={iconName} width={24} />
                                </div>
                                <div>
                                  <div className="font-medium text-gray-900">{transaction.description}</div>
                                  <div className="text-sm text-gray-600">
                                    {new Date(transaction.created_at).toLocaleString()}
                                  </div>
                                  <div className="text-xs text-gray-500 font-mono">
                                    ID: {transaction.transaction_id.substring(0, 8)}...
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center space-x-3">
                                <div className="text-right">
                                  <div className={`text-lg font-semibold ${
                                    transaction.amount >= 0 ? 'text-green-600' : 'text-red-600'
                                  }`}>
                                    {transaction.amount >= 0 ? '+' : ''}{formatCurrency(Math.abs(transaction.amount))}
                                  </div>
                                  <div className="text-xs text-gray-500 capitalize">
                                    {transaction.type.replace('_', ' ')}
                                  </div>
                                </div>
                                <button className="text-gray-400">
                                  <Icon icon={isExpanded ? "solar:alt-arrow-up-bold-duotone" : "solar:alt-arrow-down-bold-duotone"} width={20} />
                                </button>
                              </div>
                            </div>
                            
                            {/* Expanded Details */}
                            {isExpanded && (
                              <div className="border-t border-gray-200 p-4 bg-gray-50">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div>
                                    <h4 className="text-sm font-medium text-gray-700 mb-2">Transaction Details</h4>
                                    <div className="space-y-2 text-sm">
                                      <div className="flex justify-between">
                                        <span className="text-gray-600">Transaction ID:</span>
                                        <span className="font-mono text-gray-900">{transaction.transaction_id}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-gray-600">Date:</span>
                                        <span className="text-gray-900">{new Date(transaction.created_at).toLocaleString()}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-gray-600">Type:</span>
                                        <span className="text-gray-900 capitalize">{transaction.type.replace('_', ' ')}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-gray-600">Status:</span>
                                        <span className="text-gray-900 capitalize">{transaction.transaction_status}</span>
                                      </div>
                                    </div>
                                  </div>
                                  
                                  <div>
                                    <h4 className="text-sm font-medium text-gray-700 mb-2">Financial Impact</h4>
                                    <div className="space-y-2 text-sm">
                                      <div className="flex justify-between">
                                        <span className="text-gray-600">Amount:</span>
                                        <span className={`font-semibold ${
                                          transaction.amount >= 0 ? 'text-green-600' : 'text-red-600'
                                        }`}>
                                          {transaction.amount >= 0 ? '+' : ''}{formatCurrency(Math.abs(transaction.amount))}
                                        </span>
                                      </div>
                                      {transaction.balance_before !== undefined && (
                                        <div className="flex justify-between">
                                          <span className="text-gray-600">Balance Before:</span>
                                          <span className="text-gray-900">{formatCurrency(transaction.balance_before)}</span>
                                        </div>
                                      )}
                                      {transaction.balance_after !== undefined && (
                                        <div className="flex justify-between">
                                          <span className="text-gray-600">Balance After:</span>
                                          <span className="text-gray-900">{formatCurrency(transaction.balance_after)}</span>
                                        </div>
                                      )}
                                      {transaction.platform_fee_amount > 0 && (
                                        <div className="flex justify-between">
                                          <span className="text-gray-600">Platform Fee:</span>
                                          <span className="text-gray-900">{formatCurrency(transaction.platform_fee_amount)}</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                
                                {/* Community Information */}
                                {transaction.community_id && transaction.community_title && (
                                  <div className="mt-4 pt-4 border-t border-gray-200">
                                    <h4 className="text-sm font-medium text-gray-700 mb-2">Community Information</h4>
                                    <div className="flex justify-between items-center">
                                      <div>
                                        <div className="font-medium text-gray-900">{transaction.community_title}</div>
                                        <div className="text-sm text-gray-600">ID: {transaction.community_id}</div>
                                      </div>
                                      
                                      {transaction.type === 'reward' && (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleViewDistribution(transaction.community_id);
                                          }}
                                          className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                                        >
                                          View Distribution Details
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                )}
                                
                                {/* Additional Metadata */}
                                {transaction.metadata && Object.keys(transaction.metadata).length > 0 && (
                                  <div className="mt-4 pt-4 border-t border-gray-200">
                                    <h4 className="text-sm font-medium text-gray-700 mb-2">Additional Information</h4>
                                    <div className="bg-gray-100 p-3 rounded-lg">
                                      <pre className="text-xs text-gray-800 overflow-x-auto">
                                        {JSON.stringify(transaction.metadata, null, 2)}
                                      </pre>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      
                      {/* Pagination */}
                      {totalPages > 1 && (
                        <div className="flex items-center justify-between mt-6">
                          <div className="text-sm text-gray-600">
                            Page {page} of {totalPages}
                          </div>
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handlePageChange(page - 1)}
                              disabled={page === 1}
                              className="px-3 py-1 border border-gray-300 rounded-md text-sm text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Previous
                            </button>
                            <button
                              onClick={() => handlePageChange(page + 1)}
                              disabled={page === totalPages}
                              className="px-3 py-1 border border-gray-300 rounded-md text-sm text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Next
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-12 bg-white rounded-xl shadow-sm">
                      <Icon icon="solar:dollar-bold-duotone" width={48} className="mx-auto mb-4 text-gray-400" />
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">No Transactions Found</h3>
                      <p className="text-gray-600">
                        {transactionFilter === 'all' && communityFilter === 'all' && dateFilter === 'all' && !searchTerm
                          ? 'No transactions yet. Join communities to start your financial journey!'
                          : 'No transactions match your current filters. Try adjusting your search criteria.'
                        }
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Analytics Tab */}
            {activeTab === 'analytics' && (
              <div className="space-y-8">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">Financial Analytics</h3>
                  
                  <select
                    value={roiPeriod}
                    onChange={(e) => setROIPeriod(parseInt(e.target.value))}
                    className="px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  >
                    <option value={7}>Last 7 days</option>
                    <option value={30}>Last 30 days</option>
                    <option value={90}>Last 90 days</option>
                    <option value={365}>Last year</option>
                  </select>
                </div>

                <WalletAnalytics className="" />
              </div>
            )}

            {/* Payout Tab */}
            {activeTab === 'payout' && (
              <div className="space-y-8">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Payout Settings</h3>
                  
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-6">
                    <div className="flex items-start space-x-3">
                      <Icon icon="solar:danger-triangle-bold-duotone" width={20} className="text-blue-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-sm font-semibold text-blue-800 mb-1">Testing Mode</h4>
                        <p className="text-sm text-blue-700">
                          Payout functionality is simulated for testing. In production, you would connect real payment methods and receive actual payouts.
                        </p>
                        <p className="text-sm text-blue-700 mt-2">
                          <strong>Important Notice:</strong> All payouts are manually processed during the MVP phase. Processing times may vary and are typically completed within 5-7 business days.
                        </p>
                      </div>
                    </div>
                  </div>

                  {walletSummary && (
                    <PayoutRequestForm
                      availableBalance={walletSummary.net_balance}
                      onSuccess={loadWalletData}
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Payment Simulation Modal */}
      <PaymentSimulation
        isOpen={showPaymentModal}
        amount={50} // Demo amount
        description="Demo stake payment"
        onSuccess={handlePaymentSuccess}
        onCancel={() => setShowPaymentModal(false)}
      />
      
      {/* Earnings Distribution Modal */}
      {selectedCommunityId && (
        <EarningsDistributionModal
          communityId={selectedCommunityId}
          isOpen={showDistributionModal}
          onClose={() => setShowDistributionModal(false)}
        />
      )}
    </div>
  );
}