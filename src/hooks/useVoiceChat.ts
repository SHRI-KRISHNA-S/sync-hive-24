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
}

interface PeerConnection {
  odId: string;
  connection: RTCPeerConnection;
  stream?: MediaStream;
}

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

export const useVoiceChat = (channelId: string | null) => {
  const { user, profile } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [participants, setParticipants] = useState<VoiceParticipant[]>([]);
  const [error, setError] = useState<string | null>(null);

  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<string, PeerConnection>>(new Map());
  const realtimeChannelRef = useRef<RealtimeChannel | null>(null);

  // Cleanup function
  const cleanup = useCallback(() => {
    console.log('[VoiceChat] Cleaning up...');
    
    // Stop local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }

    // Close all peer connections
    peerConnectionsRef.current.forEach(({ connection }) => {
      connection.close();
    });
    peerConnectionsRef.current.clear();

    // Unsubscribe from realtime channel
    if (realtimeChannelRef.current) {
      supabase.removeChannel(realtimeChannelRef.current);
      realtimeChannelRef.current = null;
    }

    setParticipants([]);
    setIsConnected(false);
  }, []);

  // Create peer connection for a user
  const createPeerConnection = useCallback((targetUserId: string): RTCPeerConnection => {
    console.log(`[VoiceChat] Creating peer connection for ${targetUserId}`);
    
    const pc = new RTCPeerConnection(ICE_SERVERS);

    // Add local tracks to peer connection
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

  // Handle incoming tracks
    pc.ontrack = (event) => {
      console.log(`[VoiceChat] Received track from ${targetUserId}`, event.track.kind);
      const [remoteStream] = event.streams;
      
      if (!remoteStream) {
        console.error(`[VoiceChat] No remote stream from ${targetUserId}`);
        return;
      }

      // Remove existing audio element if any
      const existingAudio = document.getElementById(`audio-${targetUserId}`) as HTMLAudioElement;
      if (existingAudio) {
        existingAudio.srcObject = null;
        existingAudio.remove();
      }
      
      // Create audio element to play remote stream
      const audio = document.createElement('audio');
      audio.id = `audio-${targetUserId}`;
      audio.srcObject = remoteStream;
      audio.autoplay = true;
      (audio as any).playsInline = true;
      audio.volume = 1.0;
      document.body.appendChild(audio);

      // Force play with error handling for autoplay policy
      const playAudio = async () => {
        try {
          await audio.play();
          console.log(`[VoiceChat] Audio playing for ${targetUserId}`);
        } catch (err) {
          console.error(`[VoiceChat] Audio play failed for ${targetUserId}:`, err);
          // Retry on user interaction
          const retryPlay = async () => {
            try {
              await audio.play();
              document.removeEventListener('click', retryPlay);
            } catch (e) {
              console.error('[VoiceChat] Retry play failed:', e);
            }
          };
          document.addEventListener('click', retryPlay, { once: true });
        }
      };
      playAudio();

      // Store the stream reference for cleanup
      const peerConn = peerConnectionsRef.current.get(targetUserId);
      if (peerConn) {
        peerConn.stream = remoteStream;
      }

      // Update participant speaking state based on audio
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
            candidate: event.candidate,
          },
        });
      }
    };

    pc.onconnectionstatechange = () => {
      console.log(`[VoiceChat] Connection state for ${targetUserId}: ${pc.connectionState}`);
    };

    peerConnectionsRef.current.set(targetUserId, { odId: targetUserId, connection: pc });
    return pc;
  }, [user?.id]);

  // Handle incoming signaling messages
  const handleSignalingMessage = useCallback(async (payload: any) => {
    const { from, to, type, sdp } = payload;
    
    if (to !== user?.id) return;
    
    console.log(`[VoiceChat] Received ${type} from ${from}`);

    let pc = peerConnectionsRef.current.get(from)?.connection;
    if (!pc) {
      pc = createPeerConnection(from);
    }

    if (type === 'offer') {
      await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp }));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      
      realtimeChannelRef.current?.send({
        type: 'broadcast',
        event: 'signaling',
        payload: {
          from: user?.id,
          to: from,
          type: 'answer',
          sdp: answer.sdp,
        },
      });
    } else if (type === 'answer') {
      await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp }));
    }
  }, [user?.id, createPeerConnection]);

  const handleIceCandidate = useCallback(async (payload: any) => {
    const { from, to, candidate } = payload;
    
    if (to !== user?.id) return;
    
    const pc = peerConnectionsRef.current.get(from)?.connection;
    if (pc && candidate) {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
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
              });
            }
          });
          
          setParticipants(newParticipants);
        })
        .on('presence', { event: 'join' }, async ({ key, newPresences }) => {
          console.log(`[VoiceChat] User joined: ${key}`);
          const presence = (newPresences as any[])[0];
          
          if (presence.user_id !== user.id) {
            // Create offer for new participant
            const pc = createPeerConnection(presence.user_id);
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            
            rtChannel.send({
              type: 'broadcast',
              event: 'signaling',
              payload: {
                from: user.id,
                to: presence.user_id,
                type: 'offer',
                sdp: offer.sdp,
              },
            });
          }
        })
        .on('presence', { event: 'leave' }, ({ key }) => {
          console.log(`[VoiceChat] User left: ${key}`);
          
          // Clean up peer connection
          const peerConn = peerConnectionsRef.current.get(key);
          if (peerConn) {
            peerConn.connection.close();
            peerConnectionsRef.current.delete(key);
          }
          
          // Remove audio element
          const audioEl = document.getElementById(`audio-${key}`);
          audioEl?.remove();
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
          joined_at: new Date().toISOString(),
        });
      }
    }
  }, [user?.id, profile?.username]);

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
    participants,
    error,
    joinVoice,
    leaveVoice,
    toggleMute,
  };
};
