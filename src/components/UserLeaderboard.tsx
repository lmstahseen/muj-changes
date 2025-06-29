import React, { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { useAuth } from '../contexts/AuthContext';
import gamificationService, { LeaderboardPosition } from '../services/gamificationService';

interface UserLeaderboardProps {
  userPositions?: LeaderboardPosition[];
  className?: string;
}

export function UserLeaderboard({ userPositions, className = '' }: UserLeaderboardProps) {
  const { user } = useAuth();
  const [leaderboardType, setLeaderboardType] = useState<'earnings' | 'hours' | 'streak' | 'communities_won'>('earnings');
  const [leaderboardPeriod, setLeaderboardPeriod] = useState<'all_time' | 'monthly' | 'weekly'>('all_time');
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  useEffect(() => {
    loadLeaderboard();
  }, [leaderboardType, leaderboardPeriod]);

  const loadLeaderboard = async () => {
    setLoading(true);
    setError('');
    
    try {
      const result = await gamificationService.getLeaderboard(
        leaderboardType,
        leaderboardPeriod
      );
      
      if (result.success) {
        setLeaderboard(result.leaderboard || []);
        setLastUpdated(result.lastUpdated || null);
      } else {
        setError(result.error || 'Failed to load leaderboard');
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const getLeaderboardIcon = (type: string) => {
    switch (type) {
      case 'earnings': return 'solar:dollar-bold-duotone';
      case 'hours': return 'solar:clock-circle-bold-duotone';
      case 'streak': return 'solar:bolt-bold-duotone';
      case 'communities_won': return 'solar:cup-star-bold-duotone';
      default: return 'solar:cup-star-bold-duotone';
    }
  };

  const getLeaderboardTitle = (type: string) => {
    switch (type) {
      case 'earnings': return 'Top Earners';
      case 'hours': return 'Most Hours Logged';
      case 'streak': return 'Longest Streaks';
      case 'communities_won': return 'Most Communities Won';
      default: return 'Leaderboard';
    }
  };

  const formatValue = (type: string, value: number) => {
    switch (type) {
      case 'earnings': return `$${value.toFixed(2)}`;
      case 'hours': return `${value.toFixed(1)} hrs`;
      case 'streak': return `${value} days`;
      case 'communities_won': return value.toString();
      default: return value.toString();
    }
  };

  const getUserPosition = () => {
    if (!userPositions) return null;
    
    return userPositions.find(pos => 
      pos.leaderboard_type === leaderboardType && 
      pos.period === leaderboardPeriod
    );
  };

  const userPosition = getUserPosition();

  return (
    <div className={className}>
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-gray-900 flex items-center space-x-2">
            <Icon icon="solar:cup-star-bold-duotone" width={20} className="text-primary-600" />
            <span>Community Leaderboard</span>
          </h3>
          
          <div className="flex space-x-2">
            {/* Leaderboard Type Selector */}
            <select
              value={leaderboardType}
              onChange={(e) => setLeaderboardType(e.target.value as any)}
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="earnings">Earnings</option>
              <option value="hours">Hours Logged</option>
              <option value="streak">Streaks</option>
              <option value="communities_won">Communities Won</option>
            </select>
            
            {/* Period Selector */}
            <select
              value={leaderboardPeriod}
              onChange={(e) => setLeaderboardPeriod(e.target.value as any)}
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="all_time">All Time</option>
              <option value="monthly">This Month</option>
              <option value="weekly">This Week</option>
            </select>
          </div>
        </div>
        
        <h4 className="font-medium text-gray-900 mb-4">
          {getLeaderboardTitle(leaderboardType)}
          {lastUpdated && (
            <span className="text-xs text-gray-500 ml-2">
              Updated {new Date(lastUpdated).toLocaleString()}
            </span>
          )}
        </h4>
        
        {loading ? (
          <div className="text-center py-8">
            <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto mb-2"></div>
            <p className="text-gray-600">Loading leaderboard...</p>
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <p className="text-red-600">{error}</p>
          </div>
        ) : leaderboard.length === 0 ? (
          <div className="text-center py-8">
            <Icon icon="solar:cup-star-bold-duotone" width={48} className="mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Data Available</h3>
            <p className="text-gray-600">
              Leaderboard data will appear as users participate in communities.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {leaderboard.slice(0, 10).map((entry) => (
              <div 
                key={entry.rank} 
                className={`flex items-center space-x-4 p-3 rounded-xl transition-all ${
                  entry.user_id === user?.id 
                    ? 'bg-primary-50 border-2 border-primary-200' 
                    : 'bg-gray-50 hover:bg-gray-100'
                }`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                  entry.rank === 1 ? 'bg-yellow-100 text-yellow-800' :
                  entry.rank === 2 ? 'bg-gray-100 text-gray-800' :
                  entry.rank === 3 ? 'bg-orange-100 text-orange-800' :
                  'bg-white text-gray-600'
                }`}>
                  {entry.rank}
                </div>
                
                <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-lg">
                  {entry.user_avatar || '👤'}
                </div>
                
                <div className="flex-1">
                  <div className={`font-medium ${entry.user_id === user?.id ? 'text-primary-900' : 'text-gray-900'}`}>
                    {entry.user_id === user?.id ? 'You' : entry.user_name || `User #${entry.rank}`}
                  </div>
                  <div className={`text-sm ${entry.user_id === user?.id ? 'text-primary-600' : 'text-gray-600'}`}>
                    {formatValue(leaderboardType, entry.value)}
                  </div>
                </div>
                
                {entry.rank <= 3 && (
                  <div className="text-2xl">
                    {entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : '🥉'}
                  </div>
                )}
                
                {entry.previous_rank && entry.previous_rank !== entry.rank && (
                  <div className={`text-xs ${
                    entry.previous_rank > entry.rank ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {entry.previous_rank > entry.rank ? '↑' : '↓'} 
                    {Math.abs(entry.previous_rank - entry.rank)}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        
        {/* User's Position */}
        {userPosition && (
          <div className="mt-6 p-4 bg-primary-50 rounded-xl">
            <div className="flex items-center space-x-2 text-primary-700">
              <Icon icon="solar:cup-star-bold-duotone" width={16} />
              <span className="text-sm font-medium">
                You're ranked #{userPosition.rank} out of {userPosition.total_users} users!
              </span>
            </div>
            {userPosition.rank > 10 && (
              <p className="text-xs text-primary-600 mt-1">
                Keep going! You're just {userPosition.rank - 10} positions away from the top 10.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}