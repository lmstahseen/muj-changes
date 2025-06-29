import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Icon } from '@iconify/react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import meetingService from '../services/meetingService';
import { ChatInterface } from './ChatInterface';
import { ReportingInterface } from './ReportingInterface';

interface Participant {
  id: string;
  userId: string;
  name: string;
  avatar: string;
  joinedAt: Date;
  isScreenSharing: boolean;
  isVideoOn: boolean;
  isAudioOn: boolean;
  stream?: MediaStream;
  peerConnection?: RTCPeerConnection;
  progress: number;
  totalHours: number;
}

interface MeetingRoomProps {
  communityId: string;
  meetingSessionId: string;
  onLeaveMeeting: () => void;
  initialSharingMethod?: 'camera' | 'screen';
}

export function MeetingRoom({ communityId, meetingSessionId, onLeaveMeeting, initialSharingMethod = 'camera' }: MeetingRoomProps) {
  const { user } = useAuth();
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isAudioOn, setIsAudioOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(initialSharingMethod === 'screen');
  const [meetingDuration, setMeetingDuration] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'reconnecting'>('connecting');
  const [showChat, setShowChat] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [isRecording, setIsRecording] = useState(true);
  const [networkQuality, setNetworkQuality] = useState<'good' | 'fair' | 'poor'>('good');
  const [autoCleanupTimer, setAutoCleanupTimer] = useState<number | null>(null);
  const [showReportingModal, setShowReportingModal] = useState(false);
  const [reportingTarget, setReportingTarget] = useState<{ id: string; name: string } | null>(null);
  const [participantMenus, setParticipantMenus] = useState<Map<string, boolean>>(new Map());
  const [canEndMeeting, setCanEndMeeting] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [focusedParticipant, setFocusedParticipant] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const meetingStartTime = useRef<Date>(new Date());
  const durationInterval = useRef<NodeJS.Timeout>();
  const realtimeChannel = useRef<any>();
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const recordedChunks = useRef<Blob[]>([]);
  const reconnectAttempts = useRef<number>(0);
  const maxReconnectAttempts = 5;
  const inactivityTimer = useRef<NodeJS.Timeout>();
  const noParticipantsTimer = useRef<NodeJS.Timeout>();
  const autoEndCheckInterval = useRef<NodeJS.Timeout>();
  const meetingContainerRef = useRef<HTMLDivElement>(null);

  // ICE servers configuration with TURN servers for better connectivity
  const iceServers = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
  ];

  useEffect(() => {
    initializeMeeting();
    startInactivityMonitoring();
    startAutoEndCheck();
    
    return () => {
      cleanup();
    };
  }, []);

  useEffect(() => {
    // Update meeting duration every second
    durationInterval.current = setInterval(() => {
      setMeetingDuration(Math.floor((Date.now() - meetingStartTime.current.getTime()) / 1000));
    }, 1000);

    return () => {
      if (durationInterval.current) {
        clearInterval(durationInterval.current);
      }
    };
  }, []);

  useEffect(() => {
    // Check if user can end meeting (only if they're the only participant)
    const checkCanEndMeeting = async () => {
      if (user) {
        const canEnd = await meetingService.canEndMeeting(meetingSessionId, user.id);
        setCanEndMeeting(canEnd);
      }
    };
    
    checkCanEndMeeting();
    
    // Check again whenever participants change
    if (participants.length <= 1) {
      checkCanEndMeeting();
    } else {
      setCanEndMeeting(false);
    }
  }, [participants.length, meetingSessionId, user]);

  // Handle fullscreen mode
  useEffect(() => {
    const handleFullScreenChange = () => {
      setIsFullScreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullScreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullScreenChange);
    };
  }, []);

  const toggleFullScreen = () => {
    if (!isFullScreen) {
      meetingContainerRef.current?.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  const initializeMeeting = async () => {
    try {
      setConnectionStatus('connecting');
      
      // Get user media based on initial sharing method
      let stream: MediaStream;
      
      if (initialSharingMethod === 'screen') {
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true
        });
        
        // Handle screen share end
        stream.getVideoTracks()[0].onended = () => {
          switchToCamera();
        };
      } else {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        });
      }
      
      setLocalStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Start recording
      await startRecording(stream);

      // Initialize WebRTC signaling with retry logic
      await initializeSignalingWithRetry();
      
      // Record meeting attendance
      await recordAttendance();
      
      setConnectionStatus('connected');
      reconnectAttempts.current = 0;
    } catch (error) {
      console.error('Error initializing meeting:', error);
      setConnectionStatus('disconnected');
      handleConnectionError(error);
    }
  };

  const initializeSignalingWithRetry = async (attempt = 1): Promise<void> => {
    try {
      await initializeSignaling();
    } catch (error) {
      if (attempt < maxReconnectAttempts) {
        console.log(`Signaling connection attempt ${attempt} failed, retrying...`);
        setConnectionStatus('reconnecting');
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Exponential backoff
        return initializeSignalingWithRetry(attempt + 1);
      } else {
        throw error;
      }
    }
  };

  const handleConnectionError = (error: any) => {
    let errorMessage = 'Failed to join meeting. ';
    
    if (error.name === 'NotAllowedError') {
      errorMessage += 'Please allow camera and microphone access.';
    } else if (error.name === 'NotFoundError') {
      errorMessage += 'No camera or microphone found.';
    } else if (error.name === 'NotReadableError') {
      errorMessage += 'Camera or microphone is already in use.';
    } else {
      errorMessage += 'Please check your connection and try again.';
    }
    
    alert(errorMessage);
  };

  const startRecording = async (stream: MediaStream) => {
    try {
      const options = { mimeType: 'video/webm;codecs=vp9' };
      mediaRecorder.current = new MediaRecorder(stream, options);
      
      mediaRecorder.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunks.current.push(event.data);
        }
      };

      mediaRecorder.current.onstop = async () => {
        const blob = new Blob(recordedChunks.current, { type: 'video/webm' });
        await uploadRecording(blob);
      };

      mediaRecorder.current.start(1000); // Record in 1-second chunks
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
      setIsRecording(false);
    }
  };

  const uploadRecording = async (blob: Blob) => {
    try {
      const fileName = `meeting_${meetingSessionId}_${user?.id}_${Date.now()}.webm`;
      
      const { error } = await supabase.storage
        .from('meeting-recordings')
        .upload(fileName, blob, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        console.error('Error uploading recording:', error);
      } else {
        console.log('Recording uploaded successfully');
        
        // Store recording metadata in database
        await supabase
          .from('meeting_recordings')
          .insert({
            meeting_session_id: meetingSessionId,
            file_path: fileName,
            file_size: blob.size,
            duration_seconds: meetingDuration,
            upload_status: 'completed'
          });
      }
    } catch (error) {
      console.error('Error uploading recording:', error);
    }
  };

  const initializeSignaling = async () => {
    // Create Supabase Realtime channel for WebRTC signaling
    realtimeChannel.current = supabase.channel(`meeting_${meetingSessionId}`, {
      config: {
        broadcast: { self: true },
        presence: { key: user?.id }
      }
    });

    // Handle connection state changes
    realtimeChannel.current.on('system', {}, (payload: any) => {
      if (payload.extension === 'postgres_changes') {
        console.log('Database change detected:', payload);
      }
    });

    // Listen for new participants
    realtimeChannel.current.on('broadcast', { event: 'participant_joined' }, (payload: any) => {
      handleParticipantJoined(payload.payload);
    });

    // Listen for WebRTC offers
    realtimeChannel.current.on('broadcast', { event: 'webrtc_offer' }, (payload: any) => {
      handleWebRTCOffer(payload.payload);
    });

    // Listen for WebRTC answers
    realtimeChannel.current.on('broadcast', { event: 'webrtc_answer' }, (payload: any) => {
      handleWebRTCAnswer(payload.payload);
    });

    // Listen for ICE candidates
    realtimeChannel.current.on('broadcast', { event: 'ice_candidate' }, (payload: any) => {
      handleICECandidate(payload.payload);
    });

    // Listen for participant updates
    realtimeChannel.current.on('broadcast', { event: 'participant_update' }, (payload: any) => {
      handleParticipantUpdate(payload.payload);
    });

    // Listen for participant leaving
    realtimeChannel.current.on('broadcast', { event: 'participant_left' }, (payload: any) => {
      handleParticipantLeft(payload.payload);
    });

    // Listen for meeting end
    realtimeChannel.current.on('broadcast', { event: 'meeting_ended' }, (payload: any) => {
      handleMeetingEnded(payload.payload);
    });

    const subscriptionResult = await realtimeChannel.current.subscribe();
    
    if (subscriptionResult !== 'SUBSCRIBED') {
      throw new Error('Failed to subscribe to realtime channel');
    }

    // Announce joining with retry logic
    await announceJoining();
  };

  const announceJoining = async (attempt = 1): Promise<void> => {
    try {
      await realtimeChannel.current.send({
        type: 'broadcast',
        event: 'participant_joined',
        payload: {
          userId: user?.id,
          name: user?.name || 'User',
          avatar: user?.avatar || '👤',
          joinedAt: new Date().toISOString(),
          isVideoOn,
          isAudioOn,
          isScreenSharing,
          progress: 0,
          totalHours: 0
        }
      });
    } catch (error) {
      if (attempt < 3) {
        console.log(`Announce joining attempt ${attempt} failed, retrying...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        return announceJoining(attempt + 1);
      } else {
        console.error('Failed to announce joining after 3 attempts:', error);
      }
    }
  };

  const handleParticipantJoined = useCallback(async (participantData: any) => {
    if (participantData.userId === user?.id) return;

    const newParticipant: Participant = {
      id: participantData.userId,
      userId: participantData.userId,
      name: participantData.name || 'User',
      avatar: participantData.avatar || '👤',
      joinedAt: new Date(participantData.joinedAt),
      isScreenSharing: participantData.isScreenSharing,
      isVideoOn: participantData.isVideoOn,
      isAudioOn: participantData.isAudioOn,
      progress: participantData.progress || 0,
      totalHours: participantData.totalHours || 0
    };

    setParticipants(prev => {
      // Avoid duplicates
      const filtered = prev.filter(p => p.id !== newParticipant.id);
      return [...filtered, newParticipant];
    });

    // Create peer connection for new participant
    await createPeerConnection(participantData.userId);
  }, [user?.id]);

  const createPeerConnection = async (participantId: string) => {
    try {
      const peerConnection = new RTCPeerConnection({ iceServers });
      peerConnections.current.set(participantId, peerConnection);

      // Add local stream to peer connection
      if (localStream) {
        localStream.getTracks().forEach(track => {
          peerConnection.addTrack(track, localStream);
        });
      }

      // Handle incoming stream
      peerConnection.ontrack = (event) => {
        setParticipants(prev => prev.map(p => 
          p.id === participantId 
            ? { ...p, stream: event.streams[0] }
            : p
        ));
      };

      // Handle connection state changes
      peerConnection.onconnectionstatechange = () => {
        const state = peerConnection.connectionState;
        console.log(`Peer connection state for ${participantId}:`, state);
        
        if (state === 'failed' || state === 'disconnected') {
          handlePeerConnectionFailure(participantId);
        } else if (state === 'connected') {
          setNetworkQuality('good');
        }
      };

      // Handle ICE connection state changes
      peerConnection.oniceconnectionstatechange = () => {
        const state = peerConnection.iceConnectionState;
        console.log(`ICE connection state for ${participantId}:`, state);
        
        if (state === 'failed') {
          handlePeerConnectionFailure(participantId);
        } else if (state === 'disconnected') {
          setNetworkQuality('fair');
        } else if (state === 'checking') {
          setNetworkQuality('fair');
        } else if (state === 'connected' || state === 'completed') {
          setNetworkQuality('good');
        }
      };

      // Handle ICE candidates
      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          realtimeChannel.current?.send({
            type: 'broadcast',
            event: 'ice_candidate',
            payload: {
              candidate: event.candidate,
              targetUserId: participantId,
              fromUserId: user?.id
            }
          });
        }
      };

      // Create and send offer
      const offer = await peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });
      await peerConnection.setLocalDescription(offer);

      realtimeChannel.current?.send({
        type: 'broadcast',
        event: 'webrtc_offer',
        payload: {
          offer,
          targetUserId: participantId,
          fromUserId: user?.id
        }
      });
    } catch (error) {
      console.error('Error creating peer connection:', error);
    }
  };

  const handlePeerConnectionFailure = async (participantId: string) => {
    console.log(`Attempting to reconnect to ${participantId}`);
    
    // Close existing connection
    const existingConnection = peerConnections.current.get(participantId);
    if (existingConnection) {
      existingConnection.close();
      peerConnections.current.delete(participantId);
    }
    
    // Attempt to recreate connection
    setTimeout(() => {
      createPeerConnection(participantId);
    }, 2000);
  };

  const handleWebRTCOffer = async (payload: any) => {
    if (payload.targetUserId !== user?.id) return;

    try {
      const peerConnection = new RTCPeerConnection({ iceServers });
      peerConnections.current.set(payload.fromUserId, peerConnection);

      // Add local stream
      if (localStream) {
        localStream.getTracks().forEach(track => {
          peerConnection.addTrack(track, localStream);
        });
      }

      // Handle incoming stream
      peerConnection.ontrack = (event) => {
        setParticipants(prev => prev.map(p => 
          p.id === payload.fromUserId 
            ? { ...p, stream: event.streams[0] }
            : p
        ));
      };

      // Handle connection state changes
      peerConnection.onconnectionstatechange = () => {
        const state = peerConnection.connectionState;
        if (state === 'failed' || state === 'disconnected') {
          handlePeerConnectionFailure(payload.fromUserId);
        }
      };

      // Handle ICE candidates
      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          realtimeChannel.current?.send({
            type: 'broadcast',
            event: 'ice_candidate',
            payload: {
              candidate: event.candidate,
              targetUserId: payload.fromUserId,
              fromUserId: user?.id
            }
          });
        }
      };

      // Set remote description and create answer
      await peerConnection.setRemoteDescription(payload.offer);
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);

      realtimeChannel.current?.send({
        type: 'broadcast',
        event: 'webrtc_answer',
        payload: {
          answer,
          targetUserId: payload.fromUserId,
          fromUserId: user?.id
        }
      });
    } catch (error) {
      console.error('Error handling WebRTC offer:', error);
    }
  };

  const handleWebRTCAnswer = async (payload: any) => {
    if (payload.targetUserId !== user?.id) return;

    try {
      const peerConnection = peerConnections.current.get(payload.fromUserId);
      if (peerConnection) {
        await peerConnection.setRemoteDescription(payload.answer);
      }
    } catch (error) {
      console.error('Error handling WebRTC answer:', error);
    }
  };

  const handleICECandidate = async (payload: any) => {
    if (payload.targetUserId !== user?.id) return;

    try {
      const peerConnection = peerConnections.current.get(payload.fromUserId);
      if (peerConnection) {
        await peerConnection.addIceCandidate(payload.candidate);
      }
    } catch (error) {
      console.error('Error handling ICE candidate:', error);
    }
  };

  const handleParticipantUpdate = useCallback((payload: any) => {
    setParticipants(prev => prev.map(p => 
      p.id === payload.userId 
        ? { 
            ...p, 
            isVideoOn: payload.isVideoOn,
            isAudioOn: payload.isAudioOn,
            isScreenSharing: payload.isScreenSharing
          }
        : p
    ));
  }, []);

  const handleParticipantLeft = useCallback((payload: any) => {
    setParticipants(prev => prev.filter(p => p.id !== payload.userId));
    
    // Clean up peer connection
    const peerConnection = peerConnections.current.get(payload.userId);
    if (peerConnection) {
      peerConnection.close();
      peerConnections.current.delete(payload.userId);
    }
  }, []);

  const handleMeetingEnded = useCallback((payload: any) => {
    alert('The meeting has been ended.');
    leaveMeeting();
  }, []);

  const recordAttendance = async () => {
    try {
      await supabase.from('meeting_attendance').insert({
        meeting_session_id: meetingSessionId,
        user_id: user?.id,
        community_id: communityId,
        joined_at: new Date().toISOString(),
        screen_shared: isScreenSharing
      });
    } catch (error) {
      console.error('Error recording attendance:', error);
    }
  };

  const updateAttendance = async () => {
    try {
      const duration = Math.floor((Date.now() - meetingStartTime.current.getTime()) / 1000);
      
      await meetingService.leaveMeeting(meetingSessionId, user?.id || '', duration, isScreenSharing);
    } catch (error) {
      console.error('Error updating attendance:', error);
    }
  };

  const toggleVideo = async () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !isVideoOn;
        setIsVideoOn(!isVideoOn);
        
        // Broadcast update
        realtimeChannel.current?.send({
          type: 'broadcast',
          event: 'participant_update',
          payload: {
            userId: user?.id,
            isVideoOn: !isVideoOn,
            isAudioOn,
            isScreenSharing
          }
        });
      }
    }
  };

  const toggleAudio = async () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !isAudioOn;
        setIsAudioOn(!isAudioOn);
        
        // Broadcast update
        realtimeChannel.current?.send({
          type: 'broadcast',
          event: 'participant_update',
          payload: {
            userId: user?.id,
            isVideoOn,
            isAudioOn: !isAudioOn,
            isScreenSharing
          }
        });
      }
    }
  };

  const toggleScreenShare = async () => {
    try {
      if (!isScreenSharing) {
        // Start screen sharing
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true
        });
        
        // Replace video track in all peer connections
        const videoTrack = screenStream.getVideoTracks()[0];
        peerConnections.current.forEach(pc => {
          const sender = pc.getSenders().find(s => s.track?.kind === 'video');
          if (sender) {
            sender.replaceTrack(videoTrack);
          }
        });
        
        // Update local video
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream;
        }
        
        // Update local stream
        const audioTrack = localStream?.getAudioTracks()[0];
        if (audioTrack) {
          screenStream.addTrack(audioTrack);
        }
        
        setLocalStream(screenStream);
        setIsScreenSharing(true);
        
        // Handle screen share end
        videoTrack.onended = () => {
          switchToCamera();
        };
      } else {
        switchToCamera();
      }
      
      // Broadcast update
      realtimeChannel.current?.send({
        type: 'broadcast',
        event: 'participant_update',
        payload: {
          userId: user?.id,
          isVideoOn,
          isAudioOn,
          isScreenSharing: !isScreenSharing
        }
      });
    } catch (error) {
      console.error('Error toggling screen share:', error);
      alert('Failed to start screen sharing. Please try again.');
    }
  };

  const switchToCamera = async () => {
    try {
      // Get camera stream back
      const cameraStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      
      // Replace video track in all peer connections
      const videoTrack = cameraStream.getVideoTracks()[0];
      peerConnections.current.forEach(pc => {
        const sender = pc.getSenders().find(s => s.track?.kind === 'video');
        if (sender) {
          sender.replaceTrack(videoTrack);
        }
      });
      
      // Update local video
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = cameraStream;
      }
      
      // Stop previous stream
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
      
      setLocalStream(cameraStream);
      setIsScreenSharing(false);
    } catch (error) {
      console.error('Error switching to camera:', error);
      alert('Failed to switch to camera. Please check permissions.');
    }
  };

  const startInactivityMonitoring = () => {
    // Reset inactivity timer on user interaction
    const resetInactivityTimer = () => {
      if (inactivityTimer.current) {
        clearTimeout(inactivityTimer.current);
      }
      
      inactivityTimer.current = setTimeout(() => {
        handleAutoCleanup('inactivity');
      }, 5 * 60 * 1000); // 5 minutes of inactivity
    };

    // Listen for user interactions
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach(event => {
      document.addEventListener(event, resetInactivityTimer, true);
    });

    // Start initial timer
    resetInactivityTimer();

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, resetInactivityTimer, true);
      });
      if (inactivityTimer.current) {
        clearTimeout(inactivityTimer.current);
      }
    };
  };

  const startAutoEndCheck = () => {
    // Check every 30 seconds if meeting should auto-end
    autoEndCheckInterval.current = setInterval(async () => {
      // Check if we're the only participant
      if (participants.length === 0) {
        // Check if we've been alone for 2 minutes
        const { data: activeParticipants } = await supabase
          .from('meeting_participants')
          .select('id')
          .eq('meeting_session_id', meetingSessionId)
          .eq('is_active', true);
        
        if (!activeParticipants || activeParticipants.length <= 1) {
          // We're alone, check if we can end the meeting
          const canEnd = await meetingService.canEndMeeting(meetingSessionId, user?.id || '');
          setCanEndMeeting(canEnd);
        }
      }
    }, 30000); // Check every 30 seconds
    
    return () => {
      if (autoEndCheckInterval.current) {
        clearInterval(autoEndCheckInterval.current);
      }
    };
  };

  const handleAutoCleanup = async (reason: 'inactivity' | 'no_participants') => {
    console.log(`Auto cleanup triggered: ${reason}`);
    
    if (reason === 'inactivity') {
      alert('Meeting ended due to inactivity.');
    } else if (reason === 'no_participants') {
      alert('Meeting ended - no other participants for 2 minutes.');
    }
    
    // End the meeting if we're the last participant
    if (participants.length === 0) {
      await meetingService.endMeeting(meetingSessionId, user?.id || '');
      
      // Broadcast meeting end
      realtimeChannel.current?.send({
        type: 'broadcast',
        event: 'meeting_ended',
        payload: {
          reason,
          endedBy: user?.id
        }
      });
    }
    
    leaveMeeting();
  };

  const leaveMeeting = async () => {
    // Stop recording
    if (mediaRecorder.current && mediaRecorder.current.state !== 'inactive') {
      mediaRecorder.current.stop();
    }

    await updateAttendance();
    
    // Announce leaving
    realtimeChannel.current?.send({
      type: 'broadcast',
      event: 'participant_left',
      payload: {
        userId: user?.id
      }
    });
    
    cleanup();
    onLeaveMeeting();
  };

  const endMeetingForAll = async () => {
    if (confirm('Are you sure you want to end the meeting for all participants?')) {
      await meetingService.endMeeting(meetingSessionId, user?.id || '');
      
      // Broadcast meeting end
      realtimeChannel.current?.send({
        type: 'broadcast',
        event: 'meeting_ended',
        payload: {
          reason: 'host_ended',
          endedBy: user?.id
        }
      });
      
      leaveMeeting();
    }
  };

  const cleanup = () => {
    // Stop local stream
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    
    // Close all peer connections
    peerConnections.current.forEach(pc => pc.close());
    peerConnections.current.clear();
    
    // Unsubscribe from realtime channel
    if (realtimeChannel.current) {
      realtimeChannel.current.unsubscribe();
    }
    
    // Clear intervals and timers
    if (durationInterval.current) {
      clearInterval(durationInterval.current);
    }
    if (inactivityTimer.current) {
      clearTimeout(inactivityTimer.current);
    }
    if (noParticipantsTimer.current) {
      clearTimeout(noParticipantsTimer.current);
    }
    if (autoEndCheckInterval.current) {
      clearInterval(autoEndCheckInterval.current);
    }
  };

  const handleReportParticipant = (participant: Participant) => {
    setReportingTarget({ id: participant.userId, name: participant.name });
    setShowReportingModal(true);
    setParticipantMenus(new Map());
  };

  const toggleParticipantMenu = (participantId: string) => {
    setParticipantMenus(prev => {
      const newMap = new Map(prev);
      newMap.set(participantId, !newMap.get(participantId));
      return newMap;
    });
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const getGridLayout = () => {
    const totalParticipants = participants.length + 1; // +1 for local user
    
    if (focusedParticipant) return 'grid-cols-1';
    if (totalParticipants === 1) return 'grid-cols-1';
    if (totalParticipants === 2) return 'grid-cols-2';
    if (totalParticipants <= 4) return 'grid-cols-2';
    if (totalParticipants <= 6) return 'grid-cols-3';
    return 'grid-cols-4';
  };

  const getConnectionStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return 'bg-green-500';
      case 'connecting': case 'reconnecting': return 'bg-yellow-500';
      case 'disconnected': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getNetworkQualityColor = () => {
    switch (networkQuality) {
      case 'good': return 'text-green-500';
      case 'fair': return 'text-yellow-500';
      case 'poor': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };

  const handleFocusParticipant = (participantId: string | null) => {
    setFocusedParticipant(participantId === focusedParticipant ? null : participantId);
  };

  const handleAudioLevelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const level = parseFloat(e.target.value);
    setAudioLevel(level);
    
    // Adjust audio levels for all remote participants
    participants.forEach(participant => {
      if (participant.stream) {
        const audioTracks = participant.stream.getAudioTracks();
        audioTracks.forEach(track => {
          // This is a simplified approach - in a real implementation,
          // you would use the Web Audio API for more precise control
          if (track.enabled) {
            track.enabled = level > 0;
          }
        });
      }
    });
    
    setIsMuted(level === 0);
  };

  return (
    <div ref={meetingContainerRef} className="h-screen bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="bg-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${getConnectionStatusColor()}`}></div>
            <span className="text-white font-medium">
              {connectionStatus === 'connected' ? 'Connected' :
               connectionStatus === 'connecting' ? 'Connecting...' :
               connectionStatus === 'reconnecting' ? 'Reconnecting...' :
               'Disconnected'}
            </span>
            {connectionStatus === 'reconnecting' && (
              <span className="text-yellow-400 text-sm">
                (Attempt {reconnectAttempts.current}/{maxReconnectAttempts})
              </span>
            )}
          </div>
          
          <div className="flex items-center space-x-2 text-white">
            <Icon icon="solar:clock-circle-bold-duotone" width={16} />
            <span>{formatDuration(meetingDuration)}</span>
          </div>
          
          <div className="flex items-center space-x-2 text-white">
            <Icon icon="solar:users-group-rounded-bold-duotone" width={16} />
            <span>{participants.length + 1} participants</span>
          </div>

          <div className={`flex items-center space-x-2 ${getNetworkQualityColor()}`}>
            <div className="flex space-x-1">
              <div className={`w-1 h-3 rounded ${networkQuality === 'poor' ? 'bg-current' : 'bg-gray-600'}`}></div>
              <div className={`w-1 h-3 rounded ${networkQuality === 'fair' || networkQuality === 'good' ? 'bg-current' : 'bg-gray-600'}`}></div>
              <div className={`w-1 h-3 rounded ${networkQuality === 'good' ? 'bg-current' : 'bg-gray-600'}`}></div>
            </div>
            <span className="text-xs">{networkQuality}</span>
          </div>

          {isRecording && (
            <div className="flex items-center space-x-2 text-red-400">
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
              <span className="text-sm font-medium">REC</span>
            </div>
          )}

          {autoCleanupTimer && (
            <div className="flex items-center space-x-2 text-yellow-400">
              <Icon icon="solar:danger-triangle-bold-duotone" width={16} />
              <span className="text-sm">Auto-cleanup in {Math.ceil(autoCleanupTimer / 60)}min</span>
            </div>
          )}
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={toggleFullScreen}
            className="bg-gray-700 hover:bg-gray-600 text-white p-2 rounded-lg transition-colors"
            title={isFullScreen ? "Exit fullscreen" : "Enter fullscreen"}
          >
            <Icon icon={isFullScreen ? "solar:minimize-square-bold-duotone" : "solar:maximize-square-bold-duotone"} width={20} />
          </button>
          
          {canEndMeeting && (
            <button
              onClick={endMeetingForAll}
              className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg text-sm transition-colors"
            >
              End Meeting
            </button>
          )}
          
          <button
            onClick={leaveMeeting}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
          >
            <Icon icon="solar:phone-bold-duotone" width={16} />
            <span>Leave Meeting</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Video Grid */}
        <div className="flex-1 p-4 overflow-y-auto">
          <div className={`grid ${getGridLayout()} gap-4 h-full`}>
            {/* Local Video */}
            <div 
              className={`relative bg-gray-800 rounded-lg overflow-hidden ${
                focusedParticipant ? (focusedParticipant === 'local' ? 'col-span-full row-span-full' : 'hidden') : ''
              }`}
              onClick={() => handleFocusParticipant('local')}
            >
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover"
              />
              
              {/* Local User Overlay */}
              <div className="absolute bottom-4 left-4 right-4">
                <div className="bg-black bg-opacity-50 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center text-white text-sm">
                        {user?.avatar || user?.name?.charAt(0) || 'Y'}
                      </div>
                      <div>
                        <div className="text-white font-medium text-sm">{user?.name || 'You'} (You)</div>
                        <div className="text-gray-300 text-xs">
                          {formatDuration(meetingDuration)} • Progress: 0%
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-1">
                      {isScreenSharing && (
                        <div className="bg-green-600 text-white px-2 py-1 rounded text-xs">
                          Sharing
                        </div>
                      )}
                      {!isVideoOn && (
                        <Icon icon="solar:videocamera-slash-bold-duotone" width={16} className="text-red-400" />
                      )}
                      {!isAudioOn && (
                        <Icon icon="solar:microphone-slash-bold-duotone" width={16} className="text-red-400" />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Remote Participants */}
            {participants.map((participant) => (
              <div 
                key={participant.id} 
                className={`relative bg-gray-800 rounded-lg overflow-hidden group ${
                  focusedParticipant ? (focusedParticipant === participant.id ? 'col-span-full row-span-full' : 'hidden') : ''
                }`}
                onClick={() => handleFocusParticipant(participant.id)}
              >
                {participant.stream ? (
                  <video
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover"
                    ref={(video) => {
                      if (video && participant.stream) {
                        video.srcObject = participant.stream;
                      }
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="w-16 h-16 bg-primary-600 rounded-full flex items-center justify-center text-white text-2xl">
                      {participant.avatar || participant.name.charAt(0)}
                    </div>
                  </div>
                )}
                
                {/* Participant Menu */}
                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleParticipantMenu(participant.id);
                      }}
                      className="w-8 h-8 bg-black bg-opacity-50 rounded-full flex items-center justify-center text-white hover:bg-opacity-70 transition-colors"
                    >
                      <Icon icon="solar:menu-dots-bold-duotone" width={16} />
                    </button>
                    
                    {participantMenus.get(participant.id) && (
                      <div className="absolute top-full right-0 mt-2 bg-white rounded-lg shadow-lg border border-gray-200 py-2 min-w-[150px] z-10">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleReportParticipant(participant);
                          }}
                          className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center space-x-2"
                        >
                          <Icon icon="solar:danger-triangle-bold-duotone" width={14} />
                          <span>Report Member</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Participant Overlay */}
                <div className="absolute bottom-4 left-4 right-4">
                  <div className="bg-black bg-opacity-50 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center text-white text-sm">
                          {participant.avatar || participant.name.charAt(0)}
                        </div>
                        <div>
                          <div className="text-white font-medium text-sm">{participant.name}</div>
                          <div className="text-gray-300 text-xs">
                            {formatDuration(Math.floor((Date.now() - participant.joinedAt.getTime()) / 1000))} • Progress: {participant.progress}%
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-1">
                        {participant.isScreenSharing && (
                          <div className="bg-green-600 text-white px-2 py-1 rounded text-xs">
                            Sharing
                          </div>
                        )}
                        {!participant.isVideoOn && (
                          <Icon icon="solar:videocamera-slash-bold-duotone" width={16} className="text-red-400" />
                        )}
                        {!participant.isAudioOn && (
                          <Icon icon="solar:microphone-slash-bold-duotone" width={16} className="text-red-400" />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sidebar */}
        {(showChat || showParticipants) && (
          <div className="w-80 bg-gray-800 flex flex-col border-l border-gray-700">
            {showChat && (
              <ChatInterface 
                communityId={communityId}
                isInMeeting={true}
                className="h-full bg-gray-800 text-white"
              />
            )}
            
            {showParticipants && (
              <div className="h-full flex flex-col">
                <div className="p-4 border-b border-gray-700">
                  <h3 className="text-white font-semibold">Participants ({participants.length + 1})</h3>
                </div>
                
                <div className="flex-1 p-4 overflow-y-auto">
                  <div className="space-y-3">
                    {/* Local User */}
                    <div className="flex items-center space-x-3 p-3 bg-gray-700 rounded-lg">
                      <div className="w-10 h-10 bg-primary-600 rounded-full flex items-center justify-center text-white">
                        {user?.avatar || user?.name?.charAt(0) || 'Y'}
                      </div>
                      <div className="flex-1">
                        <div className="text-white font-medium">{user?.name || 'You'} (You)</div>
                        <div className="text-gray-400 text-sm">{formatDuration(meetingDuration)}</div>
                      </div>
                      <div className="flex items-center space-x-1">
                        {isScreenSharing && <Icon icon="solar:monitor-bold-duotone" width={16} className="text-green-400" />}
                        {!isVideoOn && <Icon icon="solar:videocamera-slash-bold-duotone" width={16} className="text-red-400" />}
                        {!isAudioOn && <Icon icon="solar:microphone-slash-bold-duotone" width={16} className="text-red-400" />}
                      </div>
                    </div>

                    {/* Remote Participants */}
                    {participants.map((participant) => (
                      <div key={participant.id} className="flex items-center space-x-3 p-3 bg-gray-700 rounded-lg">
                        <div className="w-10 h-10 bg-primary-600 rounded-full flex items-center justify-center text-white">
                          {participant.avatar || participant.name.charAt(0)}
                        </div>
                        <div className="flex-1">
                          <div className="text-white font-medium">{participant.name}</div>
                          <div className="text-gray-400 text-sm">
                            {formatDuration(Math.floor((Date.now() - participant.joinedAt.getTime()) / 1000))}
                          </div>
                        </div>
                        <div className="flex items-center space-x-1">
                          {participant.isScreenSharing && <Icon icon="solar:monitor-bold-duotone" width={16} className="text-green-400" />}
                          {!participant.isVideoOn && <Icon icon="solar:videocamera-slash-bold-duotone" width={16} className="text-red-400" />}
                          {!participant.isAudioOn && <Icon icon="solar:microphone-slash-bold-duotone" width={16} className="text-red-400" />}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="bg-gray-800 px-6 py-4">
        <div className="flex items-center justify-center space-x-4">
          <button
            onClick={toggleVideo}
            className={`p-3 rounded-full transition-colors ${
              isVideoOn 
                ? 'bg-gray-700 hover:bg-gray-600 text-white' 
                : 'bg-red-600 hover:bg-red-700 text-white'
            }`}
            title={isVideoOn ? 'Turn off camera' : 'Turn on camera'}
          >
            {isVideoOn ? <Icon icon="solar:videocamera-record-bold-duotone" width={20} /> : <Icon icon="solar:videocamera-slash-bold-duotone" width={20} />}
          </button>
          
          <button
            onClick={toggleAudio}
            className={`p-3 rounded-full transition-colors ${
              isAudioOn 
                ? 'bg-gray-700 hover:bg-gray-600 text-white' 
                : 'bg-red-600 hover:bg-red-700 text-white'
            }`}
            title={isAudioOn ? 'Mute microphone' : 'Unmute microphone'}
          >
            {isAudioOn ? <Icon icon="solar:microphone-bold-duotone" width={20} /> : <Icon icon="solar:microphone-slash-bold-duotone" width={20} />}
          </button>
          
          <button
            onClick={toggleScreenShare}
            className={`p-3 rounded-full transition-colors ${
              isScreenSharing 
                ? 'bg-green-600 hover:bg-green-700 text-white' 
                : 'bg-gray-700 hover:bg-gray-600 text-white'
            }`}
            title={isScreenSharing ? 'Stop screen sharing' : 'Start screen sharing'}
          >
            {isScreenSharing ? <Icon icon="solar:monitor-smartphone-bold-duotone" width={20} /> : <Icon icon="solar:monitor-bold-duotone" width={20} />}
          </button>
          
          <button 
            onClick={() => setShowChat(!showChat)}
            className={`p-3 rounded-full transition-colors ${
              showChat 
                ? 'bg-primary-600 hover:bg-primary-700 text-white' 
                : 'bg-gray-700 hover:bg-gray-600 text-white'
            }`}
            title="Toggle chat"
          >
            <Icon icon="solar:chat-round-dots-bold-duotone" width={20} />
          </button>
          
          <button 
            onClick={() => setShowParticipants(!showParticipants)}
            className={`p-3 rounded-full transition-colors ${
              showParticipants 
                ? 'bg-primary-600 hover:bg-primary-700 text-white' 
                : 'bg-gray-700 hover:bg-gray-600 text-white'
            }`}
            title="Toggle participants"
          >
            <Icon icon="solar:users-group-rounded-bold-duotone" width={20} />
          </button>
          
          <div className="flex items-center space-x-2 bg-gray-700 rounded-full px-3 py-2">
            <button
              onClick={() => setIsMuted(!isMuted)}
              className="text-white"
              title={isMuted ? "Unmute audio" : "Mute audio"}
            >
              {isMuted ? <Icon icon="solar:volume-cross-bold-duotone" width={16} /> : <Icon icon="solar:volume-loud-bold-duotone" width={16} />}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={audioLevel}
              onChange={handleAudioLevelChange}
              className="w-20 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer"
            />
          </div>
          
          <button 
            className="p-3 rounded-full bg-gray-700 hover:bg-gray-600 text-white transition-colors"
            title="Settings"
          >
            <Icon icon="solar:settings-bold-duotone" width={20} />
          </button>
        </div>
      </div>

      {/* Reporting Modal */}
      {showReportingModal && reportingTarget && (
        <ReportingInterface
          communityId={communityId}
          meetingSessionId={meetingSessionId}
          participantId={reportingTarget.id}
          participantName={reportingTarget.name}
          onClose={() => {
            setShowReportingModal(false);
            setReportingTarget(null);
          }}
        />
      )}
    </div>
  );
}