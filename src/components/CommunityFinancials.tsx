import React, { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { useAuth } from '../contexts/AuthContext';
import walletService from '../services/walletService';
import communityService from '../services/communityService';
import { Community, formatStakeAmount } from '../lib/supabase';

interface CommunityFinancialsProps {
  community: Community;
  isUserMember: boolean;
  className?: string;
}

export function CommunityFinancials({ community, isUserMember, className = '' }: CommunityFinancialsProps) {
  const { user } = useAuth();
  const [distribution, setDistribution] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (community.status === 'ended') {
      loadDistributionData();
    }
  }, [community.id, community.status]);

  const loadDistributionData = async () => {
    if (!community) return;
    
    setLoading(true);
    setError('');
    
    try {
      const result = await walletService.getCommunityDistribution(community.id);
      if (result.success && result.distribution) {
        setDistribution(result.distribution);
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

  const calculatePotentialEarnings = () => {
    const stakeAmount = community.stake_amount / 100; // Convert from cents
    const totalMembers = community.member_count || 0;
    const totalStakePool = stakeAmount * totalMembers;
    const platformFee = totalStakePool * 0.1; // 10% platform fee
    const distributableAmount = totalStakePool - platformFee;
    
    // Assume 50% success rate for potential earnings calculation
    const estimatedWinners = Math.ceil(totalMembers * 0.5);
    const potentialEarnings = estimatedWinners > 0 
      ? distributableAmount / estimatedWinners 
      : 0;
    
    return {
      totalStakePool,
      platformFee,
      distributableAmount,
      estimatedWinners,
      potentialEarnings
    };
  };

  const potentialEarnings = calculatePotentialEarnings();

  return (
    <div className={className}>
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-xl font-semibold text-gray-900 mb-6 flex items-center space-x-2">
          <Icon icon="solar:dollar-bold-duotone" width={20} className="text-primary-600" />
          <span>Financial Overview</span>
        </h3>

        {/* Stake Information */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-medium text-gray-900">Stake Details</h4>
            <span className="text-sm text-gray-600">
              {community.member_count || 0} members
            </span>
          </div>
          
          <div className="bg-gray-50 rounded-xl p-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-gray-600 mb-1">Individual Stake</div>
                <div className="text-xl font-bold text-gray-900">
                  ${formatStakeAmount(community.stake_amount)}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600 mb-1">Total Stake Pool</div>
                <div className="text-xl font-bold text-gray-900">
                  ${formatCurrency(potentialEarnings.totalStakePool)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Distribution Information */}
        {community.status === 'ended' && distribution ? (
          <div className="mb-6">
            <h4 className="font-medium text-gray-900 mb-3">Distribution Results</h4>
            
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
              <div className="flex items-center space-x-2 mb-2">
                <Icon icon="solar:medal-bold-duotone" width={16} className="text-green-600" />
                <span className="text-sm font-medium text-green-800">Distribution Complete</span>
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-green-700 mb-1">Winners</div>
                  <div className="font-semibold text-green-900">{distribution.winner_count} members</div>
                </div>
                <div>
                  <div className="text-green-700 mb-1">Reward Per Winner</div>
                  <div className="font-semibold text-green-900">{formatCurrency(distribution.reward_per_winner)}</div>
                </div>
                <div>
                  <div className="text-green-700 mb-1">Total Distributed</div>
                  <div className="font-semibold text-green-900">{formatCurrency(distribution.distributable_amount)}</div>
                </div>
                <div>
                  <div className="text-green-700 mb-1">Platform Fee</div>
                  <div className="font-semibold text-green-900">{formatCurrency(distribution.platform_fee_amount)}</div>
                </div>
              </div>
            </div>
          </div>
        ) : community.status === 'ended' ? (
          <div className="mb-6">
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-center space-x-3">
              <Icon icon="solar:clock-circle-bold-duotone" width={20} className="text-yellow-600 flex-shrink-0" />
              <div>
                <h4 className="font-medium text-yellow-800">Distribution Pending</h4>
                <p className="text-sm text-yellow-700">
                  Earnings distribution is being processed. Results will appear here soon.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="mb-6">
            <h4 className="font-medium text-gray-900 mb-3">Potential Earnings</h4>
            
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-blue-700 mb-1">Platform Fee (10%)</div>
                  <div className="font-semibold text-blue-900">{formatCurrency(potentialEarnings.platformFee)}</div>
                </div>
                <div>
                  <div className="text-blue-700 mb-1">Distributable Amount</div>
                  <div className="font-semibold text-blue-900">{formatCurrency(potentialEarnings.distributableAmount)}</div>
                </div>
                <div>
                  <div className="text-blue-700 mb-1">Estimated Winners</div>
                  <div className="font-semibold text-blue-900">{potentialEarnings.estimatedWinners} members</div>
                </div>
                <div>
                  <div className="text-blue-700 mb-1">Potential Earnings</div>
                  <div className="font-semibold text-blue-900">{formatCurrency(potentialEarnings.potentialEarnings)}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Winning Criteria */}
        <div className="mb-6">
          <h4 className="font-medium text-gray-900 mb-3">Winning Criteria</h4>
          
          <div className="bg-gray-50 rounded-xl p-4">
            <ul className="space-y-2 text-sm text-gray-700">
              <li className="flex items-start space-x-2">
                <Icon icon="solar:graph-up-bold-duotone" width={16} className="text-green-600 mt-0.5 flex-shrink-0" />
                <span>Complete at least 80% of required hours ({(community.daily_hours * 0.8).toFixed(1)} hours daily)</span>
              </li>
              <li className="flex items-start space-x-2">
                <Icon icon="solar:users-group-rounded-bold-duotone" width={16} className="text-blue-600 mt-0.5 flex-shrink-0" />
                <span>Attend community meetings regularly</span>
              </li>
              <li className="flex items-start space-x-2">
                <Icon icon="solar:shield-bold-duotone" width={16} className="text-red-600 mt-0.5 flex-shrink-0" />
                <span>Avoid disqualification due to rule violations</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <div className="flex items-start space-x-3">
            <Icon icon="solar:info-circle-bold-duotone" width={16} className="text-yellow-600 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="text-sm font-medium text-yellow-800">Simulation Notice</h4>
              <p className="text-xs text-yellow-700 mt-1">
                All financial transactions are simulated for testing purposes. No real money is processed.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}