 import { useState } from 'react';
 import { motion } from 'framer-motion';
 import { Hash, Plus, ChevronDown, MessageSquare, Settings, Copy, Check } from 'lucide-react';
 import { useTeam } from '@/contexts/TeamContext';
 import { usePresence } from '@/hooks/usePresence';
 import { Button } from '@/components/ui/button';
 import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
 import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
 import { CreateChannelDialog } from './CreateChannelDialog';
 import { useTheme } from '@/hooks/useTheme';
 import { Moon, Sun } from 'lucide-react';
 import { toast } from 'sonner';
 
 export const ChannelSidebar = () => {
   const { currentTeam, channels, currentChannel, setCurrentChannel, teamMembers } = useTeam();
   const { isUserOnline } = usePresence(currentTeam?.id || null);
   const { theme, toggleTheme } = useTheme();
   const [channelsOpen, setChannelsOpen] = useState(true);
   const [membersOpen, setMembersOpen] = useState(true);
   const [showCreateChannel, setShowCreateChannel] = useState(false);
   const [copied, setCopied] = useState(false);
 
   const copyInviteCode = async () => {
     if (currentTeam?.invite_code) {
       await navigator.clipboard.writeText(currentTeam.invite_code);
       setCopied(true);
       toast.success('Invite code copied!');
       setTimeout(() => setCopied(false), 2000);
     }
   };
 
   if (!currentTeam) {
     return (
       <div className="w-60 bg-sidebar flex flex-col items-center justify-center text-sidebar-foreground/60">
         <MessageSquare className="w-12 h-12 mb-4 opacity-50" />
         <p className="text-sm">Select or create a team</p>
       </div>
     );
   }
 
   return (
     <div className="w-60 bg-sidebar flex flex-col border-r border-sidebar-border">
       {/* Team Header */}
       <div className="h-14 px-4 flex items-center justify-between border-b border-sidebar-border">
         <h2 className="font-semibold text-sidebar-foreground truncate">{currentTeam.name}</h2>
         <div className="flex items-center gap-1">
           <Button
             variant="ghost"
             size="icon"
             className="h-8 w-8"
             onClick={copyInviteCode}
           >
             {copied ? <Check className="w-4 h-4 text-online" /> : <Copy className="w-4 h-4" />}
           </Button>
           <Button
             variant="ghost"
             size="icon"
             className="h-8 w-8"
             onClick={toggleTheme}
           >
             {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
           </Button>
         </div>
       </div>
 
       <div className="flex-1 overflow-y-auto scrollbar-thin p-2">
         {/* Channels Section */}
         <Collapsible open={channelsOpen} onOpenChange={setChannelsOpen}>
           <div className="flex items-center justify-between px-2 py-1">
             <CollapsibleTrigger className="flex items-center gap-1 text-xs font-medium text-sidebar-foreground/60 hover:text-sidebar-foreground">
               <ChevronDown className={`w-3 h-3 transition-transform ${channelsOpen ? '' : '-rotate-90'}`} />
               CHANNELS
             </CollapsibleTrigger>
             <Button
               variant="ghost"
               size="icon"
               className="h-5 w-5 hover:bg-sidebar-accent"
               onClick={() => setShowCreateChannel(true)}
             >
               <Plus className="w-3 h-3" />
             </Button>
           </div>
           <CollapsibleContent>
             <div className="space-y-0.5">
               {channels.map((channel) => (
                 <motion.button
                   key={channel.id}
                   initial={{ opacity: 0, x: -10 }}
                   animate={{ opacity: 1, x: 0 }}
                   onClick={() => setCurrentChannel(channel)}
                   className={`
                     w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm
                     transition-colors duration-150
                     ${currentChannel?.id === channel.id 
                       ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' 
                       : 'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50'
                     }
                   `}
                 >
                   <Hash className="w-4 h-4 shrink-0" />
                   <span className="truncate">{channel.name}</span>
                 </motion.button>
               ))}
             </div>
           </CollapsibleContent>
         </Collapsible>
 
         {/* Members Section */}
         <Collapsible open={membersOpen} onOpenChange={setMembersOpen} className="mt-4">
           <CollapsibleTrigger className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-sidebar-foreground/60 hover:text-sidebar-foreground">
             <ChevronDown className={`w-3 h-3 transition-transform ${membersOpen ? '' : '-rotate-90'}`} />
             MEMBERS — {teamMembers.length}
           </CollapsibleTrigger>
           <CollapsibleContent>
             <div className="space-y-0.5 mt-1">
               {teamMembers.map((member) => (
                 <div
                   key={member.id}
                   className="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm hover:bg-sidebar-accent/50"
                 >
                   <div className="relative">
                     <Avatar className="h-6 w-6">
                       <AvatarImage src={member.profile?.avatar_url || undefined} />
                       <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                         {member.profile?.username?.substring(0, 2).toUpperCase() || '??'}
                       </AvatarFallback>
                     </Avatar>
                     <span 
                       className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-sidebar
                         ${isUserOnline(member.user_id) ? 'bg-online' : 'bg-offline'}
                       `}
                     />
                   </div>
                   <span className="truncate text-sidebar-foreground/80">
                     {member.profile?.display_name || member.profile?.username}
                   </span>
                   {member.role === 'owner' && (
                     <span className="ml-auto text-xs text-mention">👑</span>
                   )}
                 </div>
               ))}
             </div>
           </CollapsibleContent>
         </Collapsible>
       </div>
 
       <CreateChannelDialog open={showCreateChannel} onOpenChange={setShowCreateChannel} />
     </div>
   );
 };