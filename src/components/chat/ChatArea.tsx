import { useRef, useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Hash, Smile, Paperclip, Send, Loader2, Settings } from 'lucide-react';
import { useTeam } from '@/contexts/TeamContext';
import { useMessages } from '@/hooks/useMessages';
import { useTypingIndicator } from '@/hooks/useTypingIndicator';
import { useFileUpload } from '@/hooks/useFileUpload';
import { useReactions } from '@/hooks/useReactions';
import { MessageBubble } from './MessageBubble';
import { TypingIndicator } from './TypingIndicator';
import { AttachmentPreview } from './AttachmentPreview';
import { ChannelSettingsDialog } from './ChannelSettingsDialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { EmojiPicker } from './EmojiPicker';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export const ChatArea = () => {
  const { currentChannel } = useTeam();
  const { messages, loading, sendMessage } = useMessages(currentChannel?.id || null);
  const { typingUsers, startTyping, stopTyping } = useTypingIndicator(currentChannel?.id || null);
  const { uploading, pendingFiles, addPendingFile, removePendingFile, clearPendingFiles, isImage } = useFileUpload();
  const [messageText, setMessageText] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const messageIds = useMemo(() => messages.map(m => m.id), [messages]);
  const { getReactions, toggleReaction } = useReactions(messageIds, 'message');

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!messageText.trim() && pendingFiles.length === 0) return;

    const success = await sendMessage(messageText, pendingFiles.length > 0 ? pendingFiles : undefined);
    if (success) {
      setMessageText('');
      clearPendingFiles();
      stopTyping();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessageText(e.target.value);
    startTyping();
  };

  const insertEmoji = (emoji: string) => {
    setMessageText(prev => prev + emoji);
    textareaRef.current?.focus();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      Array.from(files).forEach(file => addPendingFile(file));
    }
    e.target.value = '';
  };

  if (!currentChannel) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="text-center text-muted-foreground">
          <Hash className="w-16 h-16 mx-auto mb-4 opacity-30" />
          <p className="text-lg">Select a channel to start chatting</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-background">
      <div className="h-14 px-4 flex items-center gap-2 border-b border-border bg-card">
        <Hash className="w-5 h-5 text-muted-foreground" />
        <h3 className="font-semibold">{currentChannel.name}</h3>
        {currentChannel.description && (
          <>
            <div className="w-px h-4 bg-border mx-2" />
            <span className="text-sm text-muted-foreground truncate">{currentChannel.description}</span>
          </>
        )}
        <div className="ml-auto">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowSettings(true)}>
            <Settings className="w-4 h-4 text-muted-foreground" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-pulse-subtle text-muted-foreground">Loading messages...</div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <Hash className="w-12 h-12 mb-4 opacity-30" />
            <p className="text-lg font-medium">Welcome to #{currentChannel.name}</p>
            <p className="text-sm">This is the start of the channel.</p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {messages.map((message, index) => (
              <MessageBubble
                key={message.id}
                message={message}
                showAvatar={index === 0 || messages[index - 1]?.user_id !== message.user_id}
                reactions={getReactions(message.id)}
                onToggleReaction={(emoji) => toggleReaction(message.id, emoji)}
              />
            ))}
          </AnimatePresence>
        )}
        <div ref={messagesEndRef} />
      </div>

      <TypingIndicator users={typingUsers} />

      <div className="p-4 border-t border-border bg-card">
        <AttachmentPreview files={pendingFiles} onRemove={removePendingFile} isImage={isImage} />
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

          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 h-8 w-8"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            ) : (
              <Paperclip className="w-5 h-5 text-muted-foreground hover:text-foreground" />
            )}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            multiple
            accept="image/*,.pdf,.doc,.docx,.txt"
            onChange={handleFileSelect}
          />

          <Textarea
            ref={textareaRef}
            value={messageText}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={`Message #${currentChannel.name}`}
            className="flex-1 min-h-[40px] max-h-[120px] resize-none border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
            rows={1}
          />

          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 h-8 w-8"
            onClick={handleSend}
            disabled={!messageText.trim() && pendingFiles.length === 0}
          >
            <Send className={`w-5 h-5 ${messageText.trim() || pendingFiles.length > 0 ? 'text-primary' : 'text-muted-foreground'}`} />
          </Button>
        </div>
      </div>
    </div>
  );
};
