import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DirectMessage, Profile } from '@/lib/supabase-types';
import { useAuth } from '@/contexts/AuthContext';
import { RealtimeChannel } from '@supabase/supabase-js';

export const useDirectMessages = (otherUserId: string | null) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<DirectMessage[]>([]);
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
      .select('*')
      .or(
        `and(sender_id.eq.${user.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${user.id})`
      )
      .order('created_at', { ascending: true })
      .limit(100);

    if (!error && data) {
      // Fetch profiles for both users
      const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .in('user_id', [user.id, otherUserId]);

      const profileMap = new Map<string, Profile>();
      profiles?.forEach(p => profileMap.set(p.user_id, p as Profile));

      const formatted: DirectMessage[] = data.map(msg => ({
        ...msg,
        has_attachments: msg.has_attachments ?? false,
        sender_profile: profileMap.get(msg.sender_id),
        receiver_profile: profileMap.get(msg.receiver_id),
      }));

      setMessages(formatted);
    }

    setLoading(false);
  }, [otherUserId, user]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Realtime subscription
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
          // Only handle messages in this conversation
          const isRelevant =
            (newMsg.sender_id === user.id && newMsg.receiver_id === otherUserId) ||
            (newMsg.sender_id === otherUserId && newMsg.receiver_id === user.id);

          if (!isRelevant) return;

          const { data: profiles } = await supabase
            .from('profiles')
            .select('*')
            .in('user_id', [newMsg.sender_id, newMsg.receiver_id]);

          const profileMap = new Map<string, Profile>();
          profiles?.forEach(p => profileMap.set(p.user_id, p as Profile));

          const formatted: DirectMessage = {
            ...newMsg,
            has_attachments: newMsg.has_attachments ?? false,
            sender_profile: profileMap.get(newMsg.sender_id),
            receiver_profile: profileMap.get(newMsg.receiver_id),
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

  const sendMessage = async (content: string) => {
    if (!user || !otherUserId || !content.trim()) return false;

    const trimmed = content.trim();
    if (trimmed.length > 4000) return false;

    const { error } = await supabase.from('direct_messages').insert({
      sender_id: user.id,
      receiver_id: otherUserId,
      content: trimmed,
    });

    return !error;
  };

  return { messages, loading, sendMessage, refreshMessages: fetchMessages };
};
