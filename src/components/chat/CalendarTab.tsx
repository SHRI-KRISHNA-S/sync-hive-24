import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, Plus, Clock, Users, Video, Trash2, Edit2 } from 'lucide-react';
import { format, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, addMonths, subMonths } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTeam } from '@/contexts/TeamContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Meeting {
  id: string;
  team_id: string;
  channel_id: string | null;
  title: string;
  description: string | null;
  scheduled_at: string;
  duration_minutes: number;
  created_by: string;
  created_at: string;
}

interface CalendarTabProps {
  onJoinMeeting?: (channelId: string) => void;
}

export const CalendarTab = ({ onJoinMeeting }: CalendarTabProps) => {
  const { user } = useAuth();
  const { currentTeam, currentChannel } = useTeam();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    date: new Date(),
    time: '10:00',
    duration: 30,
  });

  useEffect(() => {
    if (currentTeam) {
      fetchMeetings();
      
      // Subscribe to realtime updates
      const channel = supabase
        .channel('meetings-changes')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'meetings',
          filter: `team_id=eq.${currentTeam.id}`,
        }, () => {
          fetchMeetings();
        })
        .subscribe();
      
      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [currentTeam]);

  const fetchMeetings = async () => {
    if (!currentTeam) return;
    
    const { data, error } = await supabase
      .from('meetings')
      .select('*')
      .eq('team_id', currentTeam.id)
      .order('scheduled_at', { ascending: true });
    
    if (error) {
      console.error('Error fetching meetings:', error);
    } else {
      setMeetings(data || []);
    }
    setLoading(false);
  };

  const createMeeting = async () => {
    if (!currentTeam || !user) return;
    
    const scheduledAt = new Date(formData.date);
    const [hours, minutes] = formData.time.split(':');
    scheduledAt.setHours(parseInt(hours), parseInt(minutes));
    
    const { error } = await supabase
      .from('meetings')
      .insert({
        team_id: currentTeam.id,
        channel_id: currentChannel?.id || null,
        title: formData.title,
        description: formData.description || null,
        scheduled_at: scheduledAt.toISOString(),
        duration_minutes: formData.duration,
        created_by: user.id,
      });
    
    if (error) {
      toast.error('Failed to create meeting');
      console.error(error);
    } else {
      toast.success('Meeting scheduled!');
      setShowCreateDialog(false);
      setFormData({ title: '', description: '', date: new Date(), time: '10:00', duration: 30 });
      fetchMeetings();
    }
  };

  const deleteMeeting = async (meetingId: string) => {
    const { error } = await supabase
      .from('meetings')
      .delete()
      .eq('id', meetingId);
    
    if (error) {
      toast.error('Failed to delete meeting');
    } else {
      toast.success('Meeting deleted');
      fetchMeetings();
    }
  };

  const getMeetingsForDate = (date: Date) => {
    return meetings.filter(m => isSameDay(new Date(m.scheduled_at), date));
  };

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const selectedDateMeetings = getMeetingsForDate(selectedDate);

  return (
    <div className="flex-1 flex bg-background overflow-hidden">
      {/* Calendar Grid */}
      <div className="flex-1 p-6 overflow-auto">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold">Team Calendar</h1>
              <p className="text-muted-foreground">Schedule and manage meetings</p>
            </div>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Schedule Meeting
            </Button>
          </div>

          {/* Month Navigation */}
          <div className="flex items-center justify-between mb-4">
            <Button variant="ghost" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
              ← Previous
            </Button>
            <h2 className="text-xl font-semibold">{format(currentMonth, 'MMMM yyyy')}</h2>
            <Button variant="ghost" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
              Next →
            </Button>
          </div>

          {/* Calendar Grid */}
          <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
            {/* Week Headers */}
            <div className="grid grid-cols-7 bg-muted/50">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <div key={day} className="p-3 text-center text-sm font-medium text-muted-foreground">
                  {day}
                </div>
              ))}
            </div>

            {/* Days */}
            <div className="grid grid-cols-7">
              {calendarDays.map((day, idx) => {
                const dayMeetings = getMeetingsForDate(day);
                const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
                const isToday = isSameDay(day, new Date());
                const isSelected = isSameDay(day, selectedDate);

                return (
                  <motion.button
                    key={idx}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setSelectedDate(day)}
                    className={cn(
                      "min-h-[80px] p-2 border-t border-r text-left transition-colors",
                      "hover:bg-accent/50",
                      !isCurrentMonth && "bg-muted/30 text-muted-foreground",
                      isSelected && "bg-primary/10 ring-2 ring-primary ring-inset",
                      isToday && "bg-primary/5"
                    )}
                  >
                    <span className={cn(
                      "inline-flex items-center justify-center w-7 h-7 rounded-full text-sm",
                      isToday && "bg-primary text-primary-foreground font-bold"
                    )}>
                      {format(day, 'd')}
                    </span>
                    {dayMeetings.length > 0 && (
                      <div className="mt-1 space-y-1">
                        {dayMeetings.slice(0, 2).map((meeting) => (
                          <div
                            key={meeting.id}
                            className="text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded truncate"
                          >
                            {format(new Date(meeting.scheduled_at), 'HH:mm')} {meeting.title}
                          </div>
                        ))}
                        {dayMeetings.length > 2 && (
                          <div className="text-xs text-muted-foreground">
                            +{dayMeetings.length - 2} more
                          </div>
                        )}
                      </div>
                    )}
                  </motion.button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Selected Date Panel */}
      <div className="w-80 border-l bg-card p-4 overflow-auto">
        <h3 className="font-semibold mb-4">
          {format(selectedDate, 'EEEE, MMMM d')}
        </h3>
        
        {selectedDateMeetings.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Calendar className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No meetings scheduled</p>
            <Button
              variant="link"
              className="mt-2"
              onClick={() => {
                setFormData(prev => ({ ...prev, date: selectedDate }));
                setShowCreateDialog(true);
              }}
            >
              Schedule one
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence>
              {selectedDateMeetings.map((meeting) => (
                <motion.div
                  key={meeting.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium truncate">{meeting.title}</h4>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                            <Clock className="w-3 h-3" />
                            {format(new Date(meeting.scheduled_at), 'HH:mm')}
                            <span>({meeting.duration_minutes}m)</span>
                          </div>
                          {meeting.description && (
                            <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                              {meeting.description}
                            </p>
                          )}
                        </div>
                        {meeting.created_by === user?.id && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => deleteMeeting(meeting.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                      {meeting.channel_id && onJoinMeeting && (
                        <Button
                          className="w-full mt-3"
                          size="sm"
                          onClick={() => onJoinMeeting(meeting.channel_id!)}
                        >
                          <Video className="w-4 h-4 mr-2" />
                          Join Meeting
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Create Meeting Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule a Meeting</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                placeholder="Meeting title"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                placeholder="What's this meeting about?"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start">
                      <Calendar className="w-4 h-4 mr-2" />
                      {format(formData.date, 'MMM d, yyyy')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarPicker
                      mode="single"
                      selected={formData.date}
                      onSelect={(date) => date && setFormData(prev => ({ ...prev, date }))}
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label htmlFor="time">Time</Label>
                <Input
                  id="time"
                  type="time"
                  value={formData.time}
                  onChange={(e) => setFormData(prev => ({ ...prev, time: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="duration">Duration (minutes)</Label>
              <Input
                id="duration"
                type="number"
                min={15}
                max={480}
                value={formData.duration}
                onChange={(e) => setFormData(prev => ({ ...prev, duration: parseInt(e.target.value) || 30 }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={createMeeting} disabled={!formData.title}>
              Schedule Meeting
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
