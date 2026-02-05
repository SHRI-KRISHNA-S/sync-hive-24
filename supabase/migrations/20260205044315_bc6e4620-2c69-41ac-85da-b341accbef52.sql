-- Create app role enum for team membership
CREATE TYPE public.team_role AS ENUM ('owner', 'admin', 'member');

-- Create profiles table for user information
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  username TEXT NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  status TEXT DEFAULT 'offline',
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create teams table
CREATE TABLE public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  icon_url TEXT,
  invite_code TEXT UNIQUE DEFAULT encode(gen_random_bytes(6), 'hex'),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create team_members junction table with roles
CREATE TABLE public.team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role team_role NOT NULL DEFAULT 'member',
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(team_id, user_id)
);

-- Create channels table
CREATE TABLE public.channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_private BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create messages table
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID REFERENCES public.channels(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,
  content TEXT NOT NULL,
  has_attachments BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create direct_messages table
CREATE TABLE public.direct_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,
  receiver_id UUID REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,
  content TEXT NOT NULL,
  has_attachments BOOLEAN DEFAULT false,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create attachments table
CREATE TABLE public.attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES public.messages(id) ON DELETE CASCADE,
  dm_id UUID REFERENCES public.direct_messages(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT attachment_has_parent CHECK (message_id IS NOT NULL OR dm_id IS NOT NULL)
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;

-- Helper function to check team membership
CREATE OR REPLACE FUNCTION public.is_team_member(_user_id UUID, _team_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE user_id = _user_id AND team_id = _team_id
  )
$$;

-- Helper function to get user's team role
CREATE OR REPLACE FUNCTION public.get_team_role(_user_id UUID, _team_id UUID)
RETURNS team_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.team_members
  WHERE user_id = _user_id AND team_id = _team_id
$$;

-- Profiles policies
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Teams policies
CREATE POLICY "Team members can view their teams" ON public.teams 
FOR SELECT USING (public.is_team_member(auth.uid(), id));
CREATE POLICY "Authenticated users can create teams" ON public.teams 
FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Team admins/owners can update teams" ON public.teams 
FOR UPDATE USING (public.get_team_role(auth.uid(), id) IN ('owner', 'admin'));
CREATE POLICY "Team owners can delete teams" ON public.teams 
FOR DELETE USING (public.get_team_role(auth.uid(), id) = 'owner');

-- Team members policies
CREATE POLICY "Team members can view membership" ON public.team_members 
FOR SELECT USING (public.is_team_member(auth.uid(), team_id));
CREATE POLICY "Users can insert themselves via invite" ON public.team_members 
FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can manage members" ON public.team_members 
FOR DELETE USING (public.get_team_role(auth.uid(), team_id) IN ('owner', 'admin'));

-- Channels policies
CREATE POLICY "Team members can view channels" ON public.channels 
FOR SELECT USING (public.is_team_member(auth.uid(), team_id));
CREATE POLICY "Admins can create channels" ON public.channels 
FOR INSERT WITH CHECK (public.get_team_role(auth.uid(), team_id) IN ('owner', 'admin', 'member'));
CREATE POLICY "Admins can update channels" ON public.channels 
FOR UPDATE USING (public.get_team_role(auth.uid(), team_id) IN ('owner', 'admin'));
CREATE POLICY "Admins can delete channels" ON public.channels 
FOR DELETE USING (public.get_team_role(auth.uid(), team_id) IN ('owner', 'admin'));

-- Messages policies
CREATE POLICY "Team members can view messages" ON public.messages 
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.channels c
    WHERE c.id = channel_id AND public.is_team_member(auth.uid(), c.team_id)
  )
);
CREATE POLICY "Team members can send messages" ON public.messages 
FOR INSERT WITH CHECK (
  auth.uid() = user_id AND
  EXISTS (
    SELECT 1 FROM public.channels c
    WHERE c.id = channel_id AND public.is_team_member(auth.uid(), c.team_id)
  )
);
CREATE POLICY "Users can update their own messages" ON public.messages 
FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own messages" ON public.messages 
FOR DELETE USING (auth.uid() = user_id);

-- Direct messages policies
CREATE POLICY "Users can view their DMs" ON public.direct_messages 
FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
CREATE POLICY "Users can send DMs" ON public.direct_messages 
FOR INSERT WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "Users can delete their sent DMs" ON public.direct_messages 
FOR DELETE USING (auth.uid() = sender_id);

-- Attachments policies
CREATE POLICY "Users can view attachments in their messages" ON public.attachments 
FOR SELECT USING (
  (message_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.messages m
    JOIN public.channels c ON c.id = m.channel_id
    WHERE m.id = message_id AND public.is_team_member(auth.uid(), c.team_id)
  ))
  OR
  (dm_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.direct_messages dm
    WHERE dm.id = dm_id AND (auth.uid() = dm.sender_id OR auth.uid() = dm.receiver_id)
  ))
);
CREATE POLICY "Users can create attachments" ON public.attachments 
FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Create function to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, username, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger for auto profile creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Add update triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON public.teams FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_channels_updated_at BEFORE UPDATE ON public.channels FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_messages_updated_at BEFORE UPDATE ON public.messages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for messages, direct_messages, and profiles (for presence)
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;

-- Create indexes for better performance
CREATE INDEX idx_messages_channel_id ON public.messages(channel_id);
CREATE INDEX idx_messages_created_at ON public.messages(created_at DESC);
CREATE INDEX idx_direct_messages_participants ON public.direct_messages(sender_id, receiver_id);
CREATE INDEX idx_team_members_user_id ON public.team_members(user_id);
CREATE INDEX idx_channels_team_id ON public.channels(team_id);
CREATE INDEX idx_teams_invite_code ON public.teams(invite_code);