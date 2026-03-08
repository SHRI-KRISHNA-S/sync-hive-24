import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DirectMessage, Profile } from '@/lib/supabase-types';
import { useAuth } from '@/contexts/AuthContext';
import { RealtimeChannel } from '@supabase/supabase-js';
import { UploadedFile } from './useFileUpload';

export interface DMAttachment {
  id: string;
  file_url: string;
  file_name: string;
  file_type: string | null;
  file_size: number | null;
}

export interface DirectMessageWithAttachments extends DirectMessage {
  attachments?: DMAttachment[];
}

export const useDirectMessages = (otherUserId: string | null) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<DirectMessageWithAttachments[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMessages = useCallback(async () => {
    if (!otherUserId || !user) {
      setMessages([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const { data, error } = await supabase
      .from('direct_messages')
      .select('*, attachments(*)')
      .or(
        `and(sender_id.eq.${user.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${user.id})`
      )
      .order('created_at', { ascending: true })
      .limit(100);

    if (!error && data) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .in('user_id', [user.id, otherUserId]);

      const profileMap = new Map<string, Profile>();
      profiles?.forEach(p => profileMap.set(p.user_id, p as Profile));

      const formatted: DirectMessageWithAttachments[] = data.map(msg => ({
        ...msg,
        has_attachments: msg.has_attachments ?? false,
        sender_profile: profileMap.get(msg.sender_id),
        receiver_profile: profileMap.get(msg.receiver_id),
        attachments: (msg.attachments || []) as DMAttachment[],
      }));

      setMessages(formatted);
    }

    setLoading(false);
  }, [otherUserId, user]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  useEffect(() => {
    if (!otherUserId || !user) return;

    const channel: RealtimeChannel = supabase
      .channel(`dm:${[user.id, otherUserId].sort().join('-')}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'direct_messages',
        },
        async (payload) => {
          const newMsg = payload.new as any;
          const isRelevant =
            (newMsg.sender_id === user.id && newMsg.receiver_id === otherUserId) ||
            (newMsg.sender_id === otherUserId && newMsg.receiver_id === user.id);

          if (!isRelevant) return;

          const { data: profiles } = await supabase
            .from('profiles')
            .select('*')
            .in('user_id', [newMsg.sender_id, newMsg.receiver_id]);

          const { data: attachmentData } = await supabase
            .from('attachments')
            .select('*')
            .eq('dm_id', newMsg.id);

          const profileMap = new Map<string, Profile>();
          profiles?.forEach(p => profileMap.set(p.user_id, p as Profile));

          const formatted: DirectMessageWithAttachments = {
            ...newMsg,
            has_attachments: newMsg.has_attachments ?? false,
            sender_profile: profileMap.get(newMsg.sender_id),
            receiver_profile: profileMap.get(newMsg.receiver_id),
            attachments: (attachmentData || []) as DMAttachment[],
          };

          setMessages(prev => {
            if (prev.some(m => m.id === formatted.id)) return prev;
            return [...prev, formatted];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [otherUserId, user]);

  const sendMessage = async (content: string, files?: UploadedFile[]) => {
    if (!user || !otherUserId) return false;
    if (!content.trim() && (!files || files.length === 0)) return false;

    const trimmed = content.trim();
    if (trimmed.length > 4000) return false;

    const { data: msgData, error } = await supabase
      .from('direct_messages')
      .insert({
        sender_id: user.id,
        receiver_id: otherUserId,
        content: trimmed || '📎',
        has_attachments: (files && files.length > 0) || false,
      })
      .select()
      .single();

    if (error || !msgData) return false;

    if (files && files.length > 0) {
      await supabase.from('attachments').insert(
        files.map(f => ({
          dm_id: msgData.id,
          file_url: f.file_url,
          file_name: f.file_name,
          file_type: f.file_type,
          file_size: f.file_size,
        }))
      );
    }

    return true;
  };

  return { messages, loading, sendMessage, refreshMessages: fetchMessages };
};
