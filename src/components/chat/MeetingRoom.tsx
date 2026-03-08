import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Video, VideoOff, Mic, MicOff, PhoneOff, Monitor, MonitorOff, Settings, Maximize2, Minimize2, WifiOff, SignalLow, SignalMedium, SignalHigh, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useVoiceChat, CallQuality } from '@/hooks/useVoiceChat';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { MeetingChat } from './MeetingChat';

interface MeetingRoomProps {
  channelId: string;
  channelName: string;
  onClose: () => void;
}

export const MeetingRoom = ({ channelId, channelName, onClose }: MeetingRoomProps) => {
  const { profile } = useAuth();
  const {
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
  } = useVoiceChat(channelId);
  
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const screenShareRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    // Auto-join when meeting room opens
    if (!isConnected && !isConnecting) {
      joinVoice();
    }
  }, []);

  // Handle local video track
  useEffect(() => {
    const handleLocalVideo = (event: CustomEvent) => {
      if (localVideoRef.current && event.detail.stream) {
        localVideoRef.current.srcObject = event.detail.stream;
      }
    };

    const handleLocalScreenShare = (event: CustomEvent) => {
      if (screenShareRef.current && event.detail.stream) {
        screenShareRef.current.srcObject = event.detail.stream;
      }
    };

    const handleRemoteVideo = (event: CustomEvent) => {
      const { targetUserId, stream } = event.detail;
      setRemoteStreams(prev => new Map(prev).set(targetUserId, stream));
    };

    window.addEventListener('local-video-track', handleLocalVideo as EventListener);
    window.addEventListener('local-screen-share', handleLocalScreenShare as EventListener);
    window.addEventListener('remote-video-track', handleRemoteVideo as EventListener);

    return () => {
      window.removeEventListener('local-video-track', handleLocalVideo as EventListener);
      window.removeEventListener('local-screen-share', handleLocalScreenShare as EventListener);
      window.removeEventListener('remote-video-track', handleRemoteVideo as EventListener);
    };
  }, []);

  // Update local video when video is toggled
  useEffect(() => {
    if (localVideoRef.current) {
      const stream = getLocalStream();
      if (stream && isVideoOn) {
        localVideoRef.current.srcObject = stream;
      } else {
        localVideoRef.current.srcObject = null;
      }
    }
  }, [isVideoOn, getLocalStream]);

  const handleLeave = () => {
    leaveVoice();
    onClose();
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const otherParticipants = participants.filter(p => p.odUserId !== profile?.user_id);

  return (
    <div className="flex-1 flex flex-col bg-background">
      {/* Header */}
      <div className="h-14 px-4 flex items-center justify-between border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-online animate-pulse" />
          <h2 className="font-semibold">{channelName} - Meeting</h2>
          <span className="text-sm text-muted-foreground">
            {participants.length} participant{participants.length !== 1 ? 's' : ''}
          </span>
          {/* Call Quality Indicator */}
          {callQuality && isConnected && (
            <div className={cn(
              "flex items-center gap-1 text-xs px-2 py-0.5 rounded-full",
              callQuality === 'good' && "bg-primary/15 text-primary",
              callQuality === 'fair' && "bg-accent text-accent-foreground",
              callQuality === 'poor' && "bg-destructive/15 text-destructive",
            )}>
              {callQuality === 'good' && <SignalHigh className="w-3 h-3" />}
              {callQuality === 'fair' && <SignalMedium className="w-3 h-3" />}
              {callQuality === 'poor' && <SignalLow className="w-3 h-3" />}
              <span className="capitalize">{callQuality}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={toggleFullscreen}>
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </Button>
          <Button variant="ghost" size="icon">
            <Settings className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mx-4 mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
          {error}
        </div>
      )}

      {/* Reconnecting Banner */}
      <AnimatePresence>
        {isReconnecting && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="mx-4 mt-4 p-3 bg-accent/50 border border-accent rounded-lg flex items-center gap-3 text-sm text-accent-foreground"
          >
            <WifiOff className="w-4 h-4 text-accent-foreground animate-pulse" />
            <span>Connection interrupted — reconnecting…</span>
            <div className="ml-auto w-4 h-4 border-2 border-accent-foreground border-t-transparent rounded-full animate-spin" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Connecting State */}
      {isConnecting && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Connecting to meeting...</p>
          </div>
        </div>
      )}

      {/* Screen Share View */}
      {isScreenSharing && (
        <div className="mx-4 mt-4 aspect-video bg-black rounded-xl overflow-hidden">
          <video
            ref={screenShareRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-contain"
          />
          <div className="absolute bottom-2 left-2 text-xs bg-black/70 text-white px-2 py-1 rounded">
            You are sharing your screen
          </div>
        </div>
      )}

      {/* Participants Grid */}
      {isConnected && !isConnecting && (
        <div className="flex-1 p-4 overflow-auto">
          <div className={cn(
            "grid gap-4 auto-rows-fr",
            participants.length <= 1 && "grid-cols-1",
            participants.length === 2 && "grid-cols-2",
            participants.length >= 3 && participants.length <= 4 && "grid-cols-2",
            participants.length >= 5 && "grid-cols-3"
          )}>
            {/* Current User */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className={cn(
                "relative aspect-video bg-muted rounded-xl flex items-center justify-center overflow-hidden",
                "ring-2 ring-primary/50"
              )}
            >
              {isVideoOn ? (
                <video
                  ref={localVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover mirror"
                  style={{ transform: 'scaleX(-1)' }}
                />
              ) : (
                <Avatar className="w-20 h-20">
                  <AvatarFallback className="text-2xl bg-primary text-primary-foreground">
                    {profile?.username?.substring(0, 2).toUpperCase() || 'ME'}
                  </AvatarFallback>
                </Avatar>
              )}
              <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
                <span className="text-xs bg-black/50 text-white px-2 py-1 rounded">
                  {profile?.display_name || profile?.username || 'You'} (You)
                </span>
                <div className="flex gap-1">
                  {isMuted && (
                    <span className="bg-destructive text-destructive-foreground p-1 rounded">
                      <MicOff className="w-3 h-3" />
                    </span>
                  )}
                  {!isVideoOn && (
                    <span className="bg-muted-foreground/50 text-white p-1 rounded">
                      <VideoOff className="w-3 h-3" />
                    </span>
                  )}
                </div>
              </div>
            </motion.div>

            {/* Other Participants */}
            <AnimatePresence>
              {otherParticipants.map((participant) => {
                const remoteStream = remoteStreams.get(participant.odUserId);
                const hasVideo = participant.isVideoOn && remoteStream?.getVideoTracks().length;

                return (
                  <motion.div
                    key={participant.odUserId}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className={cn(
                      "relative aspect-video bg-muted rounded-xl flex items-center justify-center overflow-hidden",
                      participant.isSpeaking && "ring-2 ring-online"
                    )}
                  >
                    {hasVideo ? (
                      <RemoteVideo userId={participant.odUserId} stream={remoteStream!} />
                    ) : (
                      <Avatar className="w-20 h-20">
                        <AvatarFallback className="text-2xl bg-secondary">
                          {participant.username.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
                      <span className="text-xs bg-black/50 text-white px-2 py-1 rounded truncate">
                        {participant.username}
                      </span>
                      <div className="flex gap-1">
                        {participant.isMuted && (
                          <span className="bg-destructive text-destructive-foreground p-1 rounded">
                            <MicOff className="w-3 h-3" />
                          </span>
                        )}
                        {!participant.isVideoOn && (
                          <span className="bg-muted-foreground/50 text-white p-1 rounded">
                            <VideoOff className="w-3 h-3" />
                          </span>
                        )}
                        {participant.isScreenSharing && (
                          <span className="bg-primary text-primary-foreground p-1 rounded">
                            <Monitor className="w-3 h-3" />
                          </span>
                        )}
                      </div>
                    </div>
                    {participant.isSpeaking && (
                      <motion.div
                        className="absolute inset-0 rounded-xl border-2 border-online pointer-events-none"
                        animate={{ opacity: [0.5, 1, 0.5] }}
                        transition={{ duration: 1, repeat: Infinity }}
                      />
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="h-20 px-4 flex items-center justify-center gap-3 border-t border-border bg-card">
        <Button
          variant={isMuted ? "destructive" : "secondary"}
          size="lg"
          className="rounded-full w-14 h-14"
          onClick={toggleMute}
          disabled={!isConnected}
        >
          {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
        </Button>
        
        <Button
          variant={isVideoOn ? "secondary" : "outline"}
          size="lg"
          className="rounded-full w-14 h-14"
          onClick={toggleVideo}
          disabled={!isConnected}
        >
          {isVideoOn ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
        </Button>

        <Button
          variant={isScreenSharing ? "secondary" : "outline"}
          size="lg"
          className="rounded-full w-14 h-14"
          onClick={toggleScreenShare}
          disabled={!isConnected}
        >
          {isScreenSharing ? <Monitor className="w-6 h-6" /> : <MonitorOff className="w-6 h-6" />}
        </Button>
        
        <Button
          variant="destructive"
          size="lg"
          className="rounded-full w-14 h-14"
          onClick={handleLeave}
        >
          <PhoneOff className="w-6 h-6" />
        </Button>
      </div>
    </div>
  );
};

// Remote video component
const RemoteVideo = ({ userId, stream }: { userId: string; stream: MediaStream }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      className="w-full h-full object-cover"
    />
  );
};
