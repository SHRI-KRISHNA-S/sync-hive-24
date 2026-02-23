import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Message, Profile } from '@/lib/supabase-types';
import { useAuth } from '@/contexts/AuthContext';

export const useMessages = (channelId: string | null) => {
  const { user } = useAuth();

  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  // ✅ keep latest channel safely (prevents stale events)
  const activeChannelRef = useRef<string | null>(channelId);

  useEffect(() => {
    activeChannelRef.current = channelId;
  }, [channelId]);

  // ---------------- FETCH MESSAGES ----------------
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

  // ---------------- REALTIME SUBSCRIPTION ----------------
  useEffect(() => {
    if (!channelId) return;

    const realtime = supabase
      .channel(`messages:${channelId}`)

      // -------- INSERT --------
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        async (payload) => {
          // ✅ Ignore stale events
          if (payload.new.channel_id !== activeChannelRef.current) return;

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

      // -------- DELETE --------
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          if (payload.old.channel_id !== activeChannelRef.current) return;

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

  // ---------------- SEND MESSAGE ----------------
  const sendMessage = async (content: string) => {
    if (!user || !channelId || !content.trim()) return false;

    const trimmed = content.trim();
    if (trimmed.length > 4000) return false;

    const { error } = await supabase.from('messages').insert({
      channel_id: channelId,
      user_id: user.id,
      content: trimmed,
    });

    return !error;
  };

  // ---------------- DELETE MESSAGE ----------------
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
