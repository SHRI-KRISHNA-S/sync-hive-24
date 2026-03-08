import { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Send, Smile, ArrowLeft } from 'lucide-react';
import { useDirectMessages } from '@/hooks/useDirectMessages';
import { useAuth } from '@/contexts/AuthContext';
import { Profile } from '@/lib/supabase-types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { EmojiPicker } from './EmojiPicker';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format, isToday, isYesterday } from 'date-fns';

interface DirectMessageAreaProps {
  otherUser: Profile;
  isOnline: boolean;
  onBack: () => void;
}

const formatTime = (dateString: string) => {
  const date = new Date(dateString);
  if (isToday(date)) return `Today at ${format(date, 'h:mm a')}`;
  if (isYesterday(date)) return `Yesterday at ${format(date, 'h:mm a')}`;
  return format(date, 'MMM d, yyyy h:mm a');
};

export const DirectMessageArea = ({ otherUser, isOnline, onBack }: DirectMessageAreaProps) => {
  const { user } = useAuth();
  const { messages, loading, sendMessage } = useDirectMessages(otherUser.user_id);
  const [messageText, setMessageText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!messageText.trim()) return;
    const success = await sendMessage(messageText);
    if (success) setMessageText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const insertEmoji = (emoji: string) => {
    setMessageText(prev => prev + emoji);
    textareaRef.current?.focus();
  };

  return (
    <div className="flex-1 flex flex-col bg-background">
      {/* Header */}
      <div className="h-14 px-4 flex items-center gap-3 border-b border-border bg-card">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onBack}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="relative">
          <Avatar className="h-8 w-8">
            <AvatarImage src={otherUser.avatar_url || undefined} />
            <AvatarFallback className="text-xs bg-primary text-primary-foreground">
              {otherUser.username?.substring(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span
            className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-card ${
              isOnline ? 'bg-online' : 'bg-offline'
            }`}
          />
        </div>
        <div>
          <h3 className="font-semibold text-sm">{otherUser.display_name || otherUser.username}</h3>
          <span className="text-xs text-muted-foreground">{isOnline ? 'Online' : 'Offline'}</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-pulse-subtle text-muted-foreground">Loading messages...</div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <MessageSquare className="w-12 h-12 mb-4 opacity-30" />
            <p className="text-lg font-medium">Start a conversation</p>
            <p className="text-sm">Send a message to {otherUser.display_name || otherUser.username}</p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {messages.map((msg, index) => {
              const isOwn = msg.sender_id === user?.id;
              const profile = isOwn ? msg.sender_profile : msg.sender_profile;
              const showAvatar = index === 0 || messages[index - 1]?.sender_id !== msg.sender_id;

              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className={`flex gap-3 ${showAvatar ? 'mt-4' : 'mt-0.5'} group hover:bg-muted/30 -mx-2 px-2 py-0.5 rounded-md transition-colors`}
                >
                  <div className="w-10 shrink-0">
                    {showAvatar && (
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={profile?.avatar_url || undefined} />
                        <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                          {profile?.username?.substring(0, 2).toUpperCase() || '??'}
                        </AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    {showAvatar && (
                      <div className="flex items-baseline gap-2 mb-0.5">
                        <span className="font-semibold text-sm">
                          {profile?.display_name || profile?.username || 'Unknown'}
                        </span>
                        <span className="text-xs text-muted-foreground">{formatTime(msg.created_at)}</span>
                      </div>
                    )}
                    <p className="text-foreground break-words">{msg.content}</p>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-border bg-card">
        <div className="flex items-end gap-2 bg-secondary rounded-lg p-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8">
                <Smile className="w-5 h-5 text-muted-foreground hover:text-foreground" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-2" side="top" align="start">
              <EmojiPicker onSelect={insertEmoji} />
            </PopoverContent>
          </Popover>

          <Textarea
            ref={textareaRef}
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Message ${otherUser.display_name || otherUser.username}`}
            className="flex-1 min-h-[40px] max-h-[120px] resize-none border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
            rows={1}
          />

          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 h-8 w-8"
            onClick={handleSend}
            disabled={!messageText.trim()}
          >
            <Send className={`w-5 h-5 ${messageText.trim() ? 'text-primary' : 'text-muted-foreground'}`} />
          </Button>
        </div>
      </div>
    </div>
  );
};
