 import { useState } from 'react';
 import { useTeam } from '@/contexts/TeamContext';
 import { Button } from '@/components/ui/button';
 import { Input } from '@/components/ui/input';
 import { Label } from '@/components/ui/label';
 import { Textarea } from '@/components/ui/textarea';
 import {
   Dialog,
   DialogContent,
   DialogDescription,
   DialogFooter,
   DialogHeader,
   DialogTitle,
 } from '@/components/ui/dialog';
 import { toast } from 'sonner';
 
 interface CreateChannelDialogProps {
   open: boolean;
   onOpenChange: (open: boolean) => void;
 }
 
 export const CreateChannelDialog = ({ open, onOpenChange }: CreateChannelDialogProps) => {
   const { createChannel, setCurrentChannel } = useTeam();
   const [name, setName] = useState('');
   const [description, setDescription] = useState('');
   const [loading, setLoading] = useState(false);
 
   const handleSubmit = async (e: React.FormEvent) => {
     e.preventDefault();
     if (!name.trim()) return;
 
     setLoading(true);
     const channel = await createChannel(name.trim(), description.trim() || undefined);
     setLoading(false);
 
     if (channel) {
       toast.success(`Channel #${channel.name} created!`);
       setCurrentChannel(channel);
       setName('');
       setDescription('');
       onOpenChange(false);
     } else {
       toast.error('Failed to create channel');
     }
   };
 
   return (
     <Dialog open={open} onOpenChange={onOpenChange}>
       <DialogContent className="sm:max-w-md">
         <DialogHeader>
           <DialogTitle>Create a Channel</DialogTitle>
           <DialogDescription>
             Channels are where your team communicates. They're best organized around topics.
           </DialogDescription>
         </DialogHeader>
         <form onSubmit={handleSubmit} className="space-y-4">
           <div className="space-y-2">
             <Label htmlFor="channelName">Channel Name</Label>
             <Input
               id="channelName"
               placeholder="e.g., announcements, random..."
               value={name}
               onChange={(e) => setName(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
               required
             />
           </div>
           <div className="space-y-2">
             <Label htmlFor="channelDesc">Description (optional)</Label>
             <Textarea
               id="channelDesc"
               placeholder="What's this channel about?"
               value={description}
               onChange={(e) => setDescription(e.target.value)}
               rows={2}
             />
           </div>
           <DialogFooter>
             <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
               Cancel
             </Button>
             <Button type="submit" disabled={loading || !name.trim()}>
               {loading ? 'Creating...' : 'Create Channel'}
             </Button>
           </DialogFooter>
         </form>
       </DialogContent>
     </Dialog>
   );
 };