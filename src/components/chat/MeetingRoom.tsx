import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Video, VideoOff, Mic, MicOff, PhoneOff, Users, Settings, Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useVoiceChat } from '@/hooks/useVoiceChat';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

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
    isMuted,
    participants,
    error,
    joinVoice,
    leaveVoice,
    toggleMute,
  } = useVoiceChat(channelId);
  
  const [isVideoOn, setIsVideoOn] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    // Auto-join when meeting room opens
    if (!isConnected && !isConnecting) {
      joinVoice();
    }
  }, []);

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

  return (
    <div className="flex-1 flex flex-col bg-background">
      {/* Header */}
      <div className="h-14 px-4 flex items-center justify-between border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-online animate-pulse" />
          <h2 className="font-semibold">{channelName} - Meeting</h2>
          <span className="text-sm text-muted-foreground">
            {participants.length + 1} participant{participants.length !== 0 ? 's' : ''}
          </span>
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

      {/* Participants Grid */}
      <div className="flex-1 p-4 overflow-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 auto-rows-fr">
          {/* Current User */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className={cn(
              "relative aspect-video bg-muted rounded-xl flex items-center justify-center overflow-hidden",
              "ring-2 ring-primary/50"
            )}
          >
            <div className="absolute inset-0 flex items-center justify-center">
              {isVideoOn ? (
                <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/5" />
              ) : (
                <Avatar className="w-20 h-20">
                  <AvatarFallback className="text-2xl bg-primary text-primary-foreground">
                    {profile?.username?.substring(0, 2).toUpperCase() || 'ME'}
                  </AvatarFallback>
                </Avatar>
              )}
            </div>
            <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
              <span className="text-xs bg-black/50 text-white px-2 py-1 rounded">
                {profile?.display_name || profile?.username || 'You'} (You)
              </span>
              {isMuted && (
                <span className="bg-destructive text-destructive-foreground p-1 rounded">
                  <MicOff className="w-3 h-3" />
                </span>
              )}
            </div>
          </motion.div>

          {/* Other Participants */}
          <AnimatePresence>
            {participants
              .filter(p => p.odUserId !== profile?.user_id)
              .map((participant) => (
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
                  <Avatar className="w-20 h-20">
                    <AvatarFallback className="text-2xl bg-secondary">
                      {participant.username.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
                    <span className="text-xs bg-black/50 text-white px-2 py-1 rounded truncate">
                      {participant.username}
                    </span>
                    {participant.isMuted && (
                      <span className="bg-destructive text-destructive-foreground p-1 rounded">
                        <MicOff className="w-3 h-3" />
                      </span>
                    )}
                  </div>
                  {participant.isSpeaking && (
                    <motion.div
                      className="absolute inset-0 rounded-xl border-2 border-online"
                      animate={{ opacity: [0.5, 1, 0.5] }}
                      transition={{ duration: 1, repeat: Infinity }}
                    />
                  )}
                </motion.div>
              ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Controls */}
      <div className="h-20 px-4 flex items-center justify-center gap-4 border-t border-border bg-card">
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
          onClick={() => setIsVideoOn(!isVideoOn)}
          disabled
          title="Video coming soon"
        >
          {isVideoOn ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
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

