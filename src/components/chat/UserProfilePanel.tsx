import { useState, useRef } from 'react';
import { Settings, Camera, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
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
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleOpen = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      setDisplayName(profile?.display_name || '');
      setUsername(profile?.username || '');
      setAvatarUrl(profile?.avatar_url || '');
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be less than 2MB');
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `${user.id}/avatar.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // Add cache-busting param
      const url = `${publicUrl}?t=${Date.now()}`;
      setAvatarUrl(url);
      toast.success('Avatar uploaded!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to upload avatar');
    }
    setUploading(false);
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
        <PopoverContent side="top" align="start" className="w-80 p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm">Edit Profile</h3>
          </div>
          <div className="space-y-4">
            {/* Avatar upload */}
            <div className="flex justify-center">
              <div className="relative group">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={avatarUrl || undefined} />
                  <AvatarFallback className="text-xl bg-primary text-primary-foreground">
                    {username?.substring(0, 2).toUpperCase() || '??'}
                  </AvatarFallback>
                </Avatar>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="absolute inset-0 rounded-full bg-foreground/0 group-hover:bg-foreground/40 flex items-center justify-center transition-colors cursor-pointer"
                >
                  {uploading ? (
                    <Loader2 className="w-5 h-5 text-primary-foreground animate-spin" />
                  ) : (
                    <Camera className="w-5 h-5 text-primary-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  )}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  className="hidden"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground text-center -mt-2">Click to upload avatar</p>

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
            <Button onClick={handleSave} disabled={saving || uploading} size="sm" className="w-full">
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};
