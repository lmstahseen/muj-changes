import React, { useState, useEffect, useRef } from 'react';
import { Icon } from '@iconify/react';

interface PreMeetingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onJoin: (sharingMethod: 'camera' | 'screen') => void;
}

export function PreMeetingModal({ isOpen, onClose, onJoin }: PreMeetingModalProps) {
  const [selectedMethod, setSelectedMethod] = useState<'camera' | 'screen'>('camera');
  const [testStream, setTestStream] = useState<MediaStream | null>(null);
  const [deviceStatus, setDeviceStatus] = useState({
    camera: 'untested' as 'untested' | 'testing' | 'success' | 'error',
    microphone: 'untested' as 'untested' | 'testing' | 'success' | 'error',
    screen: 'untested' as 'untested' | 'testing' | 'success' | 'error'
  });
  const [errorMessage, setErrorMessage] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      testDevices();
    }
    return () => {
      cleanup();
    };
  }, [isOpen]);

  const testDevices = async () => {
    setDeviceStatus(prev => ({ ...prev, camera: 'testing', microphone: 'testing' }));
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      
      setTestStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      
      setDeviceStatus(prev => ({ ...prev, camera: 'success', microphone: 'success' }));
    } catch (error) {
      console.error('Device test error:', error);
      setDeviceStatus(prev => ({ ...prev, camera: 'error', microphone: 'error' }));
      setErrorMessage('Failed to access camera/microphone. Please check permissions.');
    }
  };

  const testScreenShare = async () => {
    setDeviceStatus(prev => ({ ...prev, screen: 'testing' }));
    
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true
      });
      
      // Stop the test stream immediately
      screenStream.getTracks().forEach(track => track.stop());
      
      setDeviceStatus(prev => ({ ...prev, screen: 'success' }));
    } catch (error) {
      console.error('Screen share test error:', error);
      setDeviceStatus(prev => ({ ...prev, screen: 'error' }));
      setErrorMessage('Failed to access screen sharing. Please check permissions.');
    }
  };

  const cleanup = () => {
    if (testStream) {
      testStream.getTracks().forEach(track => track.stop());
      setTestStream(null);
    }
  };

  const handleJoin = () => {
    if (selectedMethod === 'camera' && deviceStatus.camera !== 'success') {
      setErrorMessage('Camera access is required for video meetings');
      return;
    }
    
    if (selectedMethod === 'screen' && deviceStatus.screen !== 'success') {
      setErrorMessage('Screen sharing access is required');
      return;
    }
    
    cleanup();
    onJoin(selectedMethod);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'testing': return <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />;
      case 'success': return <Icon icon="solar:check-circle-bold-duotone" width={16} className="text-green-600" />;
      case 'error': return <Icon icon="solar:danger-triangle-bold-duotone" width={16} className="text-red-600" />;
      default: return <div className="w-4 h-4 bg-gray-300 rounded-full" />;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div 
        ref={modalRef}
        className="bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Join Meeting</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <Icon icon="solar:close-circle-bold-duotone" width={24} />
          </button>
        </div>

        <div className="p-6">
          {/* Device Testing */}
          <div className="mb-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Device Check</h3>
            
            {/* Video Preview */}
            <div className="bg-gray-900 rounded-lg mb-4 aspect-video relative overflow-hidden">
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover"
              />
              {!testStream && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-white text-center">
                    <Icon icon="solar:videocamera-record-bold-duotone" width={48} className="mx-auto mb-2 opacity-50" />
                    <p>Testing camera access...</p>
                  </div>
                </div>
              )}
            </div>

            {/* Device Status */}
            <div className="grid grid-cols-3 gap-4">
              <div className="flex items-center space-x-2 p-3 bg-gray-50 rounded-lg">
                {getStatusIcon(deviceStatus.camera)}
                <span className="text-sm font-medium">Camera</span>
              </div>
              <div className="flex items-center space-x-2 p-3 bg-gray-50 rounded-lg">
                {getStatusIcon(deviceStatus.microphone)}
                <span className="text-sm font-medium">Microphone</span>
              </div>
              <div className="flex items-center space-x-2 p-3 bg-gray-50 rounded-lg">
                {getStatusIcon(deviceStatus.screen)}
                <span className="text-sm font-medium">Screen Share</span>
                {deviceStatus.screen === 'untested' && (
                  <button
                    onClick={testScreenShare}
                    className="text-xs text-primary-600 hover:text-primary-700 ml-auto"
                  >
                    Test
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Sharing Method Selection */}
          <div className="mb-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Choose Sharing Method</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setSelectedMethod('camera')}
                className={`p-4 border-2 rounded-xl transition-all ${
                  selectedMethod === 'camera'
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <Icon icon="solar:camera-bold-duotone" width={32} className={`mx-auto mb-2 ${
                  selectedMethod === 'camera' ? 'text-primary-600' : 'text-gray-400'
                }`} />
                <div className="text-center">
                  <div className="font-medium text-gray-900">Camera</div>
                  <div className="text-sm text-gray-600">Show yourself on camera</div>
                </div>
              </button>

              <button
                onClick={() => setSelectedMethod('screen')}
                className={`p-4 border-2 rounded-xl transition-all ${
                  selectedMethod === 'screen'
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <Icon icon="solar:monitor-bold-duotone" width={32} className={`mx-auto mb-2 ${
                  selectedMethod === 'screen' ? 'text-primary-600' : 'text-gray-400'
                }`} />
                <div className="text-center">
                  <div className="font-medium text-gray-900">Screen Share</div>
                  <div className="text-sm text-gray-600">Share your screen/work</div>
                </div>
              </button>
            </div>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-3">
              <Icon icon="solar:danger-triangle-bold-duotone" width={20} className="text-red-600 flex-shrink-0" />
              <p className="text-red-700 text-sm">{errorMessage}</p>
            </div>
          )}

          {/* Meeting Guidelines */}
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <h4 className="font-medium text-yellow-800 mb-2">Meeting Guidelines</h4>
            <ul className="text-sm text-yellow-700 space-y-1">
              <li>• You must share your screen or camera to participate</li>
              <li>• Meetings are recorded for accountability purposes</li>
              <li>• Be prepared to show your work progress</li>
              <li>• Maintain respectful communication</li>
            </ul>
          </div>
        </div>

        <div className="flex justify-end space-x-3 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleJoin}
            disabled={
              (selectedMethod === 'camera' && deviceStatus.camera !== 'success') ||
              (selectedMethod === 'screen' && deviceStatus.screen !== 'success')
            }
            className="px-6 py-2 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-lg hover:from-primary-600 hover:to-primary-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Join Meeting
          </button>
        </div>
      </div>
    </div>
  );
}