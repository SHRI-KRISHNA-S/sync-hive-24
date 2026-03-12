import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { RealtimeChannel } from '@supabase/supabase-js';

export type CallQuality = 'good' | 'fair' | 'poor' | null;

interface VoiceParticipant {
  odId: string;
  odUserId: string;
  username: string;
  isMuted: boolean;
  isSpeaking: boolean;
  isVideoOn: boolean;
  isScreenSharing: boolean;
}

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
  ],
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
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [callQuality, setCallQuality] = useState<CallQuality>(null);
  const statsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<string, { connection: RTCPeerConnection; makingOffer: boolean; ignoreOffer: boolean }>>(new Map());
  const realtimeChannelRef = useRef<RealtimeChannel | null>(null);
  const pendingCandidatesRef = useRef<Map<string, RTCIceCandidate[]>>(new Map());
  const userRef = useRef(user);
  const profileRef = useRef(profile);
  const isMutedRef = useRef(isMuted);
  const isVideoOnRef = useRef(isVideoOn);
  const isScreenSharingRef = useRef(isScreenSharing);
  const isConnectedRef = useRef(false);
  // Track which peers we've already initiated connections to (prevent duplicates)
  const initiatedPeersRef = useRef<Set<string>>(new Set());

  // Keep refs in sync
  useEffect(() => { userRef.current = user; }, [user]);
  useEffect(() => { profileRef.current = profile; }, [profile]);
  useEffect(() => { isMutedRef.current = isMuted; }, [isMuted]);
  useEffect(() => { isVideoOnRef.current = isVideoOn; }, [isVideoOn]);
  useEffect(() => { isScreenSharingRef.current = isScreenSharing; }, [isScreenSharing]);

  const cleanup = useCallback(() => {
    console.log('[VoiceChat] Cleaning up...');
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    localStreamRef.current = null;
    screenStreamRef.current?.getTracks().forEach(t => t.stop());
    screenStreamRef.current = null;

    peerConnectionsRef.current.forEach(({ connection }, id) => {
      connection.close();
      document.getElementById(`audio-${id}`)?.remove();
    });
    peerConnectionsRef.current.clear();
    pendingCandidatesRef.current.clear();
    initiatedPeersRef.current.clear();

    if (realtimeChannelRef.current) {
      supabase.removeChannel(realtimeChannelRef.current);
      realtimeChannelRef.current = null;
    }

    if (statsIntervalRef.current) {
      clearInterval(statsIntervalRef.current);
      statsIntervalRef.current = null;
    }

    setParticipants([]);
    setIsConnected(false);
    isConnectedRef.current = false;
    setIsVideoOn(false);
    setIsScreenSharing(false);
    setCallQuality(null);
  }, []);

  const addPendingCandidates = async (targetUserId: string, pc: RTCPeerConnection) => {
    const pending = pendingCandidatesRef.current.get(targetUserId) || [];
    for (const candidate of pending) {
      try {
        await pc.addIceCandidate(candidate);
      } catch (err) {
        console.error('[VoiceChat] Error adding pending ICE candidate:', err);
      }
    }
    pendingCandidatesRef.current.delete(targetUserId);
  };

  const createPeerConnection = useCallback((targetUserId: string): RTCPeerConnection => {
    console.log(`[VoiceChat] Creating peer connection for ${targetUserId}`);

    const existing = peerConnectionsRef.current.get(targetUserId);
    if (existing) {
      existing.connection.close();
      document.getElementById(`audio-${targetUserId}`)?.remove();
    }

    const pc = new RTCPeerConnection(ICE_SERVERS);
    const peerState = { connection: pc, makingOffer: false, ignoreOffer: false };
    peerConnectionsRef.current.set(targetUserId, peerState);

    // Add ALL local tracks (audio + video + screen share)
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        console.log(`[VoiceChat] Adding local ${track.kind} track to PC for ${targetUserId}`);
        pc.addTrack(track, localStreamRef.current!);
      });
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => {
        console.log(`[VoiceChat] Adding screen ${track.kind} track to PC for ${targetUserId}`);
        pc.addTrack(track, screenStreamRef.current!);
      });
    }

    // Perfect negotiation: onnegotiationneeded
    pc.onnegotiationneeded = async () => {
      try {
        peerState.makingOffer = true;
        await pc.setLocalDescription();
        console.log(`[VoiceChat] Sending offer to ${targetUserId}, sdp length: ${pc.localDescription?.sdp?.length}`);
        realtimeChannelRef.current?.send({
          type: 'broadcast',
          event: 'signaling',
          payload: {
            from: userRef.current?.id,
            to: targetUserId,
            type: 'offer',
            sdp: pc.localDescription?.sdp,
          },
        });
      } catch (err) {
        console.error('[VoiceChat] Negotiation error:', err);
      } finally {
        peerState.makingOffer = false;
      }
    };

    // Handle incoming tracks
    pc.ontrack = (event) => {
      console.log(`[VoiceChat] *** Received ${event.track.kind} track from ${targetUserId}, readyState: ${event.track.readyState}`);

      if (event.track.kind === 'audio') {
        // Create a fresh MediaStream for this audio track
        const audioStream = new MediaStream([event.track]);
        
        // Remove old audio element if exists
        document.getElementById(`audio-${targetUserId}`)?.remove();
        
        const audioEl = document.createElement('audio');
        audioEl.id = `audio-${targetUserId}`;
        audioEl.autoplay = true;
        audioEl.setAttribute('playsinline', 'true');
        audioEl.volume = 1.0;
        audioEl.srcObject = audioStream;
        document.body.appendChild(audioEl);
        console.log(`[VoiceChat] Created audio element for ${targetUserId}, tracks: ${audioStream.getAudioTracks().length}`);

        // Force play
        const playAudio = () => {
          audioEl.play().then(() => {
            console.log(`[VoiceChat] Audio playing for ${targetUserId}`);
          }).catch(err => {
            console.warn(`[VoiceChat] Audio autoplay blocked for ${targetUserId}:`, err);
          });
        };
        playAudio();
        
        // Also retry on any user interaction
        const retryPlay = () => {
          playAudio();
          document.removeEventListener('click', retryPlay);
          document.removeEventListener('keydown', retryPlay);
        };
        document.addEventListener('click', retryPlay, { once: true });
        document.addEventListener('keydown', retryPlay, { once: true });

        // Speaking detection
        try {
          const audioContext = new AudioContext();
          const source = audioContext.createMediaStreamSource(audioStream);
          const analyser = audioContext.createAnalyser();
          analyser.fftSize = 256;
          source.connect(analyser);

          const speakingInterval = setInterval(() => {
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
          }, 200);
        } catch (err) {
          console.error('[VoiceChat] AudioContext error:', err);
        }
      }

      if (event.track.kind === 'video') {
        const videoStream = new MediaStream([event.track]);
        window.dispatchEvent(new CustomEvent('remote-video-track', {
          detail: { targetUserId, stream: videoStream }
        }));
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && realtimeChannelRef.current) {
        realtimeChannelRef.current.send({
          type: 'broadcast',
          event: 'ice-candidate',
          payload: {
            from: userRef.current?.id,
            to: targetUserId,
            candidate: event.candidate.toJSON(),
          },
        });
      }
    };

    // Debounce timer for disconnected state
    let disconnectTimer: ReturnType<typeof setTimeout> | null = null;

    pc.oniceconnectionstatechange = () => {
      console.log(`[VoiceChat] ICE state for ${targetUserId}: ${pc.iceConnectionState}`);

      // Clear any pending disconnect timer
      if (disconnectTimer) {
        clearTimeout(disconnectTimer);
        disconnectTimer = null;
      }

      if (pc.iceConnectionState === 'disconnected') {
        setIsReconnecting(true);
        // Wait 3s before restarting — disconnected is often transient
        disconnectTimer = setTimeout(() => {
          if (pc.iceConnectionState === 'disconnected') {
            console.log(`[VoiceChat] Still disconnected after 3s, restarting ICE for ${targetUserId}`);
            try {
              pc.restartIce();
            } catch (err) {
              console.error('[VoiceChat] restartIce error:', err);
            }
          }
        }, 3000);
      }

      if (pc.iceConnectionState === 'failed') {
        setIsReconnecting(true);
        console.log(`[VoiceChat] ICE failed for ${targetUserId}, restarting ICE immediately`);
        try {
          pc.restartIce();
        } catch (err) {
          console.error('[VoiceChat] restartIce error:', err);
        }
      }

      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        setIsReconnecting(false);
        console.log(`[VoiceChat] *** Successfully connected to ${targetUserId}!`);
      }
    };

    pc.onconnectionstatechange = () => {
      console.log(`[VoiceChat] Connection state for ${targetUserId}: ${pc.connectionState}`);

      // If connection fully fails, recreate the peer connection entirely
      if (pc.connectionState === 'failed') {
        console.log(`[VoiceChat] Connection failed for ${targetUserId}, recreating peer connection`);
        if (disconnectTimer) clearTimeout(disconnectTimer);
        peerConnectionsRef.current.delete(targetUserId);
        initiatedPeersRef.current.delete(targetUserId);
        document.getElementById(`audio-${targetUserId}`)?.remove();
        pc.close();
        // Re-initiate after a short delay
        setTimeout(() => {
          if (isConnectedRef.current && !peerConnectionsRef.current.has(targetUserId)) {
            initiatedPeersRef.current.add(targetUserId);
            createPeerConnection(targetUserId);
          }
        }, 1000);
      }
    };

    return pc;
  }, []);

  // Initiate connection to a peer if not already done
  const ensurePeerConnection = useCallback((peerId: string) => {
    if (peerId === userRef.current?.id) return;
    if (initiatedPeersRef.current.has(peerId)) return;
    if (!isConnectedRef.current) return;
    
    initiatedPeersRef.current.add(peerId);
    console.log(`[VoiceChat] Ensuring peer connection to ${peerId}`);
    createPeerConnection(peerId);
  }, [createPeerConnection]);

  // Join voice channel
  const joinVoice = useCallback(async () => {
    if (!channelId || !user || isConnecting) return;

    setIsConnecting(true);
    setError(null);

    try {
      console.log('[VoiceChat] Requesting microphone access...');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: true,
      });
      localStreamRef.current = stream;
      console.log(`[VoiceChat] Got local audio stream, tracks: ${stream.getAudioTracks().length}`);

      const rtChannel = supabase.channel(`voice:${channelId}`, {
        config: { presence: { key: user.id } },
      });

      realtimeChannelRef.current = rtChannel;

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

          // KEY FIX: On every sync, create peer connections for all remote peers
          // This handles both initial join (existing peers) and late joiners
          if (isConnectedRef.current) {
            newParticipants.forEach(p => {
              if (p.odUserId !== userRef.current?.id) {
                ensurePeerConnection(p.odUserId);
              }
            });
          }
        })
        .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
          const presence = (leftPresences as any[])?.[0];
          const odId = presence?.user_id || key;
          console.log(`[VoiceChat] Peer left: ${odId}`);

          const peerConn = peerConnectionsRef.current.get(odId);
          if (peerConn) {
            peerConn.connection.close();
            peerConnectionsRef.current.delete(odId);
          }
          initiatedPeersRef.current.delete(odId);
          document.getElementById(`audio-${odId}`)?.remove();
        })
        .on('broadcast', { event: 'signaling' }, ({ payload }) => {
          // Inline signaling handler to avoid stale closures
          const { from, to, type, sdp } = payload;
          if (to !== userRef.current?.id) return;

          console.log(`[VoiceChat] Received ${type} from ${from}`);

          let peerState = peerConnectionsRef.current.get(from);

          if (!peerState) {
            // Create a new connection for this unknown peer
            createPeerConnection(from);
            initiatedPeersRef.current.add(from);
            peerState = peerConnectionsRef.current.get(from)!;
          }

          const pc = peerState.connection;
          const polite = userRef.current!.id > from;

          (async () => {
            try {
              if (type === 'offer') {
                const offerCollision = peerState!.makingOffer || pc.signalingState !== 'stable';
                peerState!.ignoreOffer = !polite && offerCollision;

                if (peerState!.ignoreOffer) {
                  console.log(`[VoiceChat] Ignoring colliding offer from ${from}`);
                  return;
                }

                await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp }));
                await addPendingCandidates(from, pc);
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);

                realtimeChannelRef.current?.send({
                  type: 'broadcast',
                  event: 'signaling',
                  payload: {
                    from: userRef.current?.id,
                    to: from,
                    type: 'answer',
                    sdp: pc.localDescription?.sdp,
                  },
                });
                console.log(`[VoiceChat] Sent answer to ${from}`);
              } else if (type === 'answer') {
                if (pc.signalingState === 'have-local-offer') {
                  await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp }));
                  await addPendingCandidates(from, pc);
                  console.log(`[VoiceChat] Set remote answer from ${from}`);
                } else {
                  console.warn(`[VoiceChat] Ignoring answer in state ${pc.signalingState}`);
                }
              }
            } catch (err) {
              console.error('[VoiceChat] Signaling error:', err);
            }
          })();
        })
        .on('broadcast', { event: 'ice-candidate' }, ({ payload }) => {
          // Inline ICE handler to avoid stale closures
          const { from, to, candidate } = payload;
          if (to !== userRef.current?.id || !candidate) return;

          const peerState = peerConnectionsRef.current.get(from);

          if (!peerState || !peerState.connection.remoteDescription) {
            const pending = pendingCandidatesRef.current.get(from) || [];
            pending.push(new RTCIceCandidate(candidate));
            pendingCandidatesRef.current.set(from, pending);
            return;
          }

          peerState.connection.addIceCandidate(new RTCIceCandidate(candidate)).catch(err => {
            if (!peerState.ignoreOffer) {
              console.error('[VoiceChat] Error adding ICE candidate:', err);
            }
          });
        })
        .subscribe(async (status) => {
          console.log(`[VoiceChat] Channel status: ${status}`);
          if (status === 'SUBSCRIBED') {
            await rtChannel.track({
              user_id: user.id,
              username: profile?.username || 'Unknown',
              isMuted: false,
              isVideoOn: false,
              isScreenSharing: false,
            });
            setIsConnected(true);
            isConnectedRef.current = true;
            setIsConnecting(false);
            console.log('[VoiceChat] Connected to voice channel');

            // After a short delay, check for existing peers and connect
            setTimeout(() => {
              const state = rtChannel.presenceState();
              Object.entries(state).forEach(([key, presences]) => {
                const presence = (presences as any[])[0];
                if (presence && presence.user_id !== user.id) {
                  ensurePeerConnection(presence.user_id);
                }
              });
            }, 1000);
          }
        });
    } catch (err: any) {
      console.error('[VoiceChat] Error joining:', err);
      setError(err.message || 'Failed to join voice channel');
      setIsConnecting(false);
      cleanup();
    }
  }, [channelId, user, profile, isConnecting, cleanup, createPeerConnection, ensurePeerConnection]);

  const leaveVoice = useCallback(() => {
    console.log('[VoiceChat] Leaving voice channel...');
    cleanup();
  }, [cleanup]);

  const updatePresence = () => {
    realtimeChannelRef.current?.track({
      user_id: userRef.current?.id,
      username: profileRef.current?.username || 'Unknown',
      isMuted: isMutedRef.current,
      isVideoOn: isVideoOnRef.current,
      isScreenSharing: isScreenSharingRef.current,
    });
  };

  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
        isMutedRef.current = !audioTrack.enabled;
        updatePresence();
      }
    }
  }, []);

  const toggleVideo = useCallback(async () => {
    if (!localStreamRef.current) return;

    if (isVideoOnRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.stop();
        localStreamRef.current.removeTrack(videoTrack);
        peerConnectionsRef.current.forEach(({ connection }) => {
          const sender = connection.getSenders().find(s => s.track === videoTrack);
          if (sender) connection.removeTrack(sender);
        });
      }
      setIsVideoOn(false);
      isVideoOnRef.current = false;
    } else {
      try {
        const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
        const videoTrack = videoStream.getVideoTracks()[0];
        localStreamRef.current.addTrack(videoTrack);

        peerConnectionsRef.current.forEach(({ connection }) => {
          connection.addTrack(videoTrack, localStreamRef.current!);
        });

        window.dispatchEvent(new CustomEvent('local-video-track', {
          detail: { stream: localStreamRef.current }
        }));

        setIsVideoOn(true);
        isVideoOnRef.current = true;
      } catch (err) {
        console.error('[VoiceChat] Error enabling video:', err);
        setError('Failed to enable video');
        return;
      }
    }
    updatePresence();
  }, []);

  const toggleScreenShare = useCallback(async () => {
    if (isScreenSharingRef.current) {
      if (screenStreamRef.current) {
        const screenTrack = screenStreamRef.current.getVideoTracks()[0];
        peerConnectionsRef.current.forEach(({ connection }) => {
          const sender = connection.getSenders().find(s => s.track === screenTrack);
          if (sender) connection.removeTrack(sender);
        });
        screenStreamRef.current.getTracks().forEach(t => t.stop());
        screenStreamRef.current = null;
      }
      // Notify UI to clear the screen share preview
      window.dispatchEvent(new CustomEvent('local-screen-share-stopped'));
      setIsScreenSharing(false);
      isScreenSharingRef.current = false;
    } else {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        screenStreamRef.current = screenStream;

        const videoTrack = screenStream.getVideoTracks()[0];
        peerConnectionsRef.current.forEach(({ connection }) => {
          connection.addTrack(videoTrack, screenStream);
        });

        videoTrack.onended = () => {
          peerConnectionsRef.current.forEach(({ connection }) => {
            const sender = connection.getSenders().find(s => s.track === videoTrack);
            if (sender) connection.removeTrack(sender);
          });
          screenStreamRef.current = null;
          setIsScreenSharing(false);
          isScreenSharingRef.current = false;
          updatePresence();
        };

        window.dispatchEvent(new CustomEvent('local-screen-share', {
          detail: { stream: screenStream }
        }));

        setIsScreenSharing(true);
        isScreenSharingRef.current = true;
      } catch (err) {
        console.error('[VoiceChat] Error sharing screen:', err);
        setError('Failed to share screen');
        return;
      }
    }
    updatePresence();
  }, []);

  const getLocalStream = useCallback(() => localStreamRef.current, []);

  // Poll WebRTC stats to determine call quality
  useEffect(() => {
    if (!isConnected) {
      if (statsIntervalRef.current) {
        clearInterval(statsIntervalRef.current);
        statsIntervalRef.current = null;
      }
      setCallQuality(null);
      return;
    }

    statsIntervalRef.current = setInterval(async () => {
      const peers = Array.from(peerConnectionsRef.current.values());
      if (peers.length === 0) {
        setCallQuality(null);
        return;
      }

      let totalRtt = 0;
      let totalPacketLoss = 0;
      let statCount = 0;

      for (const { connection } of peers) {
        try {
          const stats = await connection.getStats();
          stats.forEach((report) => {
            if (report.type === 'candidate-pair' && report.state === 'succeeded') {
              if (report.currentRoundTripTime != null) {
                totalRtt += report.currentRoundTripTime;
                statCount++;
              }
            }
            if (report.type === 'inbound-rtp' && report.kind === 'audio') {
              const lost = report.packetsLost ?? 0;
              const received = report.packetsReceived ?? 1;
              totalPacketLoss += lost / (lost + received);
            }
          });
        } catch {
          // Connection may be closing
        }
      }

      if (statCount === 0) {
        setCallQuality('good');
        return;
      }

      const avgRtt = totalRtt / statCount;
      const avgLoss = totalPacketLoss / Math.max(statCount, 1);

      // RTT thresholds: <150ms good, <400ms fair, else poor
      // Loss thresholds: <2% good, <8% fair, else poor
      if (avgRtt < 0.15 && avgLoss < 0.02) {
        setCallQuality('good');
      } else if (avgRtt < 0.4 && avgLoss < 0.08) {
        setCallQuality('fair');
      } else {
        setCallQuality('poor');
      }
    }, 3000);

    return () => {
      if (statsIntervalRef.current) {
        clearInterval(statsIntervalRef.current);
        statsIntervalRef.current = null;
      }
    };
  }, [isConnected]);

  useEffect(() => {
    return () => { cleanup(); };
  }, [cleanup]);

  return {
    isConnected,
    isConnecting,
    isReconnecting,
    isMuted,
    isVideoOn,
    isScreenSharing,
    participants,
    error,
    callQuality,
    joinVoice,
    leaveVoice,
    toggleMute,
    toggleVideo,
    toggleScreenShare,
    getLocalStream,
  };
};
