import React, { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { useAuth } from '../contexts/AuthContext';
import communityService, { MemberProgress } from '../services/communityService';

interface CommunityProgressTrackerProps {
  communityId: string;
  totalMinimumHours: number;
  className?: string;
}

export function CommunityProgressTracker({ communityId, totalMinimumHours, className = '' }: CommunityProgressTrackerProps) {
  const { user } = useAuth();
  const [progressHistory, setProgressHistory] = useState<MemberProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (user && communityId) {
      loadProgressHistory();
    }
  }, [user, communityId]);

  const loadProgressHistory = async () => {
    if (!user) return;
    
    setLoading(true);
    setError('');
    
    try {
      const { data: history } = await supabase
        .from('member_progress')
        .select('*')
        .eq('community_id', communityId)
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .limit(30);
      
      if (history) {
        setProgressHistory(history);
      }
    } catch (err) {
      setError('Failed to load progress history');
      console.error('Error loading progress history:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadProgressHistory();
    setRefreshing(false);
  };

  const getTotalStats = () => {
    const totalHours = progressHistory.reduce((sum, day) => sum + (day.hours_logged || 0), 0);
    const totalGoals = progressHistory.reduce((sum, day) => sum + (day.goals_completed || 0), 0);
    const daysWithProgress = progressHistory.length;
    const daysGoalMet = progressHistory.filter(day => day.daily_goal_met).length;
    
    return {
      totalHours,
      totalGoals,
      daysWithProgress,
      daysGoalMet,
      goalMetPercentage: daysWithProgress > 0 ? (daysGoalMet / daysWithProgress) * 100 : 0
    };
  };

  const stats = getTotalStats();
  const dailyGoalThreshold = totalMinimumHours / 30; // Assuming 30 days per month on average

  if (loading && progressHistory.length === 0) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto mb-2"></div>
          <p className="text-gray-600">Loading progress history...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-3">
          <Icon icon="solar:danger-triangle-bold-duotone" width={20} className="text-red-600 flex-shrink-0" />
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {/* Progress Summary */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
            <Icon icon="solar:graph-up-bold-duotone" width={20} className="text-primary-600" />
            <span>Progress Summary</span>
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

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-50 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-blue-600 mb-1">{stats.totalHours.toFixed(1)}</div>
            <div className="text-sm text-blue-700">Total Hours</div>
          </div>
          <div className="bg-green-50 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-green-600 mb-1">{stats.totalGoals}</div>
            <div className="text-sm text-green-700">Goals Completed</div>
          </div>
          <div className="bg-purple-50 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-purple-600 mb-1">{stats.daysWithProgress}</div>
            <div className="text-sm text-purple-700">Days Logged</div>
          </div>
          <div className="bg-orange-50 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-orange-600 mb-1">{stats.goalMetPercentage.toFixed(0)}%</div>
            <div className="text-sm text-orange-700">Daily Goals Met</div>
          </div>
        </div>

        {/* Progress Toward Minimum Hours */}
        <div className="mb-6">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-600">Progress toward minimum hours</span>
            <span className="font-medium text-gray-900">
              {stats.totalHours.toFixed(1)}/{totalMinimumHours} hours
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div 
              className="bg-gradient-to-r from-primary-500 to-primary-600 h-2.5 rounded-full"
              style={{ width: `${Math.min(100, (stats.totalHours / totalMinimumHours) * 100)}%` }}
            ></div>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            You need to log at least {dailyGoalThreshold.toFixed(1)} hours per day on average to meet your goal
          </p>
        </div>
      </div>

      {/* Progress History */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
          <Icon icon="solar:calendar-bold-duotone" width={20} className="text-primary-600" />
          <span>Progress History</span>
        </h3>

        {progressHistory.length > 0 ? (
          <div className="overflow-hidden rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hours</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Goals</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {progressHistory.map((day) => (
                  <tr key={day.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(day.date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {day.hours_logged.toFixed(1)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {day.goals_completed}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        day.daily_goal_met 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {day.daily_goal_met ? 'Goal Met' : 'Partial'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 bg-gray-50 rounded-lg">
            <Icon icon="solar:chart-bold-duotone" width={48} className="mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Progress Logged Yet</h3>
            <p className="text-gray-600 mb-4">
              Start logging your daily progress to track your journey toward your goals.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}