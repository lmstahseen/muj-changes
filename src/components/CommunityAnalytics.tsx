import React, { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { useAuth } from '../contexts/AuthContext';
import communityService, { CommunityAnalytics as CommunityAnalyticsType } from '../services/communityService';

interface CommunityAnalyticsProps {
  communityId: string;
  className?: string;
}

export function CommunityAnalytics({ communityId, className = '' }: CommunityAnalyticsProps) {
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState<CommunityAnalyticsType | null>(null);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (communityId) {
      loadAnalyticsData();
      loadLeaderboard();
    }
  }, [communityId]);

  const loadAnalyticsData = async () => {
    setLoading(true);
    setError('');
    
    try {
      const { data: analyticsData } = await supabase
        .from('community_analytics')
        .select('*')
        .eq('community_id', communityId)
        .order('date', { ascending: false })
        .limit(1)
        .single();
      
      if (analyticsData) {
        setAnalytics(analyticsData);
      }
    } catch (err) {
      setError('Failed to load analytics data');
      console.error('Error loading analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadLeaderboard = async () => {
    try {
      const result = await communityService.getCommunityLeaderboard(communityId);
      if (result.success && result.leaderboard) {
        setLeaderboard(result.leaderboard);
      }
    } catch (err) {
      console.error('Error loading leaderboard:', err);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      loadAnalyticsData(),
      loadLeaderboard()
    ]);
    setRefreshing(false);
  };

  if (loading && !analytics) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto mb-2"></div>
          <p className="text-gray-600">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-3">
          <Icon icon="solar:danger-triangle-bold-duotone" size={20} className="text-red-600 flex-shrink-0" />
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-gray-900 flex items-center space-x-2">
            <Icon icon="solar:chart-bold-duotone" width={20} className="text-primary-600" />
            <span>Community Analytics</span>
          </h3>
          
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
            title="Refresh data"
          >
            <Icon icon="solar:refresh-bold-duotone" width={16} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>

        {analytics ? (
          <div className="space-y-8">
            {/* Key Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-blue-50 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-blue-600 mb-1">{analytics.active_members}/{analytics.total_members}</div>
                <div className="text-sm text-blue-700">Active Members</div>
              </div>
              <div className="bg-green-50 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-green-600 mb-1">{analytics.total_meetings_held}</div>
                <div className="text-sm text-green-700">Meetings Held</div>
              </div>
              <div className="bg-purple-50 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-purple-600 mb-1">{analytics.average_attendance_rate.toFixed(1)}%</div>
                <div className="text-sm text-purple-700">Attendance Rate</div>
              </div>
              <div className="bg-orange-50 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-orange-600 mb-1">{analytics.total_hours_logged.toFixed(1)}</div>
                <div className="text-sm text-orange-700">Total Hours</div>
              </div>
            </div>

            {/* Completion Progress */}
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-600">Community Completion</span>
                <span className="font-medium text-gray-900">{analytics.completion_rate.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div 
                  className="bg-gradient-to-r from-primary-500 to-primary-600 h-2.5 rounded-full"
                  style={{ width: `${Math.min(100, analytics.completion_rate)}%` }}
                ></div>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Average progress across all community members
              </p>
            </div>

            {/* Leaderboard */}
            <div>
              <h4 className="font-medium text-gray-900 mb-4">Community Leaderboard</h4>
              
              {leaderboard.length > 0 ? (
                <div className="space-y-3">
                  {leaderboard.slice(0, 5).map((member) => (
                    <div 
                      key={member.user_id} 
                      className={`flex items-center justify-between p-3 rounded-lg ${
                        member.user_id === user?.id 
                          ? 'bg-primary-50 border border-primary-200' 
                          : 'bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                          member.rank === 1 ? 'bg-yellow-100 text-yellow-800' :
                          member.rank === 2 ? 'bg-gray-100 text-gray-800' :
                          member.rank === 3 ? 'bg-orange-100 text-orange-800' :
                          'bg-white text-gray-600'
                        }`}>
                          {member.rank}
                        </div>
                        
                        <div>
                          <div className={`font-medium ${member.user_id === user?.id ? 'text-primary-900' : 'text-gray-900'}`}>
                            {member.user_id === user?.id ? 'You' : `Member #${member.rank}`}
                            {member.is_creator && (
                              <span className="ml-2 text-yellow-600">👑</span>
                            )}
                          </div>
                          <div className="text-xs text-gray-600">
                            {member.total_meeting_hours.toFixed(1)} hours • {member.progress_percentage.toFixed(0)}% complete
                          </div>
                        </div>
                      </div>
                      
                      <div className="w-16 bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full ${
                            member.user_id === user?.id 
                              ? 'bg-primary-600' 
                              : 'bg-gradient-to-r from-blue-500 to-purple-600'
                          }`}
                          style={{ width: `${Math.min(100, member.progress_percentage)}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 bg-gray-50 rounded-lg">
                  <Icon icon="solar:medal-bold-duotone" width={32} className="mx-auto mb-2 text-gray-400" />
                  <p className="text-gray-600">No leaderboard data available yet</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-12">
            <Icon icon="solar:chart-bold-duotone" width={48} className="mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Analytics Available</h3>
            <p className="text-gray-600">
              Analytics will be available once the community becomes active and members start participating.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}