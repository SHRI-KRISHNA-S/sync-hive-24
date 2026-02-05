 import { useState, useEffect, useCallback, useRef } from 'react';
 import { supabase } from '@/integrations/supabase/client';
 import { useAuth } from '@/contexts/AuthContext';
 import { TypingUser } from '@/lib/supabase-types';
 
 export const useTypingIndicator = (channelId: string | null) => {
   const { user, profile } = useAuth();
   const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
   const typingTimeoutRef = useRef<NodeJS.Timeout>();
   const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
 
   useEffect(() => {
     if (!channelId || !user) return;
 
     const channel = supabase.channel(`typing:${channelId}`);
     channelRef.current = channel;
 
     channel
       .on('broadcast', { event: 'typing' }, ({ payload }) => {
         if (payload.user_id !== user.id) {
           setTypingUsers(prev => {
             const exists = prev.some(u => u.user_id === payload.user_id);
             if (!exists) {
               return [...prev, payload];
             }
             return prev;
           });
 
           // Remove after 3 seconds
           setTimeout(() => {
             setTypingUsers(prev => prev.filter(u => u.user_id !== payload.user_id));
           }, 3000);
         }
       })
       .on('broadcast', { event: 'stop_typing' }, ({ payload }) => {
         setTypingUsers(prev => prev.filter(u => u.user_id !== payload.user_id));
       })
       .subscribe();
 
     return () => {
       supabase.removeChannel(channel);
       channelRef.current = null;
     };
   }, [channelId, user]);
 
   const startTyping = useCallback(() => {
     if (!channelRef.current || !user || !profile || !channelId) return;
 
     channelRef.current.send({
       type: 'broadcast',
       event: 'typing',
       payload: {
         user_id: user.id,
         username: profile.username,
         channel_id: channelId,
       },
     });
 
     // Clear existing timeout
     if (typingTimeoutRef.current) {
       clearTimeout(typingTimeoutRef.current);
     }
 
     // Auto stop typing after 3 seconds
     typingTimeoutRef.current = setTimeout(() => {
       stopTyping();
     }, 3000);
   }, [user, profile, channelId]);
 
   const stopTyping = useCallback(() => {
     if (!channelRef.current || !user) return;
 
     channelRef.current.send({
       type: 'broadcast',
       event: 'stop_typing',
       payload: {
         user_id: user.id,
       },
     });
 
     if (typingTimeoutRef.current) {
       clearTimeout(typingTimeoutRef.current);
     }
   }, [user]);
 
   return { typingUsers, startTyping, stopTyping };
 };