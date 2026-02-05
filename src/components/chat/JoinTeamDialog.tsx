 import { useState } from 'react';
 import { useTeam } from '@/contexts/TeamContext';
 import { Button } from '@/components/ui/button';
 import { Input } from '@/components/ui/input';
 import { Label } from '@/components/ui/label';
 import {
   Dialog,
   DialogContent,
   DialogDescription,
   DialogFooter,
   DialogHeader,
   DialogTitle,
 } from '@/components/ui/dialog';
 import { toast } from 'sonner';
 
 interface JoinTeamDialogProps {
   open: boolean;
   onOpenChange: (open: boolean) => void;
 }
 
 export const JoinTeamDialog = ({ open, onOpenChange }: JoinTeamDialogProps) => {
   const { joinTeam } = useTeam();
   const [inviteCode, setInviteCode] = useState('');
   const [loading, setLoading] = useState(false);
 
   const handleSubmit = async (e: React.FormEvent) => {
     e.preventDefault();
     if (!inviteCode.trim()) return;
 
     setLoading(true);
     const success = await joinTeam(inviteCode.trim());
     setLoading(false);
 
     if (success) {
       toast.success('Successfully joined the team!');
       setInviteCode('');
       onOpenChange(false);
     } else {
       toast.error('Invalid invite code or already a member');
     }
   };
 
   return (
     <Dialog open={open} onOpenChange={onOpenChange}>
       <DialogContent className="sm:max-w-md">
         <DialogHeader>
           <DialogTitle>Join a Team</DialogTitle>
           <DialogDescription>
             Enter the invite code shared by your team admin.
           </DialogDescription>
         </DialogHeader>
         <form onSubmit={handleSubmit} className="space-y-4">
           <div className="space-y-2">
             <Label htmlFor="inviteCode">Invite Code</Label>
             <Input
               id="inviteCode"
               placeholder="Enter invite code..."
               value={inviteCode}
               onChange={(e) => setInviteCode(e.target.value)}
               required
             />
           </div>
           <DialogFooter>
             <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
               Cancel
             </Button>
             <Button type="submit" disabled={loading || !inviteCode.trim()}>
               {loading ? 'Joining...' : 'Join Team'}
             </Button>
           </DialogFooter>
         </form>
       </DialogContent>
     </Dialog>
   );
 };