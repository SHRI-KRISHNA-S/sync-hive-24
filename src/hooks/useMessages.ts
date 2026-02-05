 import { useState, useEffect, useCallback } from 'react';
 import { supabase } from '@/integrations/supabase/client';
 import { Message, Profile } from '@/lib/supabase-types';
 import { useAuth } from '@/contexts/AuthContext';
 
 export const useMessages = (channelId: string | null) => {
   const { user } = useAuth();
   const [messages, setMessages] = useState<Message[]>([]);
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
         profiles:profiles!messages_user_id_fkey(*)
       `)
       .eq('channel_id', channelId)
       .order('created_at', { ascending: true })
       .limit(100);
 
     if (!error && data) {
       const messagesWithProfiles = data.map(msg => ({
         ...msg,
         profiles: msg.profiles as unknown as Profile,
       }));
       setMessages(messagesWithProfiles);
     }
     setLoading(false);
   }, [channelId]);
 
   useEffect(() => {
     fetchMessages();
   }, [fetchMessages]);
 
   // Real-time subscription for new messages
   useEffect(() => {
     if (!channelId) return;
 
     const channel = supabase
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
           // Fetch the profile for the new message
           const { data: profileData } = await supabase
             .from('profiles')
             .select('*')
             .eq('user_id', payload.new.user_id)
             .single();
           
           const newMessage: Message = {
             ...payload.new as Message,
             profiles: profileData as Profile,
           };
           
           setMessages(prev => [...prev, newMessage]);
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
           setMessages(prev => prev.filter(m => m.id !== payload.old.id));
         }
       )
       .subscribe();
 
     return () => {
       supabase.removeChannel(channel);
     };
   }, [channelId]);
 
   const sendMessage = async (content: string) => {
     if (!user || !channelId || !content.trim()) return;
 
     const { error } = await supabase.from('messages').insert({
       channel_id: channelId,
       user_id: user.id,
       content: content.trim(),
     });
 
     return !error;
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