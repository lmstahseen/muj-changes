import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { useAuth } from '../contexts/AuthContext';
import communityService from '../services/communityService';
import { Community, formatStakeAmount, getDaysLeft, formatDate } from '../lib/supabase';
import { ActiveTimer } from '../components/ActiveTimer';

export function Communities() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [stakeRange, setStakeRange] = useState({ min: '', max: '' });
  const [communities, setCommunities] = useState<Community[]>([]);
  const [userCommunities, setUserCommunities] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [joiningCommunity, setJoiningCommunity] = useState<string | null>(null);

  const categories = ['All', 'Fitness', 'Coding', 'Learning', 'Business', 'Health', 'Creative'];
  const statuses = ['All', 'waiting', 'active', 'ended'];

  useEffect(() => {
    loadCommunities();
    if (user) {
      loadUserCommunities();
    }
  }, [user]);

  const loadCommunities = async () => {
    setLoading(true);
    setError('');
    
    try {
      const result = await communityService.getAllCommunities();
      
      if (result.success && result.communities) {
        setCommunities(result.communities);
      } else {
        setError(result.error || 'Failed to load communities');
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const loadUserCommunities = async () => {
    if (!user) return;
    
    try {
      const result = await communityService.getUserCommunities(user.id);
      if (result.success && result.communities) {
        setUserCommunities(result.communities.map(c => c.id));
      }
    } catch (err) {
      console.error('Error loading user communities:', err);
    }
  };

  const handleSearch = async () => {
    setLoading(true);
    setError('');
    
    try {
      const filters = {
        searchTerm: searchTerm.trim(),
        category: selectedCategory !== 'All' ? selectedCategory : undefined,
        status: selectedStatus !== 'All' ? selectedStatus : undefined,
        minStake: stakeRange.min ? parseFloat(stakeRange.min) : undefined,
        maxStake: stakeRange.max ? parseFloat(stakeRange.max) : undefined
      };

      const result = await communityService.searchCommunities(filters);
      
      if (result.success && result.communities) {
        setCommunities(result.communities);
      } else {
        setError(result.error || 'Failed to search communities');
      }
    } catch (err) {
      setError('An unexpected error occurred during search');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinCommunity = async (communityId: string) => {
    if (!user) {
      alert('Please log in to join a community');
      return;
    }

    setJoiningCommunity(communityId);

    try {
      const result = await communityService.joinCommunity(communityId, user.id);
      
      if (result.success) {
        alert('Successfully joined the community!');
        // Reload communities and user communities
        loadCommunities();
        loadUserCommunities();
      } else {
        alert(result.error || 'Failed to join community');
      }
    } catch (err) {
      alert('An unexpected error occurred');
    } finally {
      setJoiningCommunity(null);
    }
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedCategory('All');
    setSelectedStatus('All');
    setStakeRange({ min: '', max: '' });
    loadCommunities();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'waiting': return 'bg-yellow-100 text-yellow-800';
      case 'active': return 'bg-green-100 text-green-800';
      case 'ended': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'waiting': return 'solar:clock-circle-bold-duotone';
      case 'active': return 'solar:graph-up-bold-duotone';
      case 'ended': return 'solar:target-bold-duotone';
      default: return 'solar:clock-circle-bold-duotone';
    }
  };

  const isUserMember = (community: Community) => {
    return userCommunities.includes(community.id);
  };

  const canJoinCommunity = (community: Community) => {
    return (community.status === 'waiting' || community.status === 'active') && 
           (community.member_count || 0) < community.max_members &&
           !isUserMember(community);
  };

  if (loading && communities.length === 0) {
    return (
      <div className="pt-20 min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading communities...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-20 min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Discover Communities</h1>
          <p className="text-gray-600">Join goal-oriented communities and achieve more together through accountability and support.</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-8 flex items-center space-x-3">
            <Icon icon="solar:danger-triangle-bold-duotone" width={20} className="text-red-600 flex-shrink-0" />
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* Advanced Filters */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Search */}
            <div className="lg:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
              <div className="relative">
                <Icon icon="solar:magnifer-bold-duotone" width={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search communities..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Category Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                {categories.map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                {statuses.map(status => (
                  <option key={status} value={status}>
                    {status === 'All' ? 'All Statuses' : status.charAt(0).toUpperCase() + status.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            {/* Stake Range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Stake Range</label>
              <div className="flex space-x-2">
                <input
                  type="number"
                  placeholder="Min"
                  value={stakeRange.min}
                  onChange={(e) => setStakeRange(prev => ({ ...prev, min: e.target.value }))}
                  className="w-full px-3 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                />
                <input
                  type="number"
                  placeholder="Max"
                  value={stakeRange.max}
                  onChange={(e) => setStakeRange(prev => ({ ...prev, max: e.target.value }))}
                  className="w-full px-3 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                />
              </div>
            </div>
          </div>

          {/* Filter Actions */}
          <div className="flex flex-col sm:flex-row gap-3 mt-6">
            <button
              onClick={handleSearch}
              disabled={loading}
              className="flex items-center justify-center space-x-2 bg-gradient-to-r from-primary-500 to-primary-600 text-white px-6 py-3 rounded-xl font-semibold hover:from-primary-600 hover:to-primary-700 transition-all disabled:opacity-50"
            >
              <Icon icon="solar:filter-bold-duotone" width={18} />
              <span>Apply Filters</span>
            </button>
            <button
              onClick={clearFilters}
              className="flex items-center justify-center space-x-2 bg-gray-100 text-gray-700 px-6 py-3 rounded-xl font-semibold hover:bg-gray-200 transition-all"
            >
              <span>Clear Filters</span>
            </button>
          </div>
        </div>

        {/* Communities Grid */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">
              {selectedStatus === 'All' ? 'All Communities' : `${selectedStatus.charAt(0).toUpperCase() + selectedStatus.slice(1)} Communities`}
            </h2>
            <span className="text-gray-600">{communities.length} communities found</span>
          </div>

          {communities.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm p-8 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Icon icon="solar:users-group-rounded-bold-duotone" width={32} className="text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No communities found</h3>
              <p className="text-gray-600 mb-4">
                {searchTerm || selectedCategory !== 'All' || selectedStatus !== 'All' 
                  ? 'Try adjusting your filters to find more communities.'
                  : 'Be the first to create a community and start achieving your goals!'
                }
              </p>
              <Link 
                to="/create" 
                className="inline-block bg-gradient-to-r from-primary-500 to-primary-600 text-white px-6 py-2 rounded-xl hover:from-primary-600 hover:to-primary-700 transition-all"
              >
                Create the first one!
              </Link>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {communities.map((community) => {
                const canJoin = canJoinCommunity(community);
                const isJoining = joiningCommunity === community.id;
                const isMember = isUserMember(community);
                
                return (
                  <div key={community.id} className="bg-white rounded-xl shadow-sm hover:shadow-md transition-all p-6 group">
                    <div className="mb-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900 group-hover:text-primary-600 transition-colors mb-2">
                            {community.title}
                          </h3>
                          <div className="flex items-center space-x-2 mb-2">
                            <span className="px-2 py-1 bg-primary-100 text-primary-800 text-xs font-medium rounded-full">
                              {community.category}
                            </span>
                            <span className={`px-2 py-1 text-xs font-medium rounded-full flex items-center space-x-1 ${getStatusColor(community.status)}`}>
                              <Icon icon={getStatusIcon(community.status)} width={12} />
                              <span>{community.status.charAt(0).toUpperCase() + community.status.slice(1)}</span>
                            </span>
                            {isMember && (
                              <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                                Member
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <p className="text-sm text-gray-600 mb-4 line-clamp-2">{community.goal}</p>
                      
                      <div className="flex items-center space-x-2 text-sm text-gray-600 mb-3">
                        <Icon icon="solar:crown-bold-duotone" width={14} />
                        <span>Created by {community.creator_name || 'Community Creator'}</span>
                      </div>
                    </div>

                    <div className="space-y-3 mb-4">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center space-x-1 text-gray-600">
                          <Icon icon="solar:dollar-bold-duotone" width={14} />
                          <span>Stake: ${formatStakeAmount(community.stake_amount)}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          {community.status === 'waiting' && (
                            <ActiveTimer 
                              targetDate={community.start_date} 
                              isCountdown={true}
                              textSize="sm"
                              textColor="text-yellow-600"
                            />
                          )}
                          {community.status === 'active' && (
                            <ActiveTimer 
                              targetDate={community.end_date} 
                              isCountdown={true}
                              textSize="sm"
                              textColor="text-green-600"
                            />
                          )}
                          {community.status === 'ended' && (
                            <span className="text-gray-600">Ended</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center space-x-1 text-gray-600">
                          <Icon icon="solar:users-group-rounded-bold-duotone" width={14} />
                          <span>{community.member_count || 0}/{community.max_members}</span>
                        </div>
                        <div className="flex items-center space-x-1 text-gray-600">
                          <Icon icon="solar:calendar-bold-duotone" width={14} />
                          <span>{formatDate(community.start_date)}</span>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-gradient-to-r from-primary-500 to-primary-600 h-2 rounded-full transition-all"
                          style={{ width: `${((community.member_count || 0) / community.max_members) * 100}%` }}
                        ></div>
                      </div>

                      {/* Community Stats */}
                      {community.analytics && (
                        <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                          <div className="flex items-center space-x-1">
                            <Icon icon="solar:star-bold-duotone" width={12} />
                            <span>{community.analytics.completion_rate}% completion</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Icon icon="solar:graph-up-bold-duotone" width={12} />
                            <span>{community.analytics.average_attendance_rate}% attendance</span>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex space-x-3">
                      {canJoin && (
                        <button
                          onClick={() => handleJoinCommunity(community.id)}
                          disabled={isJoining}
                          className="flex-1 text-center bg-gradient-to-r from-primary-500 to-primary-600 text-white py-2 px-4 rounded-xl text-sm font-medium hover:from-primary-600 hover:to-primary-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isJoining ? 'Joining...' : `Join - $${formatStakeAmount(community.stake_amount)}`}
                        </button>
                      )}
                      
                      <Link 
                        to={`/communities/${community.id}`}
                        className={`${canJoin ? 'px-4' : 'flex-1 text-center'} py-2 text-primary-600 border border-primary-600 rounded-xl text-sm font-medium hover:bg-primary-50 transition-colors`}
                      >
                        View Details
                      </Link>
                    </div>

                    {/* Additional Info for Ended Communities */}
                    {community.status === 'ended' && (
                      <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
                        Ended on {formatDate(community.end_date)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Ready to start your journey?</h3>
          <div className="flex flex-col sm:flex-row gap-4">
            <Link 
              to="/create" 
              className="flex items-center justify-center space-x-2 bg-gradient-to-r from-primary-500 to-primary-600 text-white px-6 py-3 rounded-xl font-semibold hover:from-primary-600 hover:to-primary-700 transition-all"
            >
              <Icon icon="solar:target-bold-duotone" width={20} />
              <span>Create Your Community</span>
            </Link>
            <button 
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="flex items-center justify-center space-x-2 bg-gray-100 text-gray-700 px-6 py-3 rounded-xl font-semibold hover:bg-gray-200 transition-all"
            >
              <Icon icon="solar:magnifer-bold-duotone" width={20} />
              <span>Browse More Communities</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}