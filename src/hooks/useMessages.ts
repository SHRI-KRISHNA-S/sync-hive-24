import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Message, Profile } from '@/lib/supabase-types';
import { useAuth } from '@/contexts/AuthContext';
import { RealtimeChannel } from '@supabase/supabase-js';

export const useMessages = (channelId: string | null) => {
  const { user } = useAuth();

  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  // ⭐ keep subscription reference
  const realtimeRef = useRef<RealtimeChannel | null>(null);

  /* -------------------------------------------------- */
  /* FETCH MESSAGES                                     */
  /* -------------------------------------------------- */
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
        profiles:profiles!messages_user_id_fkey(*)
      `)
      .eq('channel_id', channelId)
      .order('created_at', { ascending: true })
      .limit(100);

    if (!error && data) {
      const formatted = data.map(msg => ({
        ...msg,
        profiles: msg.profiles as unknown as Profile,
      }));

      setMessages(formatted);
    }

    setLoading(false);
  }, [channelId]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  /* -------------------------------------------------- */
  /* REALTIME SUBSCRIPTION                              */
  /* -------------------------------------------------- */
  useEffect(() => {
    if (!channelId) return;

    // ⭐ IMPORTANT FIX:
    // remove previous subscription BEFORE creating new one
    if (realtimeRef.current) {
      supabase.removeChannel(realtimeRef.current);
      realtimeRef.current = null;
    }

    // clear old messages immediately when switching channels
    setMessages([]);

    const realtimeChannel = supabase.channel(
      `messages-channel-${channelId}`
    );

    realtimeChannel
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `channel_id=eq.${channelId}`,
        },
        async payload => {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('*')
            .eq('user_id', payload.new.user_id)
            .single();

          const newMessage: Message = {
            ...(payload.new as Message),
            profiles: profileData as Profile,
          };

          setMessages(prev => {
            // prevent duplicates
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
        payload => {
          setMessages(prev =>
            prev.filter(m => m.id !== payload.old.id)
          );
        }
      )
      .subscribe();

    realtimeRef.current = realtimeChannel;

    // cleanup when channel changes/unmounts
    return () => {
      if (realtimeRef.current) {
        supabase.removeChannel(realtimeRef.current);
        realtimeRef.current = null;
      }
    };
  }, [channelId]);

  /* -------------------------------------------------- */
  /* SEND MESSAGE                                       */
  /* -------------------------------------------------- */
  const sendMessage = async (content: string) => {
    if (!user || !channelId) return false;

    const trimmed = content.trim();
    if (!trimmed || trimmed.length > 4000) return false;

    const { error } = await supabase.from('messages').insert({
      channel_id: channelId,
      user_id: user.id,
      content: trimmed,
    });

    return !error;
  };

  /* -------------------------------------------------- */
  /* DELETE MESSAGE                                     */
  /* -------------------------------------------------- */
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
