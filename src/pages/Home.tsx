import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { useAuth } from '../contexts/AuthContext';
import communityService from '../services/communityService';
import { Community, formatStakeAmount, formatDate } from '../lib/supabase';
import { ActiveTimer } from '../components/ActiveTimer';

export function Home() {
  const { user } = useAuth();
  const [userCommunities, setUserCommunities] = useState<Community[]>([]);
  const [userStats, setUserStats] = useState({
    totalEarnings: 0,
    totalHours: 0,
    communitiesJoined: 0,
    communitiesWon: 0
  });
  const [loading, setLoading] = useState(true);

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

      // Load user's earnings and stats
      const earningsResult = await communityService.getUserEarnings(user.id);
      if (earningsResult.success) {
        setUserStats({
          totalEarnings: (earningsResult.totalEarnings || 0) - (earningsResult.totalLosses || 0),
          totalHours: Math.round(((earningsResult.totalEarnings || 0) + (earningsResult.totalLosses || 0)) / 10), // Estimate
          communitiesJoined: userCommunities.length,
          communitiesWon: earningsResult.earnings?.filter(e => e.type === 'reward').length || 0
        });
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActiveCommunities = () => {
    return userCommunities.filter(c => c.status === 'active' || c.status === 'waiting');
  };

  const getEndedCommunities = () => {
    return userCommunities.filter(c => c.status === 'ended');
  };

  const formatNextMeeting = (community: Community) => {
    const today = new Date();
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const currentDay = dayNames[today.getDay()];
    
    if (community.weekly_meeting_days.includes(currentDay)) {
      return `Today at ${community.preferred_time}`;
    }
    
    // Find next meeting day
    for (let i = 1; i <= 7; i++) {
      const nextDay = new Date(today);
      nextDay.setDate(today.getDate() + i);
      const nextDayName = dayNames[nextDay.getDay()];
      
      if (community.weekly_meeting_days.includes(nextDayName)) {
        if (i === 1) {
          return `Tomorrow at ${community.preferred_time}`;
        } else {
          return `${nextDayName} at ${community.preferred_time}`;
        }
      }
    }
    
    return 'No upcoming meetings';
  };

  const stats = [
    { label: 'Total Earnings', value: `$${userStats.totalEarnings}`, icon: 'solar:graph-up-bold-duotone', color: 'text-primary-600', bgColor: 'bg-primary-50' },
    { label: 'Total Hours Logged', value: userStats.totalHours, icon: 'solar:clock-circle-bold-duotone', color: 'text-primary-600', bgColor: 'bg-primary-50' },
    { label: 'Active Communities', value: getActiveCommunities().length, icon: 'solar:users-group-rounded-bold-duotone', color: 'text-primary-600', bgColor: 'bg-primary-50' },
    { label: 'Communities Won', value: userStats.communitiesWon, icon: 'solar:cup-star-bold-duotone', color: 'text-primary-600', bgColor: 'bg-primary-50' },
  ];

  if (loading) {
    return (
      <div className="pt-20 min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-100 border-t-primary-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-20 min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome back, {user?.name}!</h1>
          <p className="text-gray-600">Track your progress and stay accountable with your communities.</p>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
          {stats.map((stat, index) => (
            <div key={index} className="card p-6">
              <div className="flex items-center justify-between mb-2">
                <Icon icon={stat.icon} width={24} className={stat.color} />
              </div>
              <p className="text-2xl font-bold text-gray-900 mb-1">{stat.value}</p>
              <p className="text-sm text-gray-600">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Active Communities */}
        {getActiveCommunities().length > 0 && (
          <div className="mb-12">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">My Active Communities</h2>
              <Link 
                to="/communities" 
                className="text-primary-600 hover:text-primary-700 font-medium flex items-center space-x-1"
              >
                <span>View All</span>
                <Icon icon="solar:arrow-right-bold-duotone" width={16} />
              </Link>
            </div>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {getActiveCommunities().map((community) => (
                <Link 
                  key={community.id}
                  to={`/communities/${community.id}`}
                  className="card p-6 block group hover:shadow-hover"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <h3 className="font-semibold text-gray-900 group-hover:text-primary-600 transition-colors">
                          {community.title}
                        </h3>
                        {community.creator_id === user?.id && (
                          <Icon icon="solar:crown-bold-duotone" width={16} className="text-yellow-500" />
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mb-3 line-clamp-2">{community.goal}</p>
                    </div>
                  </div>
                  
                  <div className="mb-4">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">Progress</span>
                      <span className="font-medium text-gray-900">0%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-gradient-to-r from-primary-500 to-primary-600 h-2 rounded-full transition-all"
                        style={{ width: '0%' }}
                      ></div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-sm mb-3">
                    <div className="flex items-center space-x-1 text-gray-600">
                      <Icon icon="solar:calendar-bold-duotone" width={14} />
                      <span>{formatNextMeeting(community)}</span>
                    </div>
                    <div className="flex items-center space-x-1 text-gray-600">
                      <Icon icon="solar:users-group-rounded-bold-duotone" width={14} />
                      <span>{community.member_count || 0}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900">
                      Stake: ${formatStakeAmount(community.stake_amount)}
                    </span>
                    <div className="flex items-center space-x-2">
                      <span className={`badge ${
                        community.status === 'waiting' ? 'badge-warning' :
                        community.status === 'active' ? 'badge-success' :
                        'badge-neutral'
                      }`}>
                        {community.status.charAt(0).toUpperCase() + community.status.slice(1)}
                      </span>
                      
                      {community.status === 'waiting' && (
                        <ActiveTimer 
                          targetDate={community.start_date} 
                          isCountdown={true}
                          textSize="xs"
                          textColor="text-yellow-600"
                          showIcon={false}
                        />
                      )}
                      
                      {community.status === 'active' && (
                        <ActiveTimer 
                          targetDate={community.end_date} 
                          isCountdown={true}
                          textSize="xs"
                          textColor="text-green-600"
                          showIcon={false}
                        />
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Ended Communities */}
        {getEndedCommunities().length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Completed Communities</h2>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {getEndedCommunities().map((community) => (
                <Link
                  key={community.id}
                  to={`/communities/${community.id}`}
                  className="card p-6 opacity-90 hover:opacity-100 transition-opacity"
                >
                  <div className="mb-4">
                    <h3 className="font-semibold text-gray-900 mb-2">{community.title}</h3>
                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">{community.goal}</p>
                  </div>
                  
                  <div className="flex items-center justify-between mb-3">
                    <span className="badge badge-neutral">
                      Completed
                    </span>
                    <span className="text-sm text-gray-600">
                      {formatDate(community.end_date)}
                    </span>
                  </div>

                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Stake: ${formatStakeAmount(community.stake_amount)}</span>
                    <span className="font-medium text-primary-600 group-hover:text-primary-700">
                      View Results
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {userCommunities.length === 0 && (
          <div className="card p-12 text-center">
            <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Icon icon="solar:sparkles-bold-duotone" width={32} className="text-primary-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Communities Yet</h3>
            <p className="text-gray-600 mb-6">
              Start your journey by joining a community or creating your own goal-oriented group.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link 
                to="/communities" 
                className="btn-primary flex items-center justify-center space-x-2"
              >
                <Icon icon="solar:users-group-rounded-bold-duotone" width={20} />
                <span>Explore Communities</span>
              </Link>
              <Link 
                to="/create" 
                className="btn-secondary flex items-center justify-center space-x-2"
              >
                <span>Create Community</span>
                <Icon icon="solar:arrow-right-bold-duotone" width={16} />
              </Link>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        {userCommunities.length > 0 && (
          <div className="flex flex-col sm:flex-row gap-4">
            <Link 
              to="/communities" 
              className="btn-primary flex items-center justify-center space-x-2"
            >
              <Icon icon="solar:users-group-rounded-bold-duotone" width={20} />
              <span>Explore More Communities</span>
            </Link>
            <Link 
              to="/create" 
              className="btn-secondary flex items-center justify-center space-x-2"
            >
              <span>Create New Community</span>
              <Icon icon="solar:arrow-right-bold-duotone" width={16} />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}