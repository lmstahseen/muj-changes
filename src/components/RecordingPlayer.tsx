import React, { useState, useRef, useEffect } from 'react';
import { Icon } from '@iconify/react';

interface RecordingPlayerProps {
  recordingUrl: string;
  meetingDate: string;
  onClose: () => void;
  isOpen: boolean;
}

export function RecordingPlayer({ recordingUrl, meetingDate, onClose, isOpen }: RecordingPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<HTMLDivElement>(null);
  const progressInterval = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (!isOpen) return;
    
    const videoElement = videoRef.current;
    if (!videoElement) return;
    
    const handleLoadedMetadata = () => {
      setDuration(videoElement.duration);
      setIsLoading(false);
    };
    
    const handleError = () => {
      setError('Error loading video. The recording may be unavailable or still processing.');
      setIsLoading(false);
    };
    
    const handleTimeUpdate = () => {
      setCurrentTime(videoElement.currentTime);
    };
    
    const handleEnded = () => {
      setIsPlaying(false);
    };
    
    videoElement.addEventListener('loadedmetadata', handleLoadedMetadata);
    videoElement.addEventListener('error', handleError);
    videoElement.addEventListener('timeupdate', handleTimeUpdate);
    videoElement.addEventListener('ended', handleEnded);
    
    return () => {
      videoElement.removeEventListener('loadedmetadata', handleLoadedMetadata);
      videoElement.removeEventListener('error', handleError);
      videoElement.removeEventListener('timeupdate', handleTimeUpdate);
      videoElement.removeEventListener('ended', handleEnded);
      
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
      }
    };
  }, [isOpen, recordingUrl]);

  useEffect(() => {
    const handleFullScreenChange = () => {
      setIsFullScreen(!!document.fullscreenElement);
    };
    
    document.addEventListener('fullscreenchange', handleFullScreenChange);
    
    return () => {
      document.removeEventListener('fullscreenchange', handleFullScreenChange);
    };
  }, []);

  const togglePlayPause = () => {
    const video = videoRef.current;
    if (!video) return;
    
    if (isPlaying) {
      video.pause();
    } else {
      video.play();
    }
    
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;
    
    const seekTime = parseFloat(e.target.value);
    video.currentTime = seekTime;
    setCurrentTime(seekTime);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;
    
    const newVolume = parseFloat(e.target.value);
    video.volume = newVolume;
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    
    if (isMuted) {
      video.volume = volume || 1;
      setIsMuted(false);
    } else {
      video.volume = 0;
      setIsMuted(true);
    }
  };

  const toggleFullScreen = () => {
    if (!playerRef.current) return;
    
    if (!isFullScreen) {
      playerRef.current.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  const skipForward = () => {
    const video = videoRef.current;
    if (!video) return;
    
    video.currentTime = Math.min(video.duration, video.currentTime + 10);
  };

  const skipBackward = () => {
    const video = videoRef.current;
    if (!video) return;
    
    video.currentTime = Math.max(0, video.currentTime - 10);
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div 
        ref={playerRef}
        className="bg-black rounded-xl overflow-hidden max-w-4xl w-full max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="bg-gray-900 p-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Icon icon="solar:clock-circle-bold-duotone" width={16} className="text-gray-400" />
            <h3 className="text-white font-medium">Meeting Recording - {new Date(meetingDate).toLocaleDateString()}</h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <Icon icon="solar:close-circle-bold-duotone" width={20} />
          </button>
        </div>
        
        {/* Video Container */}
        <div className="relative flex-1 bg-black flex items-center justify-center">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 z-10">
              <div className="w-12 h-12 border-4 border-gray-600 border-t-white rounded-full animate-spin"></div>
            </div>
          )}
          
          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 z-10">
              <div className="text-center text-white p-4">
                <Icon icon="solar:danger-triangle-bold-duotone" width={48} className="mx-auto mb-4 text-yellow-500" />
                <p className="text-lg font-medium mb-2">Recording Unavailable</p>
                <p>{error}</p>
              </div>
            </div>
          )}
          
          <video
            ref={videoRef}
            src={recordingUrl}
            className="max-w-full max-h-full"
            playsInline
          />
          
          {/* Overlay Controls (show on hover) */}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
            <div className="flex space-x-4">
              <button
                onClick={skipBackward}
                className="w-12 h-12 rounded-full bg-black bg-opacity-50 flex items-center justify-center text-white hover:bg-opacity-70 transition-colors"
              >
                <Icon icon="solar:skip-previous-bold-duotone" width={24} />
              </button>
              
              <button
                onClick={togglePlayPause}
                className="w-16 h-16 rounded-full bg-primary-600 flex items-center justify-center text-white hover:bg-primary-700 transition-colors"
              >
                <Icon icon={isPlaying ? "solar:pause-bold-duotone" : "solar:play-bold-duotone"} width={32} />
              </button>
              
              <button
                onClick={skipForward}
                className="w-12 h-12 rounded-full bg-black bg-opacity-50 flex items-center justify-center text-white hover:bg-opacity-70 transition-colors"
              >
                <Icon icon="solar:skip-next-bold-duotone" width={24} />
              </button>
            </div>
          </div>
        </div>
        
        {/* Controls */}
        <div className="bg-gray-900 p-4">
          {/* Progress Bar */}
          <div className="flex items-center space-x-2 mb-4">
            <span className="text-gray-300 text-sm">{formatTime(currentTime)}</span>
            <div className="flex-1 relative">
              <input
                type="range"
                min="0"
                max={duration || 100}
                value={currentTime}
                onChange={handleSeek}
                className="w-full h-2 bg-gray-700 rounded-full appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${(currentTime / (duration || 1)) * 100}%, #374151 ${(currentTime / (duration || 1)) * 100}%, #374151 100%)`
                }}
              />
            </div>
            <span className="text-gray-300 text-sm">{formatTime(duration)}</span>
          </div>
          
          {/* Control Buttons */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={togglePlayPause}
                className="text-white hover:text-primary-400 transition-colors"
              >
                <Icon icon={isPlaying ? "solar:pause-bold-duotone" : "solar:play-bold-duotone"} width={20} />
              </button>
              
              <div className="flex items-center space-x-2">
                <button
                  onClick={toggleMute}
                  className="text-white hover:text-primary-400 transition-colors"
                >
                  <Icon icon={isMuted ? "solar:volume-cross-bold-duotone" : "solar:volume-loud-bold-duotone"} width={20} />
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="w-20 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="text-gray-400 text-sm">
                <span className="font-medium">Evidence Recording</span>
              </div>
              
              <button
                onClick={toggleFullScreen}
                className="text-white hover:text-primary-400 transition-colors"
              >
                <Icon icon={isFullScreen ? "solar:minimize-square-bold-duotone" : "solar:maximize-square-bold-duotone"} width={20} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}