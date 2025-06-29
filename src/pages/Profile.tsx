import React, { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { useAuth } from '../contexts/AuthContext';
import communityService from '../services/communityService';
import meetingService from '../services/meetingService';
import gamificationService, { UserGamificationData, UserBadge, LeaderboardPosition } from '../services/gamificationService';
import { Community, Earning } from '../lib/supabase';
import { UserAchievements } from '../components/UserAchievements';
import { UserLeaderboard } from '../components/UserLeaderboard';
import { StreakDisplay } from '../components/StreakDisplay';

export function Profile() {
  const { user } = useAuth();
  const [userCommunities, setUserCommunities] = useState<Community[]>([]);
  const [userEarnings, setUserEarnings] = useState<Earning[]>([]);
  const [meetingStats, setMeetingStats] = useState({
    totalMeetings: 0,
    totalDuration: 0,
    screenSharePercentage: 0
  });
  const [gamificationData, setGamificationData] = useState<UserGamificationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'achievements' | 'communities' | 'statistics'>('overview');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    stats: true,
    streak: true,
    activity: true
  });

  useEffect(() => {
    if (user) {
      loadUserData();
    }
  }, [user]);

  const loadUserData = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      // Load user's communities
      const communitiesResult = await communityService.getUserCommunities(user.id);
      if (communitiesResult.success && communitiesResult.communities) {
        setUserCommunities(communitiesResult.communities);
      }

      // Load user's earnings
      const earningsResult = await communityService.getUserEarnings(user.id);
      if (earningsResult.success && earningsResult.earnings) {
        setUserEarnings(earningsResult.earnings);
      }

      // Load meeting statistics
      const meetingStatsResult = await meetingService.getUserMeetingStats(user.id);
      if (meetingStatsResult.success && meetingStatsResult.stats) {
        setMeetingStats(meetingStatsResult.stats);
      }

      // Load gamification data
      const gamificationResult = await gamificationService.getUserGamificationData(user.id);
      if (gamificationResult.success && gamificationResult.data) {
        setGamificationData(gamificationResult.data);
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadUserData();
    setRefreshing(false);
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const stats = gamificationData?.statistics || {
    total_hours_logged: 0,
    communities_joined: 0,
    communities_won: 0,
    communities_lost: 0,
    total_earnings: 0,
    total_losses: 0,
    longest_streak: 0,
    current_streak: 0,
    meetings_attended: 0,
    goals_completed: 0,
    success_rate: 0,
    platform_tenure_days: 0
  };

  const badges = gamificationData?.badges || [];
  const leaderboardPositions = gamificationData?.leaderboard_positions || [];

  const recentActivity = userEarnings
    .slice(0, 5)
    .map(earning => ({
      id: earning.id,
      type: earning.type === 'reward' ? 'completed' : earning.type === 'stake_payment' ? 'joined' : 'milestone',
      description: earning.description,
      date: earning.created_at,
      points: Math.abs(earning.amount / 100)
    }));

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'completed': return 'solar:cup-star-bold-duotone';
      case 'joined': return 'solar:users-group-rounded-bold-duotone';
      case 'milestone': return 'solar:target-bold-duotone';
      case 'badge': return 'solar:star-bold-duotone';
      default: return 'solar:calendar-bold-duotone';
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'completed': return 'text-green-600';
      case 'joined': return 'text-blue-600';
      case 'milestone': return 'text-purple-600';
      case 'badge': return 'text-yellow-600';
      default: return 'text-gray-600';
    }
  };

  if (loading && !gamificationData) {
    return (
      <div className="pt-20 min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-20 min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Profile Header */}
        <div className="bg-white rounded-xl shadow-sm p-8 mb-8">
          <div className="flex flex-col md:flex-row md:items-start space-y-4 md:space-y-0 md:space-x-6">
            <div className="w-24 h-24 bg-primary-100 rounded-full flex items-center justify-center text-4xl">
              {user?.avatar || '👤'}
            </div>
            
            <div className="text-center md:text-left flex-1">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900 mb-2">{user?.name || 'John Doe'}</h1>
                  <p className="text-gray-600 mb-4">Goal achiever and community builder</p>
                </div>
                
                <div className="flex items-center space-x-3">
                  <button
                    onClick={handleRefresh}
                    disabled={refreshing}
                    className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
                    title="Refresh data"
                  >
                    <Icon icon="solar:refresh-bold-duotone" width={16} className={refreshing ? 'animate-spin' : ''} />
                  </button>
                  
                  <button
                    className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
                    title="Edit profile"
                  >
                    <Icon icon="solar:pen-bold-duotone" width={16} />
                  </button>
                  
                  <button
                    className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
                    title="Settings"
                  >
                    <Icon icon="solar:settings-bold-duotone" width={16} />
                  </button>
                </div>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary-600">{stats.current_streak}</div>
                  <div className="text-sm text-gray-600">Day Streak</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary-600">{stats.total_hours_logged.toFixed(1)}</div>
                  <div className="text-sm text-gray-600">Hours Logged</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary-600">{stats.communities_joined}</div>
                  <div className="text-sm text-gray-600">Communities</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary-600">{stats.communities_won}</div>
                  <div className="text-sm text-gray-600">Goals Won</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary-600">${stats.total_earnings.toFixed(0)}</div>
                  <div className="text-sm text-gray-600">Total Earned</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary-600">{stats.success_rate.toFixed(0)}%</div>
                  <div className="text-sm text-gray-600">Success Rate</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-sm mb-8">
          <div className="border-b border-gray-200">
            <div className="flex space-x-8 px-6 overflow-x-auto">
              {[
                { id: 'overview', label: 'Overview', icon: 'solar:graph-up-bold-duotone' },
                { id: 'achievements', label: 'Achievements', icon: 'solar:cup-star-bold-duotone' },
                { id: 'communities', label: 'Communities', icon: 'solar:users-group-rounded-bold-duotone' },
                { id: 'statistics', label: 'Statistics', icon: 'solar:chart-bold-duotone' }
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
            {activeTab === 'overview' && (
              <div className="space-y-8">
                {/* Streak Section */}
                <div className="bg-white rounded-xl">
                  <div 
                    className="flex items-center justify-between cursor-pointer"
                    onClick={() => toggleSection('streak')}
                  >
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
                      <Icon icon="solar:bolt-bold-duotone" width={20} className="text-primary-600" />
                      <span>Current Streak</span>
                    </h3>
                    <button className="text-gray-400">
                      <Icon icon={expandedSections.streak ? "solar:alt-arrow-up-bold-duotone" : "solar:alt-arrow-down-bold-duotone"} width={20} />
                    </button>
                  </div>
                  
                  {expandedSections.streak && gamificationData?.streak && (
                    <div className="mt-4">
                      <StreakDisplay streak={gamificationData.streak} />
                    </div>
                  )}
                </div>

                {/* Recent Activity */}
                <div className="bg-white rounded-xl">
                  <div 
                    className="flex items-center justify-between cursor-pointer"
                    onClick={() => toggleSection('activity')}
                  >
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
                      <Icon icon="solar:calendar-bold-duotone" width={20} className="text-primary-600" />
                      <span>Recent Activity</span>
                    </h3>
                    <button className="text-gray-400">
                      <Icon icon={expandedSections.activity ? "solar:alt-arrow-up-bold-duotone" : "solar:alt-arrow-down-bold-duotone"} width={20} />
                    </button>
                  </div>
                  
                  {expandedSections.activity && (
                    <div className="mt-4 space-y-4">
                      {recentActivity.length > 0 ? (
                        recentActivity.map((activity) => {
                          const iconName = getActivityIcon(activity.type);
                          const iconColor = getActivityColor(activity.type);
                          
                          return (
                            <div key={activity.id} className="flex items-start space-x-4 p-4 bg-gray-50 rounded-xl">
                              <div className={`w-10 h-10 rounded-xl bg-white flex items-center justify-center ${iconColor}`}>
                                <Icon icon={iconName} width={20} />
                              </div>
                              <div className="flex-1">
                                <p className="text-gray-900 font-medium">{activity.description}</p>
                                <p className="text-sm text-gray-600">{new Date(activity.date).toLocaleDateString()}</p>
                              </div>
                              {activity.points > 0 && (
                                <div className="text-right">
                                  <span className="text-primary-600 font-semibold">${activity.points.toFixed(2)}</span>
                                  <div className="text-xs text-gray-500">amount</div>
                                </div>
                              )}
                            </div>
                          );
                        })
                      ) : (
                        <div className="text-center text-gray-500 py-8">
                          <Icon icon="solar:calendar-bold-duotone" width={32} className="mx-auto mb-2 opacity-50" />
                          <p>No recent activity</p>
                          <p className="text-sm">Join communities to start tracking your progress!</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Achievement Badges Preview */}
                <div className="bg-white rounded-xl">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
                      <Icon icon="solar:cup-star-bold-duotone" width={20} className="text-primary-600" />
                      <span>Achievement Badges</span>
                    </h3>
                    <button
                      onClick={() => setActiveTab('achievements')}
                      className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                    >
                      View All
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {badges.slice(0, 4).map((badge) => {
                      const iconName = getActivityIcon(badge.badge_category);
                      const colorClass = badge.badge_rarity === 'common' ? 'bg-blue-100 text-blue-600' :
                                        badge.badge_rarity === 'rare' ? 'bg-purple-100 text-purple-600' :
                                        badge.badge_rarity === 'epic' ? 'bg-yellow-100 text-yellow-600' :
                                        'bg-orange-100 text-orange-600';
                      
                      return (
                        <div key={badge.badge_id} className="p-4 rounded-xl bg-white border-2 border-gray-200 hover:shadow-md transition-all">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3 ${colorClass}`}>
                            <Icon icon={iconName} width={24} />
                          </div>
                          <h3 className="font-semibold text-gray-900 mb-1">{badge.badge_name}</h3>
                          <p className="text-sm text-gray-600 line-clamp-2">{badge.badge_description}</p>
                        </div>
                      );
                    })}
                    
                    {badges.length === 0 && (
                      <div className="col-span-4 text-center py-8 bg-gray-50 rounded-lg">
                        <Icon icon="solar:cup-star-bold-duotone" width={32} className="mx-auto mb-2 text-gray-400" />
                        <p className="text-gray-600">No badges earned yet</p>
                        <p className="text-sm text-gray-500">Complete goals to earn achievement badges!</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Leaderboard Preview */}
                <UserLeaderboard 
                  userPositions={leaderboardPositions}
                />
              </div>
            )}

            {/* Achievements Tab */}
            {activeTab === 'achievements' && (
              <UserAchievements badges={badges} />
            )}

            {/* Communities Tab */}
            {activeTab === 'communities' && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-gray-900">Your Communities</h3>
                
                {userCommunities.length > 0 ? (
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {userCommunities.map((community) => (
                      <div key={community.id} className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-md transition-all">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-semibold text-gray-900">{community.title}</h4>
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            community.status === 'waiting' ? 'bg-yellow-100 text-yellow-800' :
                            community.status === 'active' ? 'bg-green-100 text-green-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {community.status.charAt(0).toUpperCase() + community.status.slice(1)}
                          </span>
                        </div>
                        
                        <p className="text-sm text-gray-600 mb-4 line-clamp-2">{community.goal}</p>
                        
                        <div className="flex justify-between text-sm mb-2">
                          <span className="text-gray-600">Progress</span>
                          <span className="font-medium text-gray-900">
                            {/* This would come from community_members.progress_percentage */}
                            {Math.floor(Math.random() * 100)}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-primary-600 h-2 rounded-full"
                            style={{ width: `${Math.floor(Math.random() * 100)}%` }}
                          ></div>
                        </div>
                        
                        <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-100">
                          <div className="text-sm text-gray-600">
                            <span className="font-medium">${(community.stake_amount / 100).toFixed(0)}</span> stake
                          </div>
                          <a 
                            href={`/communities/${community.id}`}
                            className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                          >
                            View Details
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 bg-gray-50 rounded-xl">
                    <Icon icon="solar:users-group-rounded-bold-duotone" width={48} className="mx-auto mb-4 text-gray-400" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">No Communities Yet</h3>
                    <p className="text-gray-600 mb-4">
                      You haven't joined any communities yet. Explore available communities to get started!
                    </p>
                    <a 
                      href="/communities"
                      className="inline-block bg-primary-600 text-white px-6 py-2 rounded-xl hover:bg-primary-700 transition-colors"
                    >
                      Explore Communities
                    </a>
                  </div>
                )}
              </div>
            )}

            {/* Statistics Tab */}
            {activeTab === 'statistics' && (
              <div className="space-y-8">
                <div 
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => toggleSection('stats')}
                >
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
                    <Icon icon="solar:chart-bold-duotone" width={20} className="text-primary-600" />
                    <span>Detailed Statistics</span>
                  </h3>
                  <button className="text-gray-400">
                    <Icon icon={expandedSections.stats ? "solar:alt-arrow-up-bold-duotone" : "solar:alt-arrow-down-bold-duotone"} width={20} />
                  </button>
                </div>
                
                {expandedSections.stats && (
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Participation Stats */}
                    <div className="bg-blue-50 rounded-xl p-6">
                      <h4 className="font-medium text-blue-900 mb-4 flex items-center space-x-2">
                        <Icon icon="solar:users-group-rounded-bold-duotone" width={18} className="text-blue-600" />
                        <span>Participation</span>
                      </h4>
                      
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-blue-700">Communities Joined:</span>
                          <span className="font-medium text-blue-900">{stats.communities_joined}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-blue-700">Communities Won:</span>
                          <span className="font-medium text-blue-900">{stats.communities_won}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-blue-700">Communities Lost:</span>
                          <span className="font-medium text-blue-900">{stats.communities_lost}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-blue-700">Success Rate:</span>
                          <span className="font-medium text-blue-900">{stats.success_rate.toFixed(1)}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-blue-700">Platform Tenure:</span>
                          <span className="font-medium text-blue-900">{stats.platform_tenure_days} days</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Activity Stats */}
                    <div className="bg-green-50 rounded-xl p-6">
                      <h4 className="font-medium text-green-900 mb-4 flex items-center space-x-2">
                        <Icon icon="solar:clock-circle-bold-duotone" width={18} className="text-green-600" />
                        <span>Activity</span>
                      </h4>
                      
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-green-700">Total Hours Logged:</span>
                          <span className="font-medium text-green-900">{stats.total_hours_logged.toFixed(1)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-green-700">Meetings Attended:</span>
                          <span className="font-medium text-green-900">{stats.meetings_attended}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-green-700">Goals Completed:</span>
                          <span className="font-medium text-green-900">{stats.goals_completed}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-green-700">Current Streak:</span>
                          <span className="font-medium text-green-900">{stats.current_streak} days</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-green-700">Longest Streak:</span>
                          <span className="font-medium text-green-900">{stats.longest_streak} days</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Financial Stats */}
                    <div className="bg-purple-50 rounded-xl p-6">
                      <h4 className="font-medium text-purple-900 mb-4 flex items-center space-x-2">
                        <Icon icon="solar:dollar-bold-duotone" width={18} className="text-purple-600" />
                        <span>Financial</span>
                      </h4>
                      
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-purple-700">Total Earnings:</span>
                          <span className="font-medium text-purple-900">${stats.total_earnings.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-purple-700">Total Losses:</span>
                          <span className="font-medium text-purple-900">${stats.total_losses.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-purple-700">Net Balance:</span>
                          <span className="font-medium text-purple-900">${(stats.total_earnings - stats.total_losses).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-purple-700">ROI:</span>
                          <span className="font-medium text-purple-900">
                            {stats.total_losses > 0 
                              ? ((stats.total_earnings - stats.total_losses) / stats.total_losses * 100).toFixed(1) 
                              : '0.0'}%
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-purple-700">Avg. Earnings/Community:</span>
                          <span className="font-medium text-purple-900">
                            ${stats.communities_won > 0 
                              ? (stats.total_earnings / stats.communities_won).toFixed(2) 
                              : '0.00'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Leaderboard Positions */}
                <div className="mt-8">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
                    <Icon icon="solar:cup-star-bold-duotone" width={20} className="text-primary-600" />
                    <span>Your Rankings</span>
                  </h3>
                  
                  {leaderboardPositions.length > 0 ? (
                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                      {leaderboardPositions.map((position) => {
                        const iconName = position.leaderboard_type === 'earnings' ? 'solar:dollar-bold-duotone' :
                                      position.leaderboard_type === 'hours' ? 'solar:clock-circle-bold-duotone' :
                                      position.leaderboard_type === 'streak' ? 'solar:bolt-bold-duotone' :
                                      'solar:cup-star-bold-duotone';
                        
                        const title = position.leaderboard_type === 'earnings' ? 'Earnings' :
                                    position.leaderboard_type === 'hours' ? 'Hours Logged' :
                                    position.leaderboard_type === 'streak' ? 'Streak Length' :
                                    'Communities Won';
                        
                        const value = position.leaderboard_type === 'earnings' ? `$${position.value.toFixed(2)}` :
                                    position.leaderboard_type === 'hours' ? `${position.value.toFixed(1)} hrs` :
                                    position.leaderboard_type === 'streak' ? `${position.value} days` :
                                    position.value.toString();
                        
                        return (
                          <div key={position.leaderboard_type} className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-sm transition-all">
                            <div className="flex items-center space-x-2 mb-3">
                              <Icon icon={iconName} width={16} className="text-primary-600" />
                              <h4 className="font-medium text-gray-900">{title}</h4>
                            </div>
                            
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="text-2xl font-bold text-primary-600">#{position.rank}</div>
                                <div className="text-xs text-gray-500">of {position.total_users} users</div>
                              </div>
                              
                              <div className="text-right">
                                <div className="text-lg font-semibold text-gray-900">{value}</div>
                                <div className="text-xs text-gray-500">Your value</div>
                              </div>
                            </div>
                            
                            {position.rank <= 10 && (
                              <div className="mt-2 text-xs text-green-600 font-medium">
                                Top 10 Ranked! 🏆
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8 bg-gray-50 rounded-xl">
                      <Icon icon="solar:cup-star-bold-duotone" width={32} className="mx-auto mb-2 text-gray-400" />
                      <p className="text-gray-600">No leaderboard rankings yet</p>
                      <p className="text-sm text-gray-500">Complete goals to appear on leaderboards!</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}