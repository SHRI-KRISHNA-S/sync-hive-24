 import { useState } from 'react';
 import { motion } from 'framer-motion';
 import { Plus, Settings, LogOut, Users } from 'lucide-react';
 import { useTeam } from '@/contexts/TeamContext';
 import { useAuth } from '@/contexts/AuthContext';
 import { Button } from '@/components/ui/button';
 import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
 import { CreateTeamDialog } from './CreateTeamDialog';
 import { JoinTeamDialog } from './JoinTeamDialog';
 
 export const TeamSidebar = () => {
   const { teams, currentTeam, setCurrentTeam } = useTeam();
   const { signOut } = useAuth();
   const [showCreateDialog, setShowCreateDialog] = useState(false);
   const [showJoinDialog, setShowJoinDialog] = useState(false);
 
   return (
     <div className="flex flex-col items-center w-16 bg-sidebar py-4 gap-2 border-r border-sidebar-border">
       {/* Team Icons */}
       <div className="flex-1 flex flex-col gap-2 overflow-y-auto scrollbar-thin">
         {teams.map((team, index) => (
           <Tooltip key={team.id}>
             <TooltipTrigger asChild>
               <motion.button
                 initial={{ scale: 0, opacity: 0 }}
                 animate={{ scale: 1, opacity: 1 }}
                 transition={{ delay: index * 0.05 }}
                 onClick={() => setCurrentTeam(team)}
                 className={`
                   relative w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-semibold
                   transition-all duration-200 hover:rounded-xl
                   ${currentTeam?.id === team.id 
                     ? 'bg-primary text-primary-foreground rounded-xl' 
                     : 'bg-sidebar-accent text-sidebar-foreground hover:bg-sidebar-primary hover:text-sidebar-primary-foreground'
                   }
                 `}
               >
                 {team.icon_url ? (
                   <img src={team.icon_url} alt={team.name} className="w-full h-full rounded-inherit object-cover" />
                 ) : (
                   team.name.substring(0, 2).toUpperCase()
                 )}
                 {currentTeam?.id === team.id && (
                   <motion.div 
                     layoutId="activeTeam"
                     className="absolute -left-2 w-1 h-8 bg-primary rounded-r-full"
                   />
                 )}
               </motion.button>
             </TooltipTrigger>
             <TooltipContent side="right">
               <p>{team.name}</p>
             </TooltipContent>
           </Tooltip>
         ))}
 
         {/* Add Team Button */}
         <div className="flex flex-col gap-1 mt-2">
           <Tooltip>
             <TooltipTrigger asChild>
               <Button
                 variant="ghost"
                 size="icon"
                 onClick={() => setShowCreateDialog(true)}
                 className="w-12 h-12 rounded-2xl hover:rounded-xl transition-all duration-200 bg-sidebar-accent hover:bg-online hover:text-white"
               >
                 <Plus className="w-5 h-5" />
               </Button>
             </TooltipTrigger>
             <TooltipContent side="right">
               <p>Create Team</p>
             </TooltipContent>
           </Tooltip>
 
           <Tooltip>
             <TooltipTrigger asChild>
               <Button
                 variant="ghost"
                 size="icon"
                 onClick={() => setShowJoinDialog(true)}
                 className="w-12 h-12 rounded-2xl hover:rounded-xl transition-all duration-200 bg-sidebar-accent hover:bg-primary hover:text-primary-foreground"
               >
                 <Users className="w-5 h-5" />
               </Button>
             </TooltipTrigger>
             <TooltipContent side="right">
               <p>Join Team</p>
             </TooltipContent>
           </Tooltip>
         </div>
       </div>
 
       {/* Bottom Actions */}
       <div className="flex flex-col gap-2 pt-2 border-t border-sidebar-border">
         <Tooltip>
           <TooltipTrigger asChild>
             <Button
               variant="ghost"
               size="icon"
               onClick={signOut}
               className="w-12 h-12 rounded-2xl hover:rounded-xl transition-all duration-200 hover:bg-destructive hover:text-destructive-foreground"
             >
               <LogOut className="w-5 h-5" />
             </Button>
           </TooltipTrigger>
           <TooltipContent side="right">
             <p>Sign Out</p>
           </TooltipContent>
         </Tooltip>
       </div>
 
       <CreateTeamDialog open={showCreateDialog} onOpenChange={setShowCreateDialog} />
       <JoinTeamDialog open={showJoinDialog} onOpenChange={setShowJoinDialog} />
     </div>
   );
 };