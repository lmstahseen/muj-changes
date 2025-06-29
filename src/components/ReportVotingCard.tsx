import React, { useState } from 'react';
import { Icon } from '@iconify/react';
import { Report, ReportVote } from '../services/reportingService';

interface ReportVotingCardProps {
  report: Report;
  userVote?: ReportVote;
  canVote: boolean;
  onVote: (reportId: string, voteType: ReportVote['vote_type'], reasoning?: string) => Promise<void>;
  onViewRecording: (meetingSessionId: string) => Promise<void>;
  isVoting: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

export function ReportVotingCard({ 
  report, 
  userVote, 
  canVote, 
  onVote, 
  onViewRecording, 
  isVoting,
  isExpanded,
  onToggleExpand
}: ReportVotingCardProps) {
  const [voteReasoning, setVoteReasoning] = useState('');
  const [showReasoningInput, setShowReasoningInput] = useState(false);
  const [selectedVoteType, setSelectedVoteType] = useState<ReportVote['vote_type'] | null>(null);

  const getVotePercentage = (voteType: keyof NonNullable<Report['vote_counts']>) => {
    if (!report.vote_counts || !report.total_eligible_voters) return 0;
    const votes = report.vote_counts[voteType] || 0;
    return Math.round((votes / report.total_eligible_voters) * 100);
  };

  const getTotalVotes = () => {
    if (!report.vote_counts) return 0;
    return (report.vote_counts.disqualify || 0) + 
           (report.vote_counts.no_action || 0) + 
           (report.vote_counts.false_report || 0);
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const handleVoteClick = (voteType: ReportVote['vote_type']) => {
    setSelectedVoteType(voteType);
    setShowReasoningInput(true);
  };

  const handleSubmitVote = async () => {
    if (!selectedVoteType) return;
    
    await onVote(report.id, selectedVoteType, voteReasoning.trim() || undefined);
    setShowReasoningInput(false);
    setVoteReasoning('');
    setSelectedVoteType(null);
  };

  const getStatusColor = (status: Report['status']) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'resolved_disqualify': return 'bg-red-100 text-red-800';
      case 'resolved_no_action': return 'bg-green-100 text-green-800';
      case 'resolved_false_report': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: Report['status']) => {
    switch (status) {
      case 'pending': return 'solar:clock-circle-bold-duotone';
      case 'resolved_disqualify': return 'solar:close-circle-bold-duotone';
      case 'resolved_no_action': return 'solar:check-circle-bold-duotone';
      case 'resolved_false_report': return 'solar:danger-triangle-bold-duotone';
      default: return 'solar:clock-circle-bold-duotone';
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      {/* Report Header */}
      <div 
        className="flex items-start justify-between p-6 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={onToggleExpand}
      >
        <div className="flex items-start space-x-4">
          <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
            <Icon icon="solar:danger-triangle-bold-duotone" width={20} className="text-red-600" />
          </div>
          <div>
            <div className="flex items-center space-x-3 mb-2">
              <h3 className="text-lg font-semibold text-gray-900">
                Member Violation Report
              </h3>
              <span className={`px-3 py-1 text-sm font-medium rounded-full flex items-center space-x-1 ${getStatusColor(report.status)}`}>
                <Icon icon={getStatusIcon(report.status)} width={14} />
                <span className="ml-1">{report.status.replace('resolved_', '').replace('_', ' ')}</span>
              </span>
            </div>
            <div className="text-sm text-gray-600 space-y-1">
              <p>Reported: {formatTimestamp(report.created_at)}</p>
              <p>Violation: <span className="capitalize">{report.violation_type.replace('_', ' ')}</span></p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          {report.meeting_session_id && (
            <button 
              onClick={(e) => {
                e.stopPropagation();
                onViewRecording(report.meeting_session_id!);
              }}
              className="flex items-center space-x-2 text-primary-600 hover:text-primary-700 text-sm font-medium"
            >
              <Icon icon="solar:eye-bold-duotone" width={16} />
              <span>Review Recording</span>
            </button>
          )}
          
          <button className="text-gray-400">
            <Icon icon={isExpanded ? "solar:alt-arrow-up-bold-duotone" : "solar:alt-arrow-down-bold-duotone"} width={20} />
          </button>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-gray-200 p-6">
          {/* Report Details */}
          <h4 className="font-medium text-gray-900 mb-3">Report Details</h4>
          <div className="mb-4 p-4 bg-gray-50 rounded-lg">
            <div className="grid md:grid-cols-2 gap-4 mb-3">
              <div>
                <span className="text-sm font-medium text-gray-700">Violation Type:</span>
                <p className="text-sm text-gray-900 capitalize">
                  {report.violation_type.replace('_', ' ')}
                </p>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-700">Report Date:</span>
                <p className="text-sm text-gray-900">{new Date(report.created_at).toLocaleDateString()}</p>
              </div>
            </div>
            <div>
              <span className="text-sm font-medium text-gray-700">Description:</span>
              <p className="text-sm text-gray-900 mt-1 whitespace-pre-line">{report.description}</p>
            </div>
          </div>

          {/* Voting Section */}
          {report.status === 'pending' && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-gray-900">Community Vote</h4>
                <span className="text-sm text-gray-600">
                  {getTotalVotes()} of {report.total_eligible_voters} eligible voters
                </span>
              </div>

              {/* Vote Counts */}
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="text-center p-3 bg-red-50 rounded-lg">
                  <div className="text-lg font-bold text-red-600">
                    {report.vote_counts?.disqualify || 0}
                  </div>
                  <div className="text-xs text-red-700">Disqualify</div>
                  <div className="text-xs text-red-600">
                    {getVotePercentage('disqualify')}%
                  </div>
                </div>
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <div className="text-lg font-bold text-green-600">
                    {report.vote_counts?.no_action || 0}
                  </div>
                  <div className="text-xs text-green-700">No Action</div>
                  <div className="text-xs text-green-600">
                    {getVotePercentage('no_action')}%
                  </div>
                </div>
                <div className="text-center p-3 bg-orange-50 rounded-lg">
                  <div className="text-lg font-bold text-orange-600">
                    {report.vote_counts?.false_report || 0}
                  </div>
                  <div className="text-xs text-orange-700">False Report</div>
                  <div className="text-xs text-orange-600">
                    {getVotePercentage('false_report')}%
                  </div>
                </div>
              </div>

              {/* Voting Buttons */}
              {canVote && !userVote && !showReasoningInput && (
                <div className="flex space-x-3">
                  <button
                    onClick={() => handleVoteClick('disqualify')}
                    disabled={isVoting}
                    className="flex-1 bg-red-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    Disqualify Member
                  </button>
                  <button
                    onClick={() => handleVoteClick('no_action')}
                    disabled={isVoting}
                    className="flex-1 bg-green-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    No Action
                  </button>
                  <button
                    onClick={() => handleVoteClick('false_report')}
                    disabled={isVoting}
                    className="flex-1 bg-orange-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-orange-700 transition-colors disabled:opacity-50"
                  >
                    False Report
                  </button>
                </div>
              )}

              {/* Reasoning Input */}
              {showReasoningInput && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                  <h5 className="text-sm font-medium text-gray-900 mb-2">
                    Provide reasoning for your vote (optional)
                  </h5>
                  <textarea
                    value={voteReasoning}
                    onChange={(e) => setVoteReasoning(e.target.value)}
                    placeholder="Explain why you're voting this way..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent mb-3"
                    rows={3}
                  />
                  <div className="flex space-x-3">
                    <button
                      onClick={() => {
                        setShowReasoningInput(false);
                        setSelectedVoteType(null);
                      }}
                      className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSubmitVote}
                      disabled={isVoting}
                      className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
                    >
                      {isVoting ? 'Submitting...' : 'Submit Vote'}
                    </button>
                  </div>
                </div>
              )}

              {/* User's Vote */}
              {userVote && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <Icon icon="solar:check-circle-bold-duotone" width={16} className="text-blue-600" />
                    <span className="text-sm font-medium text-blue-800">
                      You voted: {userVote.vote_type.replace('_', ' ')}
                    </span>
                  </div>
                  {userVote.reasoning && (
                    <p className="text-sm text-blue-700 mt-1">{userVote.reasoning}</p>
                  )}
                </div>
              )}

              {/* Cannot Vote Notice */}
              {!canVote && (
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                  <p className="text-sm text-gray-600">
                    You cannot vote on this report. This may be because you are the reporter, the reported member, or you've already voted.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Resolution */}
          {report.status.startsWith('resolved_') && report.resolution_reason && (
            <div className="p-4 bg-gray-50 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-2">Resolution</h4>
              <p className="text-sm text-gray-700">{report.resolution_reason}</p>
              
              {report.status === 'resolved_disqualify' && (
                <div className="mt-3 p-3 bg-red-50 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <Icon icon="solar:close-circle-bold-duotone" width={16} className="text-red-600" />
                    <span className="text-sm font-medium text-red-800">Member Disqualified</span>
                  </div>
                  <p className="text-sm text-red-700 mt-1">
                    The reported member has been disqualified and will forfeit their stake.
                  </p>
                </div>
              )}
              
              {report.status === 'resolved_false_report' && (
                <div className="mt-3 p-3 bg-orange-50 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <Icon icon="solar:danger-triangle-bold-duotone" width={16} className="text-orange-600" />
                    <span className="text-sm font-medium text-orange-800">False Report</span>
                  </div>
                  <p className="text-sm text-orange-700 mt-1">
                    The community determined this was a false report. The reporter has received a warning.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}