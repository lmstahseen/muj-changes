import React, { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { useAuth } from '../contexts/AuthContext';
import reportingService, { Report, ReportVote } from '../services/reportingService';

interface ReportingInterfaceProps {
  communityId: string;
  meetingSessionId?: string;
  participantId?: string;
  participantName?: string;
  onClose: () => void;
}

export function ReportingInterface({ 
  communityId, 
  meetingSessionId, 
  participantId, 
  participantName, 
  onClose 
}: ReportingInterfaceProps) {
  const { user } = useAuth();
  const [violationType, setViolationType] = useState<Report['violation_type']>('not_working');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [recordingAvailable, setRecordingAvailable] = useState(false);

  useEffect(() => {
    // Check if recording is available for this meeting
    if (meetingSessionId) {
      checkRecordingAvailability();
    }
  }, [meetingSessionId]);

  const checkRecordingAvailability = async () => {
    try {
      const result = await reportingService.getMeetingRecording(meetingSessionId!);
      setRecordingAvailable(result.success && !!result.recording);
    } catch (err) {
      console.error('Error checking recording availability:', err);
      setRecordingAvailable(false);
    }
  };

  const violationTypes = [
    {
      value: 'not_working' as const,
      label: 'Attended but not working',
      description: 'Member is present but not actively working on their goals'
    },
    {
      value: 'wrong_task' as const,
      label: 'Working on something else',
      description: 'Member is working on tasks unrelated to their community goals'
    },
    {
      value: 'inappropriate_behavior' as const,
      label: 'Inappropriate behavior',
      description: 'Member is displaying behavior that violates community standards'
    },
    {
      value: 'other' as const,
      label: 'Other violation',
      description: 'Other violation not covered by the above categories'
    }
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user || !participantId) return;
    
    setIsSubmitting(true);
    setError('');

    try {
      const result = await reportingService.createReport({
        communityId,
        meetingSessionId,
        reporterId: user.id,
        reportedMemberId: participantId,
        violationType,
        description: description.trim()
      });

      if (result.success) {
        setSuccess(true);
        setTimeout(() => {
          onClose();
        }, 3000);
      } else {
        setError(result.error || 'Failed to submit report');
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
              <Icon icon="solar:danger-triangle-bold-duotone" width={20} className="text-red-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Report Member</h2>
              <p className="text-sm text-gray-600">Reporting: {participantName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <Icon icon="solar:close-circle-bold-duotone" width={24} />
          </button>
        </div>

        {/* Success Message */}
        {success && (
          <div className="p-6 bg-green-50 border-b border-green-200">
            <div className="flex items-center space-x-3">
              <Icon icon="solar:check-circle-bold-duotone" width={24} className="text-green-600 flex-shrink-0" />
              <div>
                <h3 className="text-lg font-semibold text-green-800 mb-1">Report Submitted Successfully</h3>
                <p className="text-green-700">
                  Your report has been submitted and community members will be notified to vote on this matter.
                  You'll be notified of the outcome once the voting process is complete.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Warning Notice */}
        {!success && (
          <div className="p-6 bg-yellow-50 border-b border-yellow-200">
            <div className="flex items-start space-x-3">
              <Icon icon="solar:danger-triangle-bold-duotone" width={20} className="text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-semibold text-yellow-800 mb-1">Important Warning</h3>
                <p className="text-sm text-yellow-700">
                  Reports must be legitimate and based on actual violations. False reports may result in your own 
                  disqualification and forfeiture of your stake. The community will vote on this report, and meeting 
                  recordings may be reviewed as evidence.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Form */}
        {!success && (
          <form onSubmit={handleSubmit} className="p-6">
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-3">
                <Icon icon="solar:danger-triangle-bold-duotone" width={20} className="text-red-600 flex-shrink-0" />
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            )}

            {/* Violation Type */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Violation Type *
              </label>
              <div className="space-y-3">
                {violationTypes.map((type) => (
                  <label
                    key={type.value}
                    className={`flex items-start space-x-3 p-4 border-2 rounded-xl cursor-pointer transition-all ${
                      violationType === type.value
                        ? 'border-red-300 bg-red-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="violationType"
                      value={type.value}
                      checked={violationType === type.value}
                      onChange={(e) => setViolationType(e.target.value as Report['violation_type'])}
                      className="mt-1"
                    />
                    <div>
                      <div className="font-medium text-gray-900">{type.label}</div>
                      <div className="text-sm text-gray-600">{type.description}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Description */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Detailed Description *
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Provide specific details about the violation. Include timestamps, specific behaviors observed, and any other relevant information..."
                rows={4}
                maxLength={1000}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent"
                required
              />
              <div className="flex justify-between items-center mt-2">
                <p className="text-xs text-gray-500">
                  Be specific and factual. This information will be reviewed by community members.
                </p>
                <span className="text-xs text-gray-500">{description.length}/1000</span>
              </div>
            </div>

            {/* Evidence Notice */}
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
              <div className="flex items-start space-x-3">
                <Icon icon="solar:videocamera-record-bold-duotone" width={20} className="text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-semibold text-blue-800 mb-1">Meeting Recording Evidence</h4>
                  <p className="text-sm text-blue-700">
                    {recordingAvailable ? 
                      "This meeting is being recorded and will be available for community members to review when voting on this report. The recording will serve as primary evidence for your claim." :
                      "Meeting recordings are automatically captured and will be available for community members to review when voting on this report, if available."
                    }
                  </p>
                </div>
              </div>
            </div>

            {/* Consequences Notice */}
            <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-xl">
              <h4 className="text-sm font-semibold text-gray-800 mb-2">Potential Consequences</h4>
              <ul className="text-sm text-gray-700 space-y-1">
                <li>• Community members will vote on this report</li>
                <li>• If upheld: Reported member may be disqualified and forfeit their stake</li>
                <li>• If deemed false: You may face penalties including stake forfeiture</li>
                <li>• Meeting recordings will be reviewed as evidence</li>
                <li>• Decision is final and based on community majority vote</li>
              </ul>
            </div>

            {/* Actions */}
            <div className="flex space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !description.trim()}
                className="flex-1 px-6 py-3 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Submitting Report...' : 'Submit Report'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}