import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Message, Profile } from '@/lib/supabase-types';
import { useAuth } from '@/contexts/AuthContext';
import { RealtimeChannel } from '@supabase/supabase-js';
import { UploadedFile } from './useFileUpload';

export interface Attachment {
  id: string;
  file_url: string;
  file_name: string;
  file_type: string | null;
  file_size: number | null;
}

export interface MessageWithAttachments extends Message {
  attachments?: Attachment[];
}

export const useMessages = (channelId: string | null) => {
  const { user } = useAuth();

  const [messages, setMessages] = useState<MessageWithAttachments[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMessages = useCallback(async () => {
    if (!channelId) {
      setMessages([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const { data, error } = await supabase
      .from('messages')
      .select(`
        *,
        profiles:profiles!messages_user_id_fkey(*),
        attachments(*)
      `)
      .eq('channel_id', channelId)
      .order('created_at', { ascending: true })
      .limit(100);

    if (!error && data) {
      const formatted = data.map(msg => ({
        ...msg,
        profiles: msg.profiles as unknown as Profile,
        attachments: (msg.attachments || []) as Attachment[],
      }));

      setMessages(formatted);
    }

    setLoading(false);
  }, [channelId]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  useEffect(() => {
    if (!channelId) return;

    const realtime: RealtimeChannel = supabase
      .channel(`messages:${channelId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `channel_id=eq.${channelId}`,
        },
        async (payload) => {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('*')
            .eq('user_id', payload.new.user_id)
            .single();

          const { data: attachmentData } = await supabase
            .from('attachments')
            .select('*')
            .eq('message_id', payload.new.id);

          const newMessage: MessageWithAttachments = {
            ...(payload.new as Message),
            profiles: profileData as Profile,
            attachments: (attachmentData || []) as Attachment[],
          };

          setMessages(prev => {
            if (prev.some(m => m.id === newMessage.id)) return prev;
            return [...prev, newMessage];
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'messages',
          filter: `channel_id=eq.${channelId}`,
        },
        (payload) => {
          setMessages(prev =>
            prev.filter(m => m.id !== payload.old.id)
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(realtime);
    };
  }, [channelId]);

  const sendMessage = async (content: string, files?: UploadedFile[]) => {
    if (!user || !channelId) return false;
    if (!content.trim() && (!files || files.length === 0)) return false;

    const trimmed = content.trim();
    if (trimmed.length > 4000) return false;

    const { data: msgData, error } = await supabase
      .from('messages')
      .insert({
        channel_id: channelId,
        user_id: user.id,
        content: trimmed || '📎',
        has_attachments: (files && files.length > 0) || false,
      })
      .select()
      .single();

    if (error || !msgData) return false;

    // Insert attachment records
    if (files && files.length > 0) {
      await supabase.from('attachments').insert(
        files.map(f => ({
          message_id: msgData.id,
          file_url: f.file_url,
          file_name: f.file_name,
          file_type: f.file_type,
          file_size: f.file_size,
        }))
      );
    }

    return true;
  };

  const deleteMessage = async (messageId: string) => {
    const { error } = await supabase
      .from('messages')
      .delete()
      .eq('id', messageId);

    return !error;
  };

  return {
    messages,
    loading,
    sendMessage,
    deleteMessage,
    refreshMessages: fetchMessages,
  };
};
