import React, { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { useAuth } from '../contexts/AuthContext';
import reportingService, { Report, ReportVote } from '../services/reportingService';
import meetingService from '../services/meetingService';
import { ReportVotingCard } from './ReportVotingCard';
import { RecordingPlayer } from './RecordingPlayer';

interface VotingInterfaceProps {
  communityId: string;
  className?: string;
}

export function VotingInterface({ communityId, className = '' }: VotingInterfaceProps) {
  const { user } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [userVotes, setUserVotes] = useState<Map<string, ReportVote>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'pending' | 'resolved' | 'all'>('pending');
  const [votingOnReport, setVotingOnReport] = useState<string | null>(null);
  const [viewingRecording, setViewingRecording] = useState<string | null>(null);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const [recordingMeetingDate, setRecordingMeetingDate] = useState<string>('');
  const [loadingRecording, setLoadingRecording] = useState(false);
  const [reportAnalytics, setReportAnalytics] = useState<any>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [dateFilter, setDateFilter] = useState<'all' | '7days' | '30days' | '90days'>('all');
  const [violationFilter, setViolationFilter] = useState<'all' | 'not_working' | 'wrong_task' | 'inappropriate_behavior' | 'other'>('all');
  const [expandedReport, setExpandedReport] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showRecordingPlayer, setShowRecordingPlayer] = useState(false);

  useEffect(() => {
    loadReports();
    loadReportAnalytics();
    
    // Set up real-time subscriptions
    const unsubscribe = reportingService.subscribeToReports(communityId, {
      onReportCreated: (report) => {
        setReports(prev => [report, ...prev]);
      },
      onVoteCast: () => {
        loadReports(); // Refresh to get updated vote counts
      },
      onReportResolved: (report) => {
        setReports(prev => prev.map(r => r.id === report.id ? report : r));
        loadReportAnalytics(); // Refresh analytics when a report is resolved
      }
    });

    return unsubscribe;
  }, [communityId, filter, dateFilter, violationFilter]);

  // Effect to filter reports when search term changes
  useEffect(() => {
    if (searchTerm.trim()) {
      const filteredReports = reports.filter(report => 
        report.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        report.violation_type.toLowerCase().includes(searchTerm.toLowerCase())
      );
      // We don't update the main reports state, just filter the display
    }
  }, [searchTerm, reports]);

  const loadReports = async () => {
    setLoading(true);
    setError('');

    try {
      const statusFilter = filter === 'all' ? undefined : 
                          filter === 'pending' ? 'pending' : 
                          undefined; // For resolved, we'll filter client-side

      const result = await reportingService.getCommunityReports(communityId, statusFilter);
      
      if (result.success && result.reports) {
        let filteredReports = result.reports;
        
        // Apply date filter
        if (dateFilter !== 'all') {
          const cutoffDate = new Date();
          if (dateFilter === '7days') cutoffDate.setDate(cutoffDate.getDate() - 7);
          if (dateFilter === '30days') cutoffDate.setDate(cutoffDate.getDate() - 30);
          if (dateFilter === '90days') cutoffDate.setDate(cutoffDate.getDate() - 90);
          
          filteredReports = filteredReports.filter(r => new Date(r.created_at) >= cutoffDate);
        }
        
        // Apply violation type filter
        if (violationFilter !== 'all') {
          filteredReports = filteredReports.filter(r => r.violation_type === violationFilter);
        }
        
        // Apply resolved filter
        if (filter === 'resolved') {
          filteredReports = filteredReports.filter(r => r.status.startsWith('resolved_'));
        }
        
        // Apply search filter if present
        if (searchTerm.trim()) {
          filteredReports = filteredReports.filter(report => 
            report.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
            report.violation_type.toLowerCase().includes(searchTerm.toLowerCase())
          );
        }
        
        setReports(filteredReports);
        
        // Load user votes for pending reports
        if (user) {
          const voteMap = new Map<string, ReportVote>();
          await Promise.all(
            filteredReports
              .filter(r => r.status === 'pending')
              .map(async (report) => {
                const voteResult = await reportingService.hasUserVoted(report.id, user.id);
                if (voteResult.success && voteResult.vote) {
                  voteMap.set(report.id, voteResult.vote);
                }
              })
          );
          setUserVotes(voteMap);
        }
      } else {
        setError(result.error || 'Failed to load reports');
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const loadReportAnalytics = async () => {
    setLoadingAnalytics(true);
    try {
      const result = await reportingService.getReportAnalytics(communityId, 30); // 30 days by default
      if (result.success && result.analytics) {
        setReportAnalytics(result.analytics);
      }
    } catch (err) {
      console.error('Error loading report analytics:', err);
    } finally {
      setLoadingAnalytics(false);
    }
  };

  const handleVote = async (reportId: string, voteType: ReportVote['vote_type'], reasoning?: string) => {
    if (!user) return;

    setVotingOnReport(reportId);

    try {
      const result = await reportingService.castVote({
        reportId,
        voterId: user.id,
        voteType,
        reasoning
      });

      if (result.success) {
        // Update local state
        setUserVotes(prev => new Map(prev.set(reportId, {
          id: '',
          report_id: reportId,
          voter_id: user.id,
          community_id: communityId,
          vote_type: voteType,
          reasoning,
          created_at: new Date().toISOString()
        })));
        
        // Refresh reports to get updated vote counts
        loadReports();
      } else {
        alert(result.error || 'Failed to cast vote');
      }
    } catch (err) {
      alert('An unexpected error occurred while voting');
    } finally {
      setVotingOnReport(null);
    }
  };

  const handleViewRecording = async (meetingSessionId: string) => {
    if (!meetingSessionId) return;
    
    setViewingRecording(meetingSessionId);
    setLoadingRecording(true);
    
    try {
      // First get the recording metadata
      const recordingResult = await reportingService.getMeetingRecording(meetingSessionId);
      
      if (recordingResult.success && recordingResult.recording) {
        // Then get a signed URL
        const urlResult = await reportingService.getRecordingUrl(recordingResult.recording.file_path);
        
        if (urlResult.success && urlResult.url) {
          setRecordingUrl(urlResult.url);
          
          // Get meeting date
          const { data: meeting } = await supabase
            .from('meeting_sessions')
            .select('start_time')
            .eq('id', meetingSessionId)
            .single();
            
          if (meeting) {
            setRecordingMeetingDate(meeting.start_time);
          } else {
            setRecordingMeetingDate(new Date().toISOString());
          }
          
          // Show recording player
          setShowRecordingPlayer(true);
        } else {
          alert('Failed to generate recording URL');
        }
      } else {
        alert('Recording not found. It may still be processing.');
      }
    } catch (err) {
      alert('An error occurred while retrieving the recording');
    } finally {
      setLoadingRecording(false);
      setViewingRecording(null);
    }
  };

  const canUserVote = (report: Report) => {
    return user && 
           report.status === 'pending' && 
           report.reporter_id !== user.id && 
           report.reported_member_id !== user.id &&
           !userVotes.has(report.id);
  };

  const toggleReportExpansion = (reportId: string) => {
    if (expandedReport === reportId) {
      setExpandedReport(null);
    } else {
      setExpandedReport(reportId);
    }
  };

  const filteredReports = reports;

  const handleRefresh = () => {
    loadReports();
    loadReportAnalytics();
  };

  if (loading && reports.length === 0) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto mb-2"></div>
          <p className="text-gray-600">Loading reports...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Header with Analytics Summary */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Community Reports</h2>
          <p className="text-gray-600 text-sm">Review and vote on community reports</p>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={handleRefresh}
            className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
            title="Refresh data"
          >
            <Icon icon="solar:refresh-bold-duotone" width={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Analytics Dashboard */}
      {reportAnalytics && (
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
            <Icon icon="solar:vote-bold-duotone" width={18} className="text-primary-600" />
            <span>Report Analytics</span>
          </h3>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="bg-yellow-50 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-yellow-600 mb-1">{reportAnalytics.pending_reports}</div>
              <div className="text-sm text-yellow-700">Pending Reports</div>
            </div>
            <div className="bg-green-50 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-green-600 mb-1">{reportAnalytics.resolved_reports}</div>
              <div className="text-sm text-green-700">Resolved Reports</div>
            </div>
            <div className="bg-red-50 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-red-600 mb-1">{reportAnalytics.disqualified_members}</div>
              <div className="text-sm text-red-700">Disqualified Members</div>
            </div>
            <div className="bg-orange-50 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-orange-600 mb-1">{reportAnalytics.false_reports}</div>
              <div className="text-sm text-orange-700">False Reports</div>
            </div>
          </div>
          
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-gray-600">Average Resolution Time</span>
            <span className="font-medium text-gray-900">{reportAnalytics.average_resolution_hours.toFixed(1)} hours</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div 
              className="bg-gradient-to-r from-green-500 to-green-600 h-2.5 rounded-full"
              style={{ width: `${Math.min(100, (reportAnalytics.average_resolution_hours / 48) * 100)}%` }}
            ></div>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Lower is better - target is under 24 hours
          </p>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center space-x-3">
          <Icon icon="solar:danger-triangle-bold-duotone" width={20} className="text-red-600 flex-shrink-0" />
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Filters</h3>
          
          {/* Filter Tabs */}
          <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
            {[
              { key: 'pending', label: 'Pending', count: reports.filter(r => r.status === 'pending').length },
              { key: 'resolved', label: 'Resolved', count: reports.filter(r => r.status.startsWith('resolved_')).length },
              { key: 'all', label: 'All', count: reports.length }
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key as any)}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  filter === tab.key
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {tab.label} ({tab.count})
              </button>
            ))}
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Date Range Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="all">All Time</option>
              <option value="7days">Last 7 Days</option>
              <option value="30days">Last 30 Days</option>
              <option value="90days">Last 90 Days</option>
            </select>
          </div>
          
          {/* Violation Type Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Violation Type</label>
            <select
              value={violationFilter}
              onChange={(e) => setViolationFilter(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="all">All Types</option>
              <option value="not_working">Not Working</option>
              <option value="wrong_task">Wrong Task</option>
              <option value="inappropriate_behavior">Inappropriate Behavior</option>
              <option value="other">Other</option>
            </select>
          </div>
          
          {/* Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
            <div className="relative">
              <input
                type="text"
                placeholder="Search reports..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 pl-10 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
              <Icon icon="solar:magnifer-bold-duotone" width={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Reports List */}
      {filteredReports.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl shadow-sm">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Icon icon="solar:vote-bold-duotone" width={32} className="text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {filter === 'pending' ? 'No Pending Reports' : 
             filter === 'resolved' ? 'No Resolved Reports' : 
             'No Reports Yet'}
          </h3>
          <p className="text-gray-600">
            {filter === 'pending' 
              ? 'All reports have been resolved or there are no active reports.'
              : filter === 'resolved'
              ? 'No reports have been resolved yet.'
              : 'No reports have been filed in this community yet.'
            }
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {filteredReports.map((report) => (
            <ReportVotingCard
              key={report.id}
              report={report}
              userVote={userVotes.get(report.id)}
              canVote={canUserVote(report)}
              onVote={handleVote}
              onViewRecording={handleViewRecording}
              isVoting={votingOnReport === report.id}
              isExpanded={expandedReport === report.id}
              onToggleExpand={() => toggleReportExpansion(report.id)}
            />
          ))}
        </div>
      )}

      {/* Recording Player Modal */}
      {showRecordingPlayer && recordingUrl && (
        <RecordingPlayer
          recordingUrl={recordingUrl}
          meetingDate={recordingMeetingDate}
          onClose={() => setShowRecordingPlayer(false)}
          isOpen={showRecordingPlayer}
        />
      )}
    </div>
  );
}