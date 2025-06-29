import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import communityService from '../services/communityService';
import meetingService, { MeetingSession } from '../services/meetingService';
import { MeetingRoom } from '../components/MeetingRoom';
import { PreMeetingModal } from '../components/PreMeetingModal';
import { ChatInterface } from '../components/ChatInterface';
import { VotingInterface } from '../components/VotingInterface';
import { CommunityFinancials } from '../components/CommunityFinancials';
import { Community, CommunityMember, formatStakeAmount, formatDate, getDaysLeft, getTimeUntilStart, getTimeUntilEnd } from '../lib/supabase';
import { ActiveTimer } from '../components/ActiveTimer';
import { CommunityAnalytics } from '../components/CommunityAnalytics';

export function CommunityDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [community, setCommunity] = useState<Community | null>(null);
  const [members, setMembers] = useState<CommunityMember[]>([]);
  const [meetings, setMeetings] = useState<MeetingSession[]>([]);
  const [activeMeeting, setActiveMeeting] = useState<MeetingSession | null>(null);
  const [inMeeting, setInMeeting] = useState(false);
  const [showPreMeetingModal, setShowPreMeetingModal] = useState(false);
  const [selectedSharingMethod, setSelectedSharingMethod] = useState<'camera' | 'screen'>('camera');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [isStartingMeeting, setIsStartingMeeting] = useState(false);
  const [canEndMeeting, setCanEndMeeting] = useState(false);
  const [communityAnalytics, setCommunityAnalytics] = useState<any>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  
  // Ref for timer update interval
  const timerInterval = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (id) {
      loadCommunityData();
      checkActiveMeeting();
      loadCommunityAnalytics();
      
      // Set up periodic checks for active meetings
      const meetingInterval = setInterval(checkActiveMeeting, 30000); // Check every 30 seconds
      
      // Set up timer for refreshing community data (every minute)
      timerInterval.current = setInterval(() => {
        loadCommunityData();
      }, 60000);
      
      return () => {
        clearInterval(meetingInterval);
        if (timerInterval.current) {
          clearInterval(timerInterval.current);
        }
      };
    }
  }, [id]);

  const loadCommunityData = async () => {
    if (!id) return;
    
    setLoading(true);
    setError('');
    
    try {
      const result = await communityService.getCommunityById(id);
      
      if (result.success && result.community) {
        setCommunity(result.community);
        setMembers(result.members || []);
        setMeetings(result.meetings || []);
      } else {
        setError(result.error || 'Community not found');
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const loadCommunityAnalytics = async () => {
    if (!id) return;
    
    setLoadingAnalytics(true);
    try {
      const { data: analytics, error } = await supabase
        .from('community_analytics')
        .select('*')
        .eq('community_id', id)
        .order('date', { ascending: false })
        .limit(1)
        .single();
        
      if (analytics) {
        setCommunityAnalytics(analytics);
      }
    } catch (err) {
      console.error('Error loading community analytics:', err);
    } finally {
      setLoadingAnalytics(false);
    }
  };

  const checkActiveMeeting = async () => {
    if (!id) return;
    
    try {
      const result = await meetingService.getActiveMeeting(id);
      if (result.success && result.meetingSession) {
        setActiveMeeting(result.meetingSession);
        
        // Check if user can end meeting
        if (user && result.meetingSession) {
          const canEnd = await meetingService.canEndMeeting(result.meetingSession.id, user.id);
          setCanEndMeeting(canEnd);
        }
      } else {
        setActiveMeeting(null);
        setCanEndMeeting(false);
      }
    } catch (err) {
      console.error('Error checking active meeting:', err);
    }
  };

  const handleJoinCommunity = async () => {
    if (!user || !community) return;
    
    setIsJoining(true);
    
    try {
      const result = await communityService.joinCommunity(community.id, user.id);
      
      if (result.success) {
        alert('Successfully joined the community!');
        loadCommunityData();
      } else {
        alert(result.error || 'Failed to join community');
      }
    } catch (err) {
      alert('An unexpected error occurred');
    } finally {
      setIsJoining(false);
    }
  };

  const handleStartMeeting = async () => {
    if (!user || !community) return;
    
    setShowPreMeetingModal(true);
  };

  const handlePreMeetingJoin = async (sharingMethod: 'camera' | 'screen') => {
    setSelectedSharingMethod(sharingMethod);
    setShowPreMeetingModal(false);
    setIsStartingMeeting(true);
    
    try {
      const result = await meetingService.startMeeting(community!.id, user!.id);
      
      if (result.success && result.meetingSession) {
        setActiveMeeting(result.meetingSession);
        setInMeeting(true);
      } else {
        alert(result.error || 'Failed to start meeting');
      }
    } catch (err) {
      alert('An unexpected error occurred');
    } finally {
      setIsStartingMeeting(false);
    }
  };

  const handleJoinMeeting = async () => {
    if (!user || !activeMeeting) return;
    
    setShowPreMeetingModal(true);
  };

  const handlePreMeetingJoinExisting = async (sharingMethod: 'camera' | 'screen') => {
    setSelectedSharingMethod(sharingMethod);
    setShowPreMeetingModal(false);
    
    try {
      const result = await meetingService.joinMeeting(activeMeeting!.id, user!.id, activeMeeting!.community_id);
      
      if (result.success) {
        setInMeeting(true);
      } else {
        alert(result.error || 'Failed to join meeting');
      }
    } catch (err) {
      alert('An unexpected error occurred');
    }
  };

  const handleEndMeeting = async () => {
    if (!user || !activeMeeting || !canEndMeeting) return;
    
    if (confirm('Are you sure you want to end the meeting?')) {
      try {
        const result = await meetingService.endMeeting(activeMeeting.id, user.id);
        
        if (result.success) {
          alert('Meeting ended successfully');
          setActiveMeeting(null);
          loadCommunityData();
        } else {
          alert(result.error || 'Failed to end meeting');
        }
      } catch (err) {
        alert('An unexpected error occurred');
      }
    }
  };

  const handleLeaveMeeting = () => {
    setInMeeting(false);
    checkActiveMeeting();
    loadCommunityData(); // Refresh data after leaving meeting
  };

  const isUserMember = () => {
    return user && members.some(member => member.user_id === user.id);
  };

  const canJoinCommunity = () => {
    return community && 
           community.status === 'waiting' && 
           members.length < community.max_members &&
           !isUserMember();
  };

  const getUserMembership = () => {
    return user ? members.find(member => member.user_id === user.id) : null;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'waiting': return 'bg-yellow-100 text-yellow-800';
      case 'active': return 'bg-green-100 text-green-800';
      case 'ended': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: 'solar:chart-bold-duotone' },
    { id: 'members', label: 'Members', icon: 'solar:users-group-rounded-bold-duotone' },
    { id: 'meetings', label: 'Meetings', icon: 'solar:videocamera-record-bold-duotone' },
    { id: 'chat', label: 'Chat', icon: 'solar:chat-round-dots-bold-duotone' },
    { id: 'reports', label: 'Reports', icon: 'solar:vote-bold-duotone' },
    { id: 'financials', label: 'Financials', icon: 'solar:dollar-bold-duotone' }
  ];

  if (inMeeting && activeMeeting) {
    return (
      <MeetingRoom
        communityId={activeMeeting.community_id}
        meetingSessionId={activeMeeting.id}
        onLeaveMeeting={handleLeaveMeeting}
        initialSharingMethod={selectedSharingMethod}
      />
    );
  }

  if (loading) {
    return (
      <div className="pt-20 min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading community...</p>
        </div>
      </div>
    );
  }

  if (error || !community) {
    return (
      <div className="pt-20 min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Icon icon="solar:danger-triangle-bold-duotone" width={48} className="text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Community Not Found</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <Link 
            to="/communities" 
            className="text-primary-600 hover:text-primary-700 font-medium"
          >
            ← Back to Communities
          </Link>
        </div>
      </div>
    );
  }

  const userMembership = getUserMembership();

  return (
    <div className="pt-20 min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Meeting Status & Actions */}
        {activeMeeting && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                <div>
                  <h4 className="font-medium text-green-900">Live Meeting in Progress</h4>
                  <p className="text-sm text-green-700">Community members are currently meeting</p>
                </div>
              </div>
              <div className="flex space-x-3">
                {isUserMember() && (
                  <button 
                    onClick={handleJoinMeeting}
                    className="bg-green-600 text-white px-6 py-2 rounded-xl font-medium hover:bg-green-700 transition-colors flex items-center space-x-2"
                  >
                    <Icon icon="solar:videocamera-record-bold-duotone" width={16} />
                    <span>Join Meeting</span>
                  </button>
                )}
                {canEndMeeting && (
                  <button 
                    onClick={handleEndMeeting}
                    className="bg-orange-600 text-white px-6 py-2 rounded-xl font-medium hover:bg-orange-700 transition-colors flex items-center space-x-2"
                  >
                    <span>End Meeting</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-sm mb-8">
          <div className="border-b border-gray-200">
            <div className="flex space-x-8 px-6 overflow-x-auto">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
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
                {/* Community Header */}
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-6">
                  <div className="mb-4 lg:mb-0">
                    <div className="flex items-center space-x-3 mb-3">
                      <h1 className="text-3xl font-bold text-gray-900">{community.title}</h1>
                      <span className="px-3 py-1 bg-primary-100 text-primary-800 text-sm font-medium rounded-full">
                        {community.category}
                      </span>
                      <span className={`px-3 py-1 text-sm font-medium rounded-full ${getStatusColor(community.status)}`}>
                        {community.status.charAt(0).toUpperCase() + community.status.slice(1)}
                      </span>
                    </div>
                    
                    <p className="text-gray-600 mb-4 text-lg">{community.goal}</p>
                    
                    {community.description && (
                      <p className="text-gray-600 mb-4">{community.description}</p>
                    )}
                    
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                      <Icon icon="solar:crown-bold-duotone" width={16} />
                      <span>Created by Community Creator</span>
                      <span>•</span>
                      <span>Created {formatDate(community.created_at)}</span>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className="text-3xl font-bold text-primary-600 mb-1">
                      {community.status === 'waiting' && (
                        <ActiveTimer 
                          targetDate={community.start_date} 
                          isCountdown={true}
                          textSize="3xl"
                          showIcon={false}
                          textColor="text-yellow-600"
                        />
                      )}
                      
                      {community.status === 'active' && (
                        <ActiveTimer 
                          targetDate={community.end_date} 
                          isCountdown={true}
                          textSize="3xl"
                          showIcon={false}
                          textColor="text-green-600"
                        />
                      )}
                      
                      {community.status === 'ended' && "Ended"}
                    </div>
                    <div className="text-sm text-gray-600">
                      {community.status === 'waiting' ? 'Until start' : 
                       community.status === 'active' ? 'Until end' : 'Community ended'}
                    </div>
                  </div>
                </div>

                {/* Key Metrics */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
                  <div className="bg-gray-50 rounded-xl p-4 text-center">
                    <div className="text-2xl font-bold text-gray-900 mb-1">${formatStakeAmount(community.stake_amount)}</div>
                    <div className="text-sm text-gray-600">Stake Amount</div>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4 text-center">
                    <div className="text-2xl font-bold text-gray-900 mb-1">{members.length}/{community.max_members}</div>
                    <div className="text-sm text-gray-600">Members</div>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4 text-center">
                    <div className="text-2xl font-bold text-gray-900 mb-1">{community.total_minimum_hours}</div>
                    <div className="text-sm text-gray-600">Minimum Hours</div>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4 text-center">
                    <div className="text-2xl font-bold text-gray-900 mb-1">{community.weekly_meeting_days.length}</div>
                    <div className="text-sm text-gray-600">Meeting Days</div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-3 mb-8">
                  {canJoinCommunity() && (
                    <button 
                      onClick={handleJoinCommunity}
                      disabled={isJoining}
                      className="flex items-center justify-center space-x-2 bg-gradient-to-r from-primary-500 to-primary-600 text-white px-8 py-3 rounded-xl font-semibold hover:from-primary-600 hover:to-primary-700 transition-all disabled:opacity-50"
                    >
                      <Icon icon="solar:user-plus-bold-duotone" width={20} />
                      <span>{isJoining ? 'Joining...' : `Join Community - $${formatStakeAmount(community.stake_amount)}`}</span>
                    </button>
                  )}
                  
                  {isUserMember() && community.status === 'active' && !activeMeeting && (
                    <button 
                      onClick={handleStartMeeting}
                      disabled={isStartingMeeting}
                      className="flex items-center justify-center space-x-2 bg-gradient-to-r from-green-500 to-green-600 text-white px-8 py-3 rounded-xl font-semibold hover:from-green-600 hover:to-green-700 transition-all disabled:opacity-50"
                    >
                      <Icon icon="solar:play-circle-bold-duotone" width={20} />
                      <span>{isStartingMeeting ? 'Starting...' : 'Start Meeting'}</span>
                    </button>
                  )}
                  
                  {userMembership && (
                    <div className="flex items-center space-x-2 px-4 py-3 bg-green-50 border border-green-200 rounded-xl">
                      <Icon icon="solar:medal-bold-duotone" width={20} className="text-green-600" />
                      <span className="text-green-800 font-medium">
                        Member since {formatDate(userMembership.joined_at)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Community Schedule */}
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="bg-gradient-to-br from-primary-50 to-primary-100 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-primary-900 mb-4">Schedule & Requirements</h3>
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2 text-primary-800">
                        <Icon icon="solar:calendar-bold-duotone" width={16} />
                        <span>Meeting Days: {community.weekly_meeting_days.join(', ')}</span>
                      </div>
                      <div className="flex items-center space-x-2 text-primary-800">
                        <Icon icon="solar:clock-circle-bold-duotone" width={16} />
                        <span>Meeting Time Period: {community.preferred_time_period}</span>
                      </div>
                      <div className="flex items-center space-x-2 text-primary-800">
                        <Icon icon="solar:target-bold-duotone" width={16} />
                        <span>Total Minimum Hours: {community.total_minimum_hours} hours</span>
                      </div>
                      <div className="flex items-center space-x-2 text-primary-800">
                        <Icon icon="solar:users-group-rounded-bold-duotone" width={16} />
                        <span>Duration: {formatDate(community.start_date)} - {formatDate(community.end_date)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Community Analytics */}
                  <div className="bg-gray-50 rounded-xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-900">Community Analytics</h3>
                      <button
                        onClick={loadCommunityAnalytics}
                        className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
                        title="Refresh data"
                      >
                        <Icon icon="solar:refresh-bold-duotone" width={16} className={loadingAnalytics ? 'animate-spin' : ''} />
                      </button>
                    </div>
                    
                    {loadingAnalytics ? (
                      <div className="text-center py-4">
                        <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto mb-2"></div>
                        <p className="text-gray-600 text-sm">Loading analytics...</p>
                      </div>
                    ) : communityAnalytics ? (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="text-center p-3 bg-blue-50 rounded-lg">
                          <div className="text-sm text-blue-700 mb-1">Active Members</div>
                          <div className="text-xl font-bold text-blue-800">
                            {communityAnalytics.active_members}/{communityAnalytics.total_members}
                          </div>
                        </div>
                        <div className="text-center p-3 bg-green-50 rounded-lg">
                          <div className="text-sm text-green-700 mb-1">Meetings Held</div>
                          <div className="text-xl font-bold text-green-800">
                            {communityAnalytics.total_meetings_held}
                          </div>
                        </div>
                        <div className="text-center p-3 bg-purple-50 rounded-lg">
                          <div className="text-sm text-purple-700 mb-1">Attendance Rate</div>
                          <div className="text-xl font-bold text-purple-800">
                            {communityAnalytics.average_attendance_rate.toFixed(1)}%
                          </div>
                        </div>
                        <div className="text-center p-3 bg-orange-50 rounded-lg">
                          <div className="text-sm text-orange-700 mb-1">Completion Rate</div>
                          <div className="text-xl font-bold text-orange-800">
                            {communityAnalytics.completion_rate.toFixed(1)}%
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center text-gray-500 py-4">
                        <Icon icon="solar:chart-bold-duotone" width={32} className="mx-auto mb-2 opacity-50" />
                        <p>Analytics will be available once the community becomes active</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Community Guidelines */}
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6">
                  <h4 className="font-medium text-yellow-800 mb-3 flex items-center space-x-2">
                    <Icon icon="solar:danger-triangle-bold-duotone" width={18} />
                    <span>Community Guidelines</span>
                  </h4>
                  <ul className="text-sm text-yellow-700 space-y-2">
                    <li>• Attend all scheduled meetings on time</li>
                    <li>• Complete the minimum required hours</li>
                    <li>• Be prepared to share your screen and show progress</li>
                    <li>• Support and encourage fellow community members</li>
                    <li>• Maintain respectful and constructive communication</li>
                    <li>• Report any violations honestly and transparently</li>
                  </ul>
                </div>
              </div>
            )}

            {/* Members Tab */}
            {activeTab === 'members' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold text-gray-900">Community Members</h3>
                  <span className="text-sm text-gray-600">{members.length} of {community.max_members} members</span>
                </div>
                
                <div className="grid gap-4">
                  {members.map((member, index) => (
                    <div key={member.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-2xl">
                          👤
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-medium text-gray-900">
                              {member.user_id === user?.id ? 'You' : `Member #${index + 1}`}
                            </span>
                            {member.is_creator && (
                              <Icon icon="solar:crown-bold-duotone" width={16} className="text-yellow-500" />
                            )}
                            {member.stake_paid && (
                              <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                                Stake Paid
                              </span>
                            )}
                            {member.is_disqualified && (
                              <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-medium rounded-full">
                                Disqualified
                              </span>
                            )}
                          </div>
                          <span className="text-sm text-gray-600">
                            Joined {formatDate(member.joined_at)}
                          </span>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <div className="text-lg font-semibold text-gray-900">{member.progress_percentage.toFixed(0)}%</div>
                        <div className="text-sm text-gray-600">Progress</div>
                        <div className="w-20 bg-gray-200 rounded-full h-2 mt-1">
                          <div 
                            className="bg-gradient-to-r from-primary-500 to-primary-600 h-2 rounded-full transition-all"
                            style={{ width: `${member.progress_percentage}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {/* Empty slots */}
                  {Array.from({ length: community.max_members - members.length }).map((_, index) => (
                    <div key={`empty-${index}`} className="flex items-center justify-center p-4 border-2 border-dashed border-gray-200 rounded-xl">
                      <div className="text-center text-gray-400">
                        <Icon icon="solar:users-group-rounded-bold-duotone" width={24} className="mx-auto mb-2" />
                        <span className="text-sm">Open slot</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Meetings Tab */}
            {activeTab === 'meetings' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold text-gray-900">Meeting History</h3>
                  {community.status === 'active' && isUserMember() && !activeMeeting && (
                    <button 
                      onClick={handleStartMeeting}
                      disabled={isStartingMeeting}
                      className="bg-gradient-to-r from-primary-500 to-primary-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:from-primary-600 hover:to-primary-700 transition-all disabled:opacity-50"
                    >
                      {isStartingMeeting ? 'Starting...' : 'Start Meeting'}
                    </button>
                  )}
                </div>
                
                {meetings.length > 0 ? (
                  <div className="space-y-3">
                    {meetings.map((meeting) => (
                      <div key={meeting.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                        <div>
                          <div className="font-medium text-gray-900">
                            {formatDate(meeting.session_date)}
                          </div>
                          <div className="text-sm text-gray-600">
                            {new Date(meeting.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            {meeting.end_time && ` - ${new Date(meeting.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                          </div>
                          <div className="flex items-center space-x-2 mt-1">
                            <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${
                              meeting.status === 'scheduled' ? 'bg-blue-100 text-blue-800' :
                              meeting.status === 'active' ? 'bg-green-100 text-green-800' :
                              meeting.status === 'completed' ? 'bg-gray-100 text-gray-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {meeting.status.charAt(0).toUpperCase() + meeting.status.slice(1)}
                            </span>
                            {meeting.was_reported && (
                              <span className="inline-block px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">
                                Reported
                              </span>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex space-x-2">
                          {meeting.status === 'active' && isUserMember() && (
                            <button 
                              onClick={handleJoinMeeting}
                              className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors flex items-center space-x-2"
                            >
                              <Icon icon="solar:videocamera-record-bold-duotone" width={16} />
                              <span>Join</span>
                            </button>
                          )}
                          
                          {meeting.was_reported && (
                            <button 
                              onClick={() => setActiveTab('reports')}
                              className="bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-700 transition-colors flex items-center space-x-2"
                            >
                              <Icon icon="solar:vote-bold-duotone" width={16} />
                              <span>View Reports</span>
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-gray-500 py-8">
                    <Icon icon="solar:videocamera-slash-bold-duotone" width={48} className="mx-auto mb-4 opacity-50" />
                    <p>No meetings yet.</p>
                    <p className="text-sm">
                      {community.status === 'waiting' 
                        ? 'Meetings will be available when the community becomes active.'
                        : isUserMember() 
                        ? 'Start the first meeting to begin accountability sessions.'
                        : 'Join the community to participate in meetings.'
                      }
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Chat Tab */}
            {activeTab === 'chat' && (
              <div className="h-96">
                {isUserMember() ? (
                  <ChatInterface 
                    communityId={community.id}
                    className="h-full border border-gray-200 rounded-xl"
                  />
                ) : (
                  <div className="h-full flex items-center justify-center text-center text-gray-500 border border-gray-200 rounded-xl">
                    <div>
                      <Icon icon="solar:chat-round-dots-bold-duotone" width={48} className="mx-auto mb-4 opacity-50" />
                      <p>Join the community to participate in chat discussions.</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Reports Tab */}
            {activeTab === 'reports' && (
              <div>
                {isUserMember() ? (
                  <VotingInterface 
                    communityId={community.id}
                    className=""
                  />
                ) : (
                  <div className="text-center text-gray-500 py-12">
                    <Icon icon="solar:vote-bold-duotone" width={48} className="mx-auto mb-4 opacity-50" />
                    <p>Join the community to view and participate in the reporting system.</p>
                  </div>
                )}
              </div>
            )}

            {/* Financials Tab */}
            {activeTab === 'financials' && (
              <CommunityFinancials 
                community={community}
                isUserMember={isUserMember()}
              />
            )}
          </div>
        </div>
      </div>

      {/* Pre-Meeting Modal */}
      <PreMeetingModal
        isOpen={showPreMeetingModal}
        onClose={() => setShowPreMeetingModal(false)}
        onJoin={activeMeeting ? handlePreMeetingJoinExisting : handlePreMeetingJoin}
      />
    </div>
  );
}