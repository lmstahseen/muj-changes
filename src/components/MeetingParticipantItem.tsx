import React, { useState } from 'react';
import { MoreVertical, VideoOff, MicOff, Monitor, AlertTriangle } from 'lucide-react';

interface MeetingParticipantItemProps {
  participant: {
    id: string;
    userId: string;
    name: string;
    avatar: string;
    joinedAt: Date;
    isScreenSharing: boolean;
    isVideoOn: boolean;
    isAudioOn: boolean;
    progress: number;
    totalHours: number;
  };
  isLocal: boolean;
  onReport: (participantId: string) => void;
  duration: number;
}

export function MeetingParticipantItem({ participant, isLocal, onReport, duration }: MeetingParticipantItemProps) {
  const [showMenu, setShowMenu] = useState(false);
  
  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };
  
  return (
    <div className="flex items-center space-x-3 p-3 bg-gray-700 rounded-lg group relative">
      <div className="w-10 h-10 bg-primary-600 rounded-full flex items-center justify-center text-white">
        {participant.avatar || participant.name.charAt(0)}
      </div>
      <div className="flex-1">
        <div className="text-white font-medium">
          {participant.name}
          {isLocal && " (You)"}
        </div>
        <div className="text-gray-400 text-sm">
          {formatDuration(duration)}
        </div>
      </div>
      <div className="flex items-center space-x-1">
        {participant.isScreenSharing && <Monitor size={16} className="text-green-400" />}
        {!participant.isVideoOn && <VideoOff size={16} className="text-red-400" />}
        {!participant.isAudioOn && <MicOff size={16} className="text-red-400" />}
      </div>
      
      {!isLocal && (
        <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1 text-gray-400 hover:text-white rounded-full hover:bg-gray-600 transition-colors"
          >
            <MoreVertical size={14} />
          </button>
          
          {showMenu && (
            <div className="absolute right-0 mt-1 w-40 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-10">
              <button
                onClick={() => {
                  onReport(participant.userId);
                  setShowMenu(false);
                }}
                className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-gray-700 rounded-lg flex items-center space-x-2"
              >
                <AlertTriangle size={14} />
                <span>Report Member</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}