import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, PhoneOff, Phone, Volume2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useVoiceChat } from '@/hooks/useVoiceChat';
import { cn } from '@/lib/utils';

interface VoiceChannelProps {
  channelId: string;
  channelName: string;
}

export const VoiceChannel = ({ channelId, channelName }: VoiceChannelProps) => {
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

  return (
    <div className="border-t border-sidebar-border bg-sidebar/50 p-3">
      {/* Voice Channel Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Volume2 className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">{channelName}</span>
        </div>
        {participants.length > 0 && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Users className="w-3 h-3" />
            {participants.length}
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="text-xs text-destructive mb-2 p-2 bg-destructive/10 rounded">
          {error}
        </div>
      )}

      {/* Participants */}
      <AnimatePresence>
        {participants.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-1 mb-3"
          >
            {participants.map((participant) => (
              <motion.div
                key={participant.odUserId}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className={cn(
                  "flex items-center gap-2 p-1.5 rounded-md",
                  participant.isSpeaking && "bg-online/10 ring-1 ring-online"
                )}
              >
                <div className="relative">
                  <Avatar className="w-6 h-6">
                    <AvatarFallback className="text-xs bg-primary/20">
                      {participant.username.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  {participant.isSpeaking && (
                    <motion.div
                      className="absolute -inset-0.5 rounded-full bg-online/30"
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ duration: 0.5, repeat: Infinity }}
                    />
                  )}
                </div>
                <span className="text-xs flex-1 truncate">{participant.username}</span>
                {participant.isMuted && (
                  <MicOff className="w-3 h-3 text-destructive" />
                )}
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Controls */}
      <div className="flex gap-2">
        {!isConnected ? (
          <Button
            onClick={joinVoice}
            disabled={isConnecting}
            size="sm"
            className="flex-1 bg-online hover:bg-online/90 text-white"
          >
            <Phone className="w-4 h-4 mr-2" />
            {isConnecting ? 'Connecting...' : 'Join Voice'}
          </Button>
        ) : (
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={toggleMute}
                  size="sm"
                  variant={isMuted ? "destructive" : "secondary"}
                  className="flex-1"
                >
                  {isMuted ? (
                    <MicOff className="w-4 h-4" />
                  ) : (
                    <Mic className="w-4 h-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {isMuted ? 'Unmute' : 'Mute'}
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={leaveVoice}
                  size="sm"
                  variant="destructive"
                  className="flex-1"
                >
                  <PhoneOff className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Leave Voice</TooltipContent>
            </Tooltip>
          </>
        )}
      </div>
    </div>
  );
};
