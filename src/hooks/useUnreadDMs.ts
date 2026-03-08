import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export const useUnreadDMs = () => {
  const { user } = useAuth();
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});

  const fetchUnreadCounts = useCallback(async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('direct_messages')
      .select('sender_id')
      .eq('receiver_id', user.id)
      .is('read_at', null);

    if (!error && data) {
      const counts: Record<string, number> = {};
      data.forEach(msg => {
        counts[msg.sender_id] = (counts[msg.sender_id] || 0) + 1;
      });
      setUnreadCounts(counts);
    }
  }, [user]);

  useEffect(() => {
    fetchUnreadCounts();
  }, [fetchUnreadCounts]);

  // Realtime subscription for new DMs
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('unread-dm-counter')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'direct_messages',
          filter: `receiver_id=eq.${user.id}`,
        },
        (payload) => {
          const senderId = (payload.new as any).sender_id;
          setUnreadCounts(prev => ({
            ...prev,
            [senderId]: (prev[senderId] || 0) + 1,
          }));
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'direct_messages',
          filter: `receiver_id=eq.${user.id}`,
        },
        (payload) => {
          // If read_at was set, refetch
          if ((payload.new as any).read_at) {
            fetchUnreadCounts();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchUnreadCounts]);

  const markAsRead = async (senderId: string) => {
    if (!user) return;

    await supabase
      .from('direct_messages')
      .update({ read_at: new Date().toISOString() })
      .eq('sender_id', senderId)
      .eq('receiver_id', user.id)
      .is('read_at', null);

    setUnreadCounts(prev => {
      const next = { ...prev };
      delete next[senderId];
      return next;
    });
  };

  const getUnreadCount = (userId: string) => unreadCounts[userId] || 0;
  const totalUnread = Object.values(unreadCounts).reduce((a, b) => a + b, 0);

  return { unreadCounts, getUnreadCount, totalUnread, markAsRead };
};
