import React, { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { useAuth } from '../contexts/AuthContext';
import walletService from '../services/walletService';

interface EarningsDistributionModalProps {
  communityId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function EarningsDistributionModal({ communityId, isOpen, onClose }: EarningsDistributionModalProps) {
  const { user } = useAuth();
  const [distribution, setDistribution] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isUserWinner, setIsUserWinner] = useState(false);

  useEffect(() => {
    if (isOpen && communityId) {
      loadDistributionData();
    }
  }, [isOpen, communityId]);

  const loadDistributionData = async () => {
    if (!communityId) return;
    
    setLoading(true);
    setError('');
    
    try {
      const result = await walletService.getCommunityDistribution(communityId);
      if (result.success && result.distribution) {
        setDistribution(result.distribution);
        
        // Check if current user is a winner
        if (user && result.distribution.distribution_criteria?.winners) {
          const winners = result.distribution.distribution_criteria.winners;
          setIsUserWinner(winners.some((winner: any) => winner.user_id === user.id));
        }
      } else {
        setError('Distribution data not available');
      }
    } catch (err) {
      setError('Failed to load distribution data');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
              <Icon icon="solar:medal-bold-duotone" width={20} className="text-primary-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Community Earnings Distribution</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <Icon icon="solar:close-circle-bold-duotone" width={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {loading ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600">Loading distribution data...</p>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <Icon icon="solar:danger-triangle-bold-duotone" width={48} className="text-yellow-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Distribution Not Available</h3>
              <p className="text-gray-600">{error}</p>
            </div>
          ) : distribution ? (
            <div className="space-y-6">
              {/* Distribution Status */}
              <div className={`p-4 rounded-xl ${
                distribution.distribution_status === 'distributed' 
                  ? 'bg-green-50 border border-green-200' 
                  : 'bg-yellow-50 border border-yellow-200'
              }`}>
                <div className="flex items-center space-x-2 mb-2">
                  {distribution.distribution_status === 'distributed' ? (
                    <Icon icon="solar:check-circle-bold-duotone" width={20} className="text-green-600" />
                  ) : (
                    <Icon icon="solar:info-circle-bold-duotone" width={20} className="text-yellow-600" />
                  )}
                  <h3 className={`font-medium ${
                    distribution.distribution_status === 'distributed' 
                      ? 'text-green-800' 
                      : 'text-yellow-800'
                  }`}>
                    {distribution.distribution_status === 'distributed' 
                      ? 'Distribution Complete' 
                      : 'Distribution Pending'}
                  </h3>
                </div>
                <p className={`text-sm ${
                  distribution.distribution_status === 'distributed' 
                    ? 'text-green-700' 
                    : 'text-yellow-700'
                }`}>
                  {distribution.distribution_status === 'distributed' 
                    ? `Earnings were distributed on ${new Date(distribution.distribution_date).toLocaleDateString()}.` 
                    : 'Earnings will be distributed when the community ends.'}
                </p>
              </div>

              {/* Distribution Summary */}
              <div>
                <h3 className="font-medium text-gray-900 mb-3">Distribution Summary</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-gray-50 rounded-xl p-4">
                    <div className="flex items-center space-x-2 mb-2">
                      <Icon icon="solar:dollar-bold-duotone" width={16} className="text-gray-600" />
                      <span className="text-sm font-medium text-gray-900">Financial Breakdown</span>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Total Stake Pool:</span>
                        <span className="font-medium text-gray-900">{formatCurrency(distribution.total_stake_pool)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Platform Fee (10%):</span>
                        <span className="font-medium text-gray-900">{formatCurrency(distribution.platform_fee_amount)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Distributable Amount:</span>
                        <span className="font-medium text-gray-900">{formatCurrency(distribution.distributable_amount)}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 rounded-xl p-4">
                    <div className="flex items-center space-x-2 mb-2">
                      <Icon icon="solar:users-group-rounded-bold-duotone" width={16} className="text-gray-600" />
                      <span className="text-sm font-medium text-gray-900">Winner Statistics</span>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Total Winners:</span>
                        <span className="font-medium text-gray-900">{distribution.winner_count}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Reward Per Winner:</span>
                        <span className="font-medium text-gray-900">{formatCurrency(distribution.reward_per_winner)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Success Rate:</span>
                        <span className="font-medium text-gray-900">
                          {Math.round((distribution.winner_count / (distribution.distribution_criteria?.winners?.length || 1)) * 100)}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* User Result */}
              {user && (
                <div className={`p-6 rounded-xl ${
                  isUserWinner 
                    ? 'bg-green-50 border border-green-200' 
                    : 'bg-red-50 border border-red-200'
                }`}>
                  <div className="flex items-center space-x-3 mb-4">
                    {isUserWinner ? (
                      <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                        <Icon icon="solar:graph-up-bold-duotone" width={24} className="text-green-600" />
                      </div>
                    ) : (
                      <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                        <Icon icon="solar:graph-down-bold-duotone" width={24} className="text-red-600" />
                      </div>
                    )}
                    <div>
                      <h3 className={`text-lg font-semibold ${
                        isUserWinner ? 'text-green-900' : 'text-red-900'
                      }`}>
                        {isUserWinner ? 'Congratulations!' : 'Better Luck Next Time'}
                      </h3>
                      <p className={`text-sm ${
                        isUserWinner ? 'text-green-700' : 'text-red-700'
                      }`}>
                        {isUserWinner 
                          ? `You successfully completed your goals and earned ${formatCurrency(distribution.reward_per_winner)}!` 
                          : 'You did not meet the criteria to earn rewards in this community.'}
                      </p>
                    </div>
                  </div>
                  
                  {isUserWinner && (
                    <div className="bg-white rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Your Reward:</span>
                        <span className="text-xl font-bold text-green-600">{formatCurrency(distribution.reward_per_winner)}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Winning Criteria */}
              <div>
                <h3 className="font-medium text-gray-900 mb-3">Winning Criteria</h3>
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="text-sm text-gray-700 space-y-2">
                    <p>To qualify for rewards, members needed to meet at least one of these criteria:</p>
                    <ul className="list-disc pl-5 space-y-1">
                      <li>Complete at least {distribution.distribution_criteria?.min_meeting_hours?.toFixed(1) || '80%'} hours of meeting time</li>
                      <li>Achieve at least 80% progress on community goals</li>
                      <li>Not be disqualified due to rule violations</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <Icon icon="solar:danger-triangle-bold-duotone" width={48} className="text-yellow-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Distribution Data</h3>
              <p className="text-gray-600">Distribution information will be available when the community ends.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}