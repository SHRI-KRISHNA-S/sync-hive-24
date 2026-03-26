import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MessageSquare, Loader2, Calendar, Video, Hash, Mail } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { TeamProvider, useTeam } from '@/contexts/TeamContext';
import { TeamSidebar } from '@/components/chat/TeamSidebar';
import { ChannelSidebar } from '@/components/chat/ChannelSidebar';
import { ChatArea } from '@/components/chat/ChatArea';
import { DirectMessageArea } from '@/components/chat/DirectMessageArea';
import { MeetingRoom } from '@/components/chat/MeetingRoom';
import { CalendarTab } from '@/components/chat/CalendarTab';
import { Button } from '@/components/ui/button';
import { CreateTeamDialog } from '@/components/chat/CreateTeamDialog';
import { JoinTeamDialog } from '@/components/chat/JoinTeamDialog';
import { usePresence } from '@/hooks/usePresence';
import { useUnreadDMs } from '@/hooks/useUnreadDMs';
import { Profile } from '@/lib/supabase-types';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type ViewTab = 'chat' | 'meeting' | 'calendar' | 'dm';

const ChatContent = () => {
  const { teams, loading, currentChannel, currentTeam } = useTeam();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showJoinDialog, setShowJoinDialog] = useState(false);
  const [activeTab, setActiveTab] = useState<ViewTab>('chat');
  const [meetingChannelId, setMeetingChannelId] = useState<string | null>(null);
  const [dmTarget, setDmTarget] = useState<Profile | null>(null);
  const { isUserOnline } = usePresence(currentTeam?.id || null);
  const { getUnreadCount, totalUnread, markAsRead } = useUnreadDMs();

  const handleJoinMeeting = (channelId: string) => {
    setMeetingChannelId(channelId);
    setActiveTab('meeting');
  };

  const handleCloseMeeting = () => {
    setMeetingChannelId(null);
    setActiveTab('chat');
  };

  const handleOpenDM = (profile: Profile) => {
    setDmTarget(profile);
    setActiveTab('dm');
  };

  const handleCloseDM = () => {
    setDmTarget(null);
    setActiveTab('chat');
  };

  const handleMarkRead = useCallback(() => {
    if (dmTarget) {
      markAsRead(dmTarget.user_id);
    }
  }, [dmTarget, markAsRead]);

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
          <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Setting up your workspace...</h2>
          <p className="text-muted-foreground mb-8">
            Your personal space is being created. If this takes too long, try creating or joining a team.
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
      <ChannelSidebar onOpenDM={handleOpenDM} getUnreadCount={getUnreadCount} />
      
      {/* Main Content Area with Tabs */}
      <div className="flex-1 flex flex-col">
        {/* Tab Navigation */}
        <div className="h-12 border-b bg-card flex items-center px-4 gap-2">
          <Button
            variant={activeTab === 'chat' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => { setActiveTab('chat'); setDmTarget(null); }}
            className="gap-2"
          >
            <Hash className="w-4 h-4" />
            Chat
          </Button>
          <Button
            variant={activeTab === 'dm' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('dm')}
            className="gap-2 relative"
            disabled={!dmTarget}
          >
            <Mail className="w-4 h-4" />
            DM{dmTarget ? ` — ${dmTarget.display_name || dmTarget.username}` : ''}
            {totalUnread > 0 && activeTab !== 'dm' && (
              <Badge className="ml-1 h-5 min-w-[20px] px-1.5 text-[10px] bg-destructive text-destructive-foreground">
                {totalUnread}
              </Badge>
            )}
          </Button>
          <Button
            variant={activeTab === 'meeting' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => {
              if (currentChannel) {
                setMeetingChannelId(currentChannel.id);
                setActiveTab('meeting');
              }
            }}
            className="gap-2"
            disabled={!currentChannel}
          >
            <Video className="w-4 h-4" />
            Meeting
          </Button>
          <Button
            variant={activeTab === 'calendar' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('calendar')}
            className="gap-2"
          >
            <Calendar className="w-4 h-4" />
            Calendar
          </Button>
        </div>

        {/* Tab Content */}
        {activeTab === 'chat' && <ChatArea />}
        {activeTab === 'dm' && dmTarget && (
          <DirectMessageArea
            otherUser={dmTarget}
            isOnline={isUserOnline(dmTarget.user_id)}
            onBack={handleCloseDM}
            onMarkRead={handleMarkRead}
          />
        )}
        {activeTab === 'meeting' && meetingChannelId && currentChannel && (
          <MeetingRoom
            channelId={meetingChannelId}
            channelName={currentChannel.name}
            onClose={handleCloseMeeting}
          />
        )}
        {activeTab === 'calendar' && <CalendarTab onJoinMeeting={handleJoinMeeting} />}
      </div>
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
