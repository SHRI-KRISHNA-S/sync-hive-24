import { useState, useEffect } from 'react';
import { useTeam } from '@/contexts/TeamContext';
import { Channel } from '@/lib/supabase-types';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

interface ChannelSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channel: Channel;
}

export const ChannelSettingsDialog = ({ open, onOpenChange, channel }: ChannelSettingsDialogProps) => {
  const { setCurrentChannel, updateChannelInList } = useTeam();
  const [name, setName] = useState(channel.name);
  const [isPrivate, setIsPrivate] = useState(channel.is_private);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setName(channel.name);
    setIsPrivate(channel.is_private);
  }, [channel]);

  const handleSave = async () => {
    const trimmed = name.trim().toLowerCase().replace(/\s+/g, '-');
    if (!trimmed) return;

    setLoading(true);
    const { data, error } = await supabase
      .from('channels')
      .update({ name: trimmed, is_private: isPrivate })
      .eq('id', channel.id)
      .select()
      .single();

    setLoading(false);

    if (error) {
      toast.error('Failed to update channel');
      return;
    }

    if (data) {
      const updated = data as Channel;
      setCurrentChannel(updated);
      updateChannelInList(updated);
      toast.success('Channel updated!');
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Channel Settings</DialogTitle>
          <DialogDescription>
            Rename this channel or change its privacy setting.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="channelRename">Channel Name</Label>
            <Input
              id="channelRename"
              value={name}
              onChange={(e) => setName(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
              placeholder="channel-name"
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>Private Channel</Label>
              <p className="text-xs text-muted-foreground">Only invited members can see this channel</p>
            </div>
            <Switch checked={isPrivate} onCheckedChange={setIsPrivate} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={loading || !name.trim()}>
            {loading ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
