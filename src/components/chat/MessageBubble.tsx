import { motion } from 'framer-motion';
import { Message } from '@/lib/supabase-types';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { MessageAttachments } from './AttachmentPreview';
import { format, isToday, isYesterday } from 'date-fns';
import { Attachment } from '@/hooks/useMessages';

interface MessageBubbleProps {
  message: Message & { attachments?: Attachment[] };
  showAvatar: boolean;
}

const formatMessageTime = (dateString: string) => {
  const date = new Date(dateString);
  if (isToday(date)) {
    return `Today at ${format(date, 'h:mm a')}`;
  } else if (isYesterday(date)) {
    return `Yesterday at ${format(date, 'h:mm a')}`;
  }
  return format(date, 'MMM d, yyyy h:mm a');
};

const isOnlyEmojis = (text: string) => {
  const emojiRegex = /^[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\s]+$/u;
  return emojiRegex.test(text) && text.trim().length <= 8;
};

export const MessageBubble = ({ message, showAvatar }: MessageBubbleProps) => {
  const { user } = useAuth();
  const profile = message.profiles;
  const onlyEmojis = isOnlyEmojis(message.content);

  return (
    <motion.div
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
            <span className="font-semibold text-sm hover:underline cursor-pointer">
              {profile?.display_name || profile?.username || 'Unknown User'}
            </span>
            <span className="text-xs text-muted-foreground">
              {formatMessageTime(message.created_at)}
            </span>
          </div>
        )}
        {message.content !== '📎' && (
          <p className={`text-foreground break-words ${onlyEmojis ? 'text-4xl' : ''}`}>
            {message.content}
          </p>
        )}
        {message.attachments && message.attachments.length > 0 && (
          <MessageAttachments attachments={message.attachments} />
        )}
      </div>
    </motion.div>
  );
};
