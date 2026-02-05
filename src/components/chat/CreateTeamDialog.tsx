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
 
 interface CreateTeamDialogProps {
   open: boolean;
   onOpenChange: (open: boolean) => void;
 }
 
 export const CreateTeamDialog = ({ open, onOpenChange }: CreateTeamDialogProps) => {
   const { createTeam } = useTeam();
   const [name, setName] = useState('');
   const [description, setDescription] = useState('');
   const [loading, setLoading] = useState(false);
 
   const handleSubmit = async (e: React.FormEvent) => {
     e.preventDefault();
     if (!name.trim()) return;
 
     setLoading(true);
     const team = await createTeam(name.trim(), description.trim() || undefined);
     setLoading(false);
 
     if (team) {
       toast.success(`Team "${team.name}" created!`);
       setName('');
       setDescription('');
       onOpenChange(false);
     } else {
       toast.error('Failed to create team');
     }
   };
 
   return (
     <Dialog open={open} onOpenChange={onOpenChange}>
       <DialogContent className="sm:max-w-md">
         <DialogHeader>
           <DialogTitle>Create a Team</DialogTitle>
           <DialogDescription>
             Create a new workspace for your team to collaborate.
           </DialogDescription>
         </DialogHeader>
         <form onSubmit={handleSubmit} className="space-y-4">
           <div className="space-y-2">
             <Label htmlFor="name">Team Name</Label>
             <Input
               id="name"
               placeholder="e.g., Engineering, Marketing..."
               value={name}
               onChange={(e) => setName(e.target.value)}
               required
             />
           </div>
           <div className="space-y-2">
             <Label htmlFor="description">Description (optional)</Label>
             <Textarea
               id="description"
               placeholder="What's this team about?"
               value={description}
               onChange={(e) => setDescription(e.target.value)}
               rows={3}
             />
           </div>
           <DialogFooter>
             <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
               Cancel
             </Button>
             <Button type="submit" disabled={loading || !name.trim()}>
               {loading ? 'Creating...' : 'Create Team'}
             </Button>
           </DialogFooter>
         </form>
       </DialogContent>
     </Dialog>
   );
 };