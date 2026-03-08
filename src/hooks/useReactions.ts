import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface ReactionGroup {
  emoji: string;
  count: number;
  userIds: string[];
  hasReacted: boolean;
}

export interface ReactionsMap {
  [messageId: string]: ReactionGroup[];
}

export const useReactions = (messageIds: string[], type: 'message' | 'dm') => {
  const { user } = useAuth();
  const [reactionsMap, setReactionsMap] = useState<ReactionsMap>({});

  const fetchReactions = useCallback(async () => {
    if (messageIds.length === 0) return;

    const column = type === 'message' ? 'message_id' : 'dm_id';
    const { data, error } = await supabase
      .from('reactions')
      .select('*')
      .in(column, messageIds);

    if (error || !data) return;

    const map: ReactionsMap = {};
    data.forEach((r: any) => {
      const key = type === 'message' ? r.message_id : r.dm_id;
      if (!map[key]) map[key] = [];

      const existing = map[key].find(g => g.emoji === r.emoji);
      if (existing) {
        existing.count++;
        existing.userIds.push(r.user_id);
        if (r.user_id === user?.id) existing.hasReacted = true;
      } else {
        map[key].push({
          emoji: r.emoji,
          count: 1,
          userIds: [r.user_id],
          hasReacted: r.user_id === user?.id,
        });
      }
    });

    setReactionsMap(map);
  }, [messageIds.join(','), type, user?.id]);

  useEffect(() => {
    fetchReactions();
  }, [fetchReactions]);

  // Realtime subscription
  useEffect(() => {
    if (messageIds.length === 0) return;

    const channel = supabase
      .channel(`reactions:${type}:${messageIds[0]?.substring(0, 8)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reactions' },
        () => {
          // Refetch on any reaction change
          fetchReactions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [messageIds.join(','), type, fetchReactions]);

  const toggleReaction = async (targetId: string, emoji: string) => {
    if (!user) return;

    const column = type === 'message' ? 'message_id' : 'dm_id';
    const reactions = reactionsMap[targetId] || [];
    const existing = reactions.find(r => r.emoji === emoji && r.hasReacted);

    if (existing) {
      // Remove reaction
      await supabase
        .from('reactions')
        .delete()
        .eq(column, targetId)
        .eq('user_id', user.id)
        .eq('emoji', emoji);
    } else {
      // Add reaction
      await supabase
        .from('reactions')
        .insert({
          [column]: targetId,
          user_id: user.id,
          emoji,
        } as any);
    }
  };

  const getReactions = (messageId: string): ReactionGroup[] => {
    return reactionsMap[messageId] || [];
  };

  return { reactionsMap, getReactions, toggleReaction };
};
