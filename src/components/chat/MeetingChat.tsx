import { useState, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useMessages } from '@/hooks/useMessages';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface MeetingChatProps {
  channelId: string;
}

export const MeetingChat = ({ channelId }: MeetingChatProps) => {
  const { user } = useAuth();
  const { messages, sendMessage } = useMessages(channelId);
  const [text, setText] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!text.trim()) return;
    const success = await sendMessage(text);
    if (success) setText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1 px-3 py-2">
        <div className="space-y-2">
          {messages.map((msg) => {
            const isOwn = msg.user_id === user?.id;
            const profile = (msg as any).profiles;
            return (
              <div key={msg.id} className={cn("flex gap-2 items-start", isOwn && "flex-row-reverse")}>
                <Avatar className="w-6 h-6 shrink-0">
                  <AvatarFallback className="text-[10px] bg-muted">
                    {(profile?.username || '??').substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className={cn(
                  "max-w-[80%] rounded-lg px-2.5 py-1.5 text-xs",
                  isOwn
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground"
                )}>
                  {!isOwn && (
                    <p className="font-semibold text-[10px] mb-0.5 opacity-70">
                      {profile?.display_name || profile?.username}
                    </p>
                  )}
                  <p className="break-words whitespace-pre-wrap">{msg.content}</p>
                  <p className={cn(
                    "text-[9px] mt-0.5 opacity-50",
                    isOwn ? "text-right" : "text-left"
                  )}>
                    {format(new Date(msg.created_at), 'HH:mm')}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <div className="p-2 border-t border-border flex gap-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          className="h-8 text-xs"
          maxLength={4000}
        />
        <Button
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={handleSend}
          disabled={!text.trim()}
        >
          <Send className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
};
