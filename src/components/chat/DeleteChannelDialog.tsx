import { useState } from 'react';
import { useTeam } from '@/contexts/TeamContext';
import { Channel } from '@/lib/supabase-types';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface DeleteChannelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channel: Channel;
}

export const DeleteChannelDialog = ({ open, onOpenChange, channel }: DeleteChannelDialogProps) => {
  const { channels, setCurrentChannel, deleteChannelFromList } = useTeam();
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);

    // Delete attachments, messages, then the channel
    const { error: attErr } = await supabase
      .from('attachments')
      .delete()
      .in('message_id', 
        (await supabase.from('messages').select('id').eq('channel_id', channel.id)).data?.map(m => m.id) || []
      );

    await supabase.from('messages').delete().eq('channel_id', channel.id);
    await supabase.from('meetings').delete().eq('channel_id', channel.id);

    const { error } = await supabase
      .from('channels')
      .delete()
      .eq('id', channel.id);

    setDeleting(false);

    if (error) {
      toast.error('Failed to delete channel');
      return;
    }

    deleteChannelFromList(channel.id);

    // Switch to another channel
    const remaining = channels.filter(c => c.id !== channel.id);
    setCurrentChannel(remaining.length > 0 ? remaining[0] : null);

    toast.success('Channel deleted');
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete #{channel.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete this channel and all its messages. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={deleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleting ? 'Deleting...' : 'Delete Channel'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
