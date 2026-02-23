import { useState } from 'react';
import { User, Settings, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from 'sonner';

export const UserProfilePanel = () => {
  const { profile, updateProfile, user } = useAuth();
  const [open, setOpen] = useState(false);
  const [displayName, setDisplayName] = useState(profile?.display_name || '');
  const [username, setUsername] = useState(profile?.username || '');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || '');
  const [saving, setSaving] = useState(false);

  const handleOpen = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      setDisplayName(profile?.display_name || '');
      setUsername(profile?.username || '');
      setAvatarUrl(profile?.avatar_url || '');
    }
  };

  const handleSave = async () => {
    if (!username.trim()) {
      toast.error('Username is required');
      return;
    }
    setSaving(true);
    try {
      await updateProfile({
        display_name: displayName.trim() || null,
        username: username.trim(),
        avatar_url: avatarUrl.trim() || null,
      });
      toast.success('Profile updated');
      setOpen(false);
    } catch {
      toast.error('Failed to update profile');
    }
    setSaving(false);
  };

  return (
    <div className="h-14 px-3 flex items-center gap-2 border-t border-sidebar-border bg-sidebar">
      <Popover open={open} onOpenChange={handleOpen}>
        <PopoverTrigger asChild>
          <button className="flex items-center gap-2 flex-1 min-w-0 rounded-md px-2 py-1.5 hover:bg-sidebar-accent/50 transition-colors">
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarImage src={profile?.avatar_url || undefined} />
              <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                {profile?.username?.substring(0, 2).toUpperCase() || '??'}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col items-start min-w-0">
              <span className="text-sm font-medium text-sidebar-foreground truncate w-full">
                {profile?.display_name || profile?.username}
              </span>
              <span className="text-xs text-sidebar-foreground/50 truncate w-full">
                {user?.email}
              </span>
            </div>
            <Settings className="w-4 h-4 shrink-0 text-sidebar-foreground/50 ml-auto" />
          </button>
        </PopoverTrigger>
        <PopoverContent side="top" align="start" className="w-72 p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm">Edit Profile</h3>
          </div>
          <div className="space-y-3">
            <div className="flex justify-center">
              <Avatar className="h-16 w-16">
                <AvatarImage src={avatarUrl || undefined} />
                <AvatarFallback className="text-lg bg-primary text-primary-foreground">
                  {username?.substring(0, 2).toUpperCase() || '??'}
                </AvatarFallback>
              </Avatar>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="display-name" className="text-xs">Display Name</Label>
              <Input
                id="display-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your display name"
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="username" className="text-xs">Username</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="username"
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="avatar-url" className="text-xs">Avatar URL</Label>
              <Input
                id="avatar-url"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://..."
                className="h-8 text-sm"
              />
            </div>
            <Button onClick={handleSave} disabled={saving} size="sm" className="w-full">
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};
