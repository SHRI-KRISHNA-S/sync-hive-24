import { useState, useEffect } from 'react';
 import { supabase } from '@/integrations/supabase/client';
 import { useAuth } from '@/contexts/AuthContext';
import { RealtimePresenceJoinPayload, RealtimePresenceLeavePayload } from '@supabase/supabase-js';
 
 interface PresenceState {
   [key: string]: {
     user_id: string;
     username: string;
     status: 'online' | 'away' | 'offline';
     last_seen: string;
   }[];
 }
 
interface PresencePayload {
  user_id: string;
  username: string;
  status: string;
  last_seen: string;
}

 export const usePresence = (teamId: string | null) => {
   const { user, profile } = useAuth();
   const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
 
   useEffect(() => {
     if (!teamId || !user || !profile) return;
 
     const channel = supabase.channel(`presence:${teamId}`);
 
     channel
       .on('presence', { event: 'sync' }, () => {
         const state = channel.presenceState() as PresenceState;
         const users = Object.values(state).flat().map(u => u.user_id);
         setOnlineUsers([...new Set(users)]);
       })
      .on('presence', { event: 'join' }, ({ newPresences }: RealtimePresenceJoinPayload<PresencePayload>) => {
        const newUserIds = newPresences.map((p) => p.user_id);
         setOnlineUsers(prev => [...new Set([...prev, ...newUserIds])]);
       })
      .on('presence', { event: 'leave' }, ({ leftPresences }: RealtimePresenceLeavePayload<PresencePayload>) => {
        const leftUserIds = leftPresences.map((p) => p.user_id);
         setOnlineUsers(prev => prev.filter(id => !leftUserIds.includes(id)));
       })
       .subscribe(async (status) => {
         if (status === 'SUBSCRIBED') {
           await channel.track({
             user_id: user.id,
             username: profile.username,
             status: 'online',
             last_seen: new Date().toISOString(),
           });
         }
       });
 
     // Update profile status to online
     supabase
       .from('profiles')
       .update({ status: 'online', last_seen: new Date().toISOString() })
       .eq('user_id', user.id);
 
     return () => {
       supabase.removeChannel(channel);
       // Update profile status to offline when leaving
       supabase
         .from('profiles')
         .update({ status: 'offline', last_seen: new Date().toISOString() })
         .eq('user_id', user.id);
     };
   }, [teamId, user, profile]);
 
   const isUserOnline = (userId: string) => onlineUsers.includes(userId);
 
   return { onlineUsers, isUserOnline };
 };