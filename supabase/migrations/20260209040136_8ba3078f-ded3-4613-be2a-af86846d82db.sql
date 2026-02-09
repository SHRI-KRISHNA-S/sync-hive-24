-- Create meetings table for scheduling
CREATE TABLE public.meetings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  channel_id UUID REFERENCES public.channels(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Team members can view meetings" 
ON public.meetings 
FOR SELECT 
USING (is_team_member(auth.uid(), team_id));

CREATE POLICY "Team members can create meetings" 
ON public.meetings 
FOR INSERT 
WITH CHECK (auth.uid() = created_by AND is_team_member(auth.uid(), team_id));

CREATE POLICY "Meeting creator can update" 
ON public.meetings 
FOR UPDATE 
USING (auth.uid() = created_by);

CREATE POLICY "Meeting creator can delete" 
ON public.meetings 
FOR DELETE 
USING (auth.uid() = created_by);

-- Create trigger for updated_at
CREATE TRIGGER update_meetings_updated_at
BEFORE UPDATE ON public.meetings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for meetings
ALTER PUBLICATION supabase_realtime ADD TABLE public.meetings;