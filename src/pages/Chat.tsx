 import { useEffect } from 'react';
 import { useNavigate } from 'react-router-dom';
 import { motion } from 'framer-motion';
 import { MessageSquare, Loader2 } from 'lucide-react';
 import { useAuth } from '@/contexts/AuthContext';
 import { TeamProvider, useTeam } from '@/contexts/TeamContext';
 import { TeamSidebar } from '@/components/chat/TeamSidebar';
 import { ChannelSidebar } from '@/components/chat/ChannelSidebar';
 import { ChatArea } from '@/components/chat/ChatArea';
 import { Button } from '@/components/ui/button';
 import { CreateTeamDialog } from '@/components/chat/CreateTeamDialog';
 import { JoinTeamDialog } from '@/components/chat/JoinTeamDialog';
 import { useState } from 'react';
 
 const ChatContent = () => {
   const { teams, loading } = useTeam();
   const [showCreateDialog, setShowCreateDialog] = useState(false);
   const [showJoinDialog, setShowJoinDialog] = useState(false);
 
   if (loading) {
     return (
       <div className="flex-1 flex items-center justify-center bg-background">
         <Loader2 className="w-8 h-8 animate-spin text-primary" />
       </div>
     );
   }
 
   if (teams.length === 0) {
     return (
       <div className="flex-1 flex items-center justify-center bg-background">
         <motion.div
           initial={{ opacity: 0, y: 20 }}
           animate={{ opacity: 1, y: 0 }}
           className="text-center max-w-md px-8"
         >
           <div className="w-20 h-20 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
             <MessageSquare className="w-10 h-10 text-primary" />
           </div>
           <h2 className="text-2xl font-bold mb-2">Welcome to TeamFlow!</h2>
           <p className="text-muted-foreground mb-8">
             Get started by creating a new team or joining an existing one with an invite code.
           </p>
           <div className="flex gap-4 justify-center">
             <Button onClick={() => setShowCreateDialog(true)} size="lg">
               Create a Team
             </Button>
             <Button onClick={() => setShowJoinDialog(true)} variant="outline" size="lg">
               Join a Team
             </Button>
           </div>
 
           <CreateTeamDialog open={showCreateDialog} onOpenChange={setShowCreateDialog} />
           <JoinTeamDialog open={showJoinDialog} onOpenChange={setShowJoinDialog} />
         </motion.div>
       </div>
     );
   }
 
   return (
     <>
       <TeamSidebar />
       <ChannelSidebar />
       <ChatArea />
     </>
   );
 };
 
 export default function Chat() {
   const navigate = useNavigate();
   const { user, loading } = useAuth();
 
   useEffect(() => {
     if (!loading && !user) {
       navigate('/auth');
     }
   }, [user, loading, navigate]);
 
   if (loading) {
     return (
       <div className="min-h-screen flex items-center justify-center bg-background">
         <Loader2 className="w-8 h-8 animate-spin text-primary" />
       </div>
     );
   }
 
   if (!user) {
     return null;
   }
 
   return (
     <TeamProvider>
       <div className="h-screen flex overflow-hidden">
         <ChatContent />
       </div>
     </TeamProvider>
   );
 }