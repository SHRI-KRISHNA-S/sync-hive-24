import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { RealtimeChannel } from '@supabase/supabase-js';

interface VoiceParticipant {
  odId: string;
  odUserId: string;
  username: string;
  isMuted: boolean;
  isSpeaking: boolean;
  isVideoOn: boolean;
  isScreenSharing: boolean;
}

interface PeerConnection {
  odId: string;
  connection: RTCPeerConnection;
  stream?: MediaStream;
  makingOffer: boolean;
  ignoreOffer: boolean;
  isSettingRemoteAnswerPending: boolean;
}

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
  ],
  iceCandidatePoolSize: 10,
};

export const useVoiceChat = (channelId: string | null) => {
  const { user, profile } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [participants, setParticipants] = useState<VoiceParticipant[]>([]);
  const [error, setError] = useState<string | null>(null);

  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const peerConnectionsRef = useRef<Map<string, PeerConnection>>(new Map());
  const realtimeChannelRef = useRef<RealtimeChannel | null>(null);
  const pendingCandidatesRef = useRef<Map<string, RTCIceCandidate[]>>(new Map());

  // Cleanup function
  const cleanup = useCallback(() => {
    console.log('[VoiceChat] Cleaning up...');
    
    // Stop local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }

    // Stop screen share stream
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
    }

    // Close all peer connections and remove audio/video elements
    peerConnectionsRef.current.forEach(({ connection }, odId) => {
      connection.close();
      const audioEl = document.getElementById(`audio-${odId}`);
      audioEl?.remove();
      const videoEl = document.getElementById(`video-${odId}`);
      videoEl?.remove();
    });
    peerConnectionsRef.current.clear();
    pendingCandidatesRef.current.clear();

    // Unsubscribe from realtime channel
    if (realtimeChannelRef.current) {
      supabase.removeChannel(realtimeChannelRef.current);
      realtimeChannelRef.current = null;
    }

    setParticipants([]);
    setIsConnected(false);
    setIsVideoOn(false);
    setIsScreenSharing(false);
  }, []);

  // Add pending ICE candidates
  const addPendingCandidates = async (targetUserId: string, pc: RTCPeerConnection) => {
    const pending = pendingCandidatesRef.current.get(targetUserId) || [];
    for (const candidate of pending) {
      try {
        await pc.addIceCandidate(candidate);
        console.log(`[VoiceChat] Added pending ICE candidate for ${targetUserId}`);
      } catch (err) {
        console.error('[VoiceChat] Error adding pending ICE candidate:', err);
      }
    }
    pendingCandidatesRef.current.delete(targetUserId);
  };

  // Create peer connection for a user - using "perfect negotiation" pattern
  const createPeerConnection = useCallback((targetUserId: string, polite: boolean): RTCPeerConnection => {
    console.log(`[VoiceChat] Creating peer connection for ${targetUserId}, polite=${polite}`);
    
    // Close existing connection if any
    const existing = peerConnectionsRef.current.get(targetUserId);
    if (existing) {
      existing.connection.close();
    }

    const pc = new RTCPeerConnection(ICE_SERVERS);
    const peerState: PeerConnection = {
      odId: targetUserId,
      connection: pc,
      makingOffer: false,
      ignoreOffer: false,
      isSettingRemoteAnswerPending: false,
    };
    peerConnectionsRef.current.set(targetUserId, peerState);

    // Add local tracks to peer connection
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        console.log(`[VoiceChat] Adding ${track.kind} track to peer connection`);
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    // Handle negotiation needed - perfect negotiation pattern
    pc.onnegotiationneeded = async () => {
      try {
        peerState.makingOffer = true;
        await pc.setLocalDescription();
        
        realtimeChannelRef.current?.send({
          type: 'broadcast',
          event: 'signaling',
          payload: {
            from: user?.id,
            to: targetUserId,
            type: 'offer',
            sdp: pc.localDescription?.sdp,
          },
        });
        console.log(`[VoiceChat] Sent offer to ${targetUserId}`);
      } catch (err) {
        console.error('[VoiceChat] Negotiation error:', err);
      } finally {
        peerState.makingOffer = false;
      }
    };

    // Handle incoming tracks
    pc.ontrack = (event) => {
      console.log(`[VoiceChat] Received ${event.track.kind} track from ${targetUserId}`);
      const [remoteStream] = event.streams;
      
      if (!remoteStream) {
        console.error(`[VoiceChat] No remote stream from ${targetUserId}`);
        return;
      }

      peerState.stream = remoteStream;

      if (event.track.kind === 'audio') {
        // Handle audio track
        let audioEl = document.getElementById(`audio-${targetUserId}`) as HTMLAudioElement;
        if (!audioEl) {
          audioEl = document.createElement('audio');
          audioEl.id = `audio-${targetUserId}`;
          audioEl.autoplay = true;
          (audioEl as any).playsInline = true;
          document.body.appendChild(audioEl);
        }
        audioEl.srcObject = remoteStream;
        
        // Force play with error handling
        audioEl.play().catch(err => {
          console.warn(`[VoiceChat] Audio autoplay blocked for ${targetUserId}:`, err);
          const retryPlay = () => {
            audioEl.play().catch(console.error);
            document.removeEventListener('click', retryPlay);
          };
          document.addEventListener('click', retryPlay, { once: true });
        });

        // Speaking detection with AudioContext
        try {
          const audioContext = new AudioContext();
          const source = audioContext.createMediaStreamSource(remoteStream);
          const analyser = audioContext.createAnalyser();
          analyser.fftSize = 256;
          source.connect(analyser);

          const checkSpeaking = () => {
            if (!peerConnectionsRef.current.has(targetUserId)) {
              clearInterval(speakingInterval);
              audioContext.close();
              return;
            }
            
            const dataArray = new Uint8Array(analyser.frequencyBinCount);
            analyser.getByteFrequencyData(dataArray);
            const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
            
            setParticipants(prev => prev.map(p => 
              p.odUserId === targetUserId ? { ...p, isSpeaking: average > 15 } : p
            ));
          };

          const speakingInterval = setInterval(checkSpeaking, 100);
        } catch (err) {
          console.error('[VoiceChat] AudioContext error:', err);
        }
      }

      if (event.track.kind === 'video') {
        // Dispatch custom event for video track - components can listen to this
        window.dispatchEvent(new CustomEvent('remote-video-track', {
          detail: { targetUserId, stream: remoteStream }
        }));
      }
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && realtimeChannelRef.current) {
        realtimeChannelRef.current.send({
          type: 'broadcast',
          event: 'ice-candidate',
          payload: {
            from: user?.id,
            to: targetUserId,
            candidate: event.candidate.toJSON(),
          },
        });
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`[VoiceChat] ICE state for ${targetUserId}: ${pc.iceConnectionState}`);
      if (pc.iceConnectionState === 'failed') {
        pc.restartIce();
      }
    };

    pc.onconnectionstatechange = () => {
      console.log(`[VoiceChat] Connection state for ${targetUserId}: ${pc.connectionState}`);
    };

    return pc;
  }, [user?.id]);

  // Handle incoming signaling messages - perfect negotiation pattern
  const handleSignalingMessage = useCallback(async (payload: any) => {
    const { from, to, type, sdp } = payload;
    
    if (to !== user?.id) return;
    
    console.log(`[VoiceChat] Received ${type} from ${from}`);

    let peerState = peerConnectionsRef.current.get(from);
    
    if (!peerState) {
      // We received a message from someone we don't have a connection with
      // This means they're the offerer, so we're polite (we accept their offer)
      const pc = createPeerConnection(from, true);
      peerState = peerConnectionsRef.current.get(from)!;
    }

    const pc = peerState.connection;
    const polite = user!.id > from; // Higher ID is polite

    if (type === 'offer') {
      const offerCollision = peerState.makingOffer || pc.signalingState !== 'stable';
      
      peerState.ignoreOffer = !polite && offerCollision;
      if (peerState.ignoreOffer) {
        console.log(`[VoiceChat] Ignoring colliding offer from ${from}`);
        return;
      }

      await pc.setRemoteDescription({ type: 'offer', sdp });
      await addPendingCandidates(from, pc);
      
      await pc.setLocalDescription();
      
      realtimeChannelRef.current?.send({
        type: 'broadcast',
        event: 'signaling',
        payload: {
          from: user?.id,
          to: from,
          type: 'answer',
          sdp: pc.localDescription?.sdp,
        },
      });
      console.log(`[VoiceChat] Sent answer to ${from}`);
      
    } else if (type === 'answer') {
      if (pc.signalingState === 'have-local-offer') {
        await pc.setRemoteDescription({ type: 'answer', sdp });
        await addPendingCandidates(from, pc);
        console.log(`[VoiceChat] Set remote answer from ${from}`);
      }
    }
  }, [user?.id, createPeerConnection]);

  const handleIceCandidate = useCallback(async (payload: any) => {
    const { from, to, candidate } = payload;
    
    if (to !== user?.id || !candidate) return;
    
    const peerState = peerConnectionsRef.current.get(from);
    
    if (!peerState || !peerState.connection.remoteDescription) {
      // Buffer the candidate until we have a remote description
      const pending = pendingCandidatesRef.current.get(from) || [];
      pending.push(new RTCIceCandidate(candidate));
      pendingCandidatesRef.current.set(from, pending);
      console.log(`[VoiceChat] Buffered ICE candidate from ${from}`);
      return;
    }

    try {
      await peerState.connection.addIceCandidate(new RTCIceCandidate(candidate));
      console.log(`[VoiceChat] Added ICE candidate from ${from}`);
    } catch (err) {
      if (!peerState.ignoreOffer) {
        console.error('[VoiceChat] Error adding ICE candidate:', err);
      }
    }
  }, [user?.id]);

  // Join voice channel
  const joinVoice = useCallback(async () => {
    if (!channelId || !user || isConnecting) return;

    setIsConnecting(true);
    setError(null);

    try {
      console.log('[VoiceChat] Requesting microphone access...');
      
      // Get local audio stream
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        } 
      });
      localStreamRef.current = stream;

      // Set up realtime channel for signaling
      const rtChannel = supabase.channel(`voice:${channelId}`, {
        config: { presence: { key: user.id } },
      });

      rtChannel
        .on('presence', { event: 'sync' }, () => {
          const state = rtChannel.presenceState();
          const newParticipants: VoiceParticipant[] = [];
          
          Object.entries(state).forEach(([key, presences]) => {
            const presence = (presences as any[])[0];
            if (presence) {
              newParticipants.push({
                odId: key,
                odUserId: presence.user_id,
                username: presence.username,
                isMuted: presence.isMuted || false,
                isSpeaking: false,
                isVideoOn: presence.isVideoOn || false,
                isScreenSharing: presence.isScreenSharing || false,
              });
            }
          });
          
          setParticipants(newParticipants);
        })
        .on('presence', { event: 'join' }, async ({ key, newPresences }) => {
          console.log(`[VoiceChat] User joined: ${key}`);
          const presence = (newPresences as any[])[0];
          
          if (presence.user_id !== user.id) {
            // Determine politeness: higher ID is polite
            const polite = user.id > presence.user_id;
            
            // Only the impolite peer initiates
            if (!polite) {
              createPeerConnection(presence.user_id, false);
            }
          }
        })
        .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
          console.log(`[VoiceChat] User left: ${key}`);
          const presence = (leftPresences as any[])?.[0];
          const odId = presence?.user_id || key;
          
          // Clean up peer connection
          const peerConn = peerConnectionsRef.current.get(odId);
          if (peerConn) {
            peerConn.connection.close();
            peerConnectionsRef.current.delete(odId);
          }
          
          // Remove audio/video elements
          document.getElementById(`audio-${odId}`)?.remove();
          document.getElementById(`video-${odId}`)?.remove();
        })
        .on('broadcast', { event: 'signaling' }, ({ payload }) => {
          handleSignalingMessage(payload);
        })
        .on('broadcast', { event: 'ice-candidate' }, ({ payload }) => {
          handleIceCandidate(payload);
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            await rtChannel.track({
              user_id: user.id,
              username: profile?.username || 'Unknown',
              isMuted: false,
              isVideoOn: false,
              isScreenSharing: false,
              joined_at: new Date().toISOString(),
            });
            
            setIsConnected(true);
            setIsConnecting(false);
            console.log('[VoiceChat] Connected to voice channel');
          }
        });

      realtimeChannelRef.current = rtChannel;
    } catch (err: any) {
      console.error('[VoiceChat] Error joining:', err);
      setError(err.message || 'Failed to join voice channel');
      setIsConnecting(false);
      cleanup();
    }
  }, [channelId, user, profile, isConnecting, createPeerConnection, handleSignalingMessage, handleIceCandidate, cleanup]);

  // Leave voice channel
  const leaveVoice = useCallback(async () => {
    console.log('[VoiceChat] Leaving voice channel...');
    cleanup();
  }, [cleanup]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
        
        // Update presence
        realtimeChannelRef.current?.track({
          user_id: user?.id,
          username: profile?.username || 'Unknown',
          isMuted: !audioTrack.enabled,
          isVideoOn,
          isScreenSharing,
          joined_at: new Date().toISOString(),
        });
      }
    }
  }, [user?.id, profile?.username, isVideoOn, isScreenSharing]);

  // Toggle video
  const toggleVideo = useCallback(async () => {
    if (!localStreamRef.current) return;

    if (isVideoOn) {
      // Turn off video
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.stop();
        localStreamRef.current.removeTrack(videoTrack);
        
        // Remove track from all peer connections
        peerConnectionsRef.current.forEach(({ connection }) => {
          const sender = connection.getSenders().find(s => s.track?.kind === 'video');
          if (sender) {
            connection.removeTrack(sender);
          }
        });
      }
      setIsVideoOn(false);
    } else {
      try {
        // Turn on video
        const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
        const videoTrack = videoStream.getVideoTracks()[0];
        localStreamRef.current.addTrack(videoTrack);
        
        // Add track to all peer connections
        peerConnectionsRef.current.forEach(({ connection }) => {
          connection.addTrack(videoTrack, localStreamRef.current!);
        });
        
        // Dispatch event for local video
        window.dispatchEvent(new CustomEvent('local-video-track', {
          detail: { stream: localStreamRef.current }
        }));
        
        setIsVideoOn(true);
      } catch (err) {
        console.error('[VoiceChat] Error enabling video:', err);
        setError('Failed to enable video');
      }
    }

    // Update presence
    realtimeChannelRef.current?.track({
      user_id: user?.id,
      username: profile?.username || 'Unknown',
      isMuted,
      isVideoOn: !isVideoOn,
      isScreenSharing,
      joined_at: new Date().toISOString(),
    });
  }, [user?.id, profile?.username, isMuted, isVideoOn, isScreenSharing]);

  // Toggle screen share
  const toggleScreenShare = useCallback(async () => {
    if (isScreenSharing) {
      // Stop screen share
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(track => track.stop());
        screenStreamRef.current = null;
      }
      setIsScreenSharing(false);
    } else {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true,
        });
        screenStreamRef.current = screenStream;
        
        // Add screen share track to all peer connections
        const videoTrack = screenStream.getVideoTracks()[0];
        peerConnectionsRef.current.forEach(({ connection }) => {
          connection.addTrack(videoTrack, screenStream);
        });
        
        // Handle when user stops sharing via browser UI
        videoTrack.onended = () => {
          setIsScreenSharing(false);
          screenStreamRef.current = null;
        };
        
        // Dispatch event for local screen share
        window.dispatchEvent(new CustomEvent('local-screen-share', {
          detail: { stream: screenStream }
        }));
        
        setIsScreenSharing(true);
      } catch (err) {
        console.error('[VoiceChat] Error sharing screen:', err);
        setError('Failed to share screen');
      }
    }

    // Update presence
    realtimeChannelRef.current?.track({
      user_id: user?.id,
      username: profile?.username || 'Unknown',
      isMuted,
      isVideoOn,
      isScreenSharing: !isScreenSharing,
      joined_at: new Date().toISOString(),
    });
  }, [user?.id, profile?.username, isMuted, isVideoOn, isScreenSharing]);

  // Get local stream for video preview
  const getLocalStream = useCallback(() => localStreamRef.current, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    isConnected,
    isConnecting,
    isMuted,
    isVideoOn,
    isScreenSharing,
    participants,
    error,
    joinVoice,
    leaveVoice,
    toggleMute,
    toggleVideo,
    toggleScreenShare,
    getLocalStream,
  };
};
