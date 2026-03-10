
-- Fix: Convert all RESTRICTIVE RLS policies to PERMISSIVE (default)
-- RESTRICTIVE policies can only narrow access granted by PERMISSIVE policies.
-- With no PERMISSIVE policies, no rows are accessible at all.

-- ============ PROFILES ============
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Team members can view profiles" ON public.profiles;

CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE TO public USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT TO public WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Team members can view profiles" ON public.profiles FOR SELECT TO public USING (
  (auth.uid() = user_id) OR (EXISTS (
    SELECT 1 FROM team_members tm1 JOIN team_members tm2 ON (tm1.team_id = tm2.team_id)
    WHERE tm1.user_id = auth.uid() AND tm2.user_id = profiles.user_id
  ))
);

-- ============ TEAMS ============
DROP POLICY IF EXISTS "Team members can view their teams" ON public.teams;
DROP POLICY IF EXISTS "Team admins/owners can update teams" ON public.teams;
DROP POLICY IF EXISTS "Team owners can delete teams" ON public.teams;
DROP POLICY IF EXISTS "Authenticated users can create teams" ON public.teams;

CREATE POLICY "Team members can view their teams" ON public.teams FOR SELECT TO public USING (is_team_member(auth.uid(), id));
CREATE POLICY "Team admins/owners can update teams" ON public.teams FOR UPDATE TO public USING (get_team_role(auth.uid(), id) IN ('owner', 'admin'));
CREATE POLICY "Team owners can delete teams" ON public.teams FOR DELETE TO public USING (get_team_role(auth.uid(), id) = 'owner');
CREATE POLICY "Authenticated users can create teams" ON public.teams FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

-- ============ TEAM_MEMBERS ============
DROP POLICY IF EXISTS "Team members can view membership" ON public.team_members;
DROP POLICY IF EXISTS "Admins can manage members" ON public.team_members;
DROP POLICY IF EXISTS "Users can insert themselves as member only" ON public.team_members;

CREATE POLICY "Team members can view membership" ON public.team_members FOR SELECT TO public USING (is_team_member(auth.uid(), team_id));
CREATE POLICY "Admins can manage members" ON public.team_members FOR DELETE TO public USING (get_team_role(auth.uid(), team_id) IN ('owner', 'admin'));
CREATE POLICY "Users can insert themselves as member only" ON public.team_members FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND role = 'member');

-- ============ CHANNELS ============
DROP POLICY IF EXISTS "Team members can view channels" ON public.channels;
DROP POLICY IF EXISTS "Admins can create channels" ON public.channels;
DROP POLICY IF EXISTS "Admins can update channels" ON public.channels;
DROP POLICY IF EXISTS "Admins can delete channels" ON public.channels;

CREATE POLICY "Team members can view channels" ON public.channels FOR SELECT TO authenticated USING (
  is_team_member(auth.uid(), team_id) AND (
    is_private IS NOT TRUE
    OR EXISTS (SELECT 1 FROM channel_members cm WHERE cm.channel_id = channels.id AND cm.user_id = auth.uid())
    OR get_team_role(auth.uid(), team_id) IN ('owner', 'admin')
  )
);
CREATE POLICY "Admins can create channels" ON public.channels FOR INSERT TO public WITH CHECK (get_team_role(auth.uid(), team_id) IN ('owner', 'admin', 'member'));
CREATE POLICY "Admins can update channels" ON public.channels FOR UPDATE TO public USING (get_team_role(auth.uid(), team_id) IN ('owner', 'admin'));
CREATE POLICY "Admins can delete channels" ON public.channels FOR DELETE TO public USING (get_team_role(auth.uid(), team_id) IN ('owner', 'admin'));

-- ============ MESSAGES ============
DROP POLICY IF EXISTS "Team members can view messages" ON public.messages;
DROP POLICY IF EXISTS "Team members can send messages" ON public.messages;
DROP POLICY IF EXISTS "Users can update their own messages" ON public.messages;
DROP POLICY IF EXISTS "Users can delete their own messages" ON public.messages;

CREATE POLICY "Team members can view messages" ON public.messages FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM channels c WHERE c.id = messages.channel_id
    AND is_team_member(auth.uid(), c.team_id)
    AND (c.is_private IS NOT TRUE
      OR EXISTS (SELECT 1 FROM channel_members cm WHERE cm.channel_id = c.id AND cm.user_id = auth.uid())
      OR get_team_role(auth.uid(), c.team_id) IN ('owner', 'admin'))
  )
);
CREATE POLICY "Team members can send messages" ON public.messages FOR INSERT TO public WITH CHECK (
  auth.uid() = user_id AND EXISTS (SELECT 1 FROM channels c WHERE c.id = messages.channel_id AND is_team_member(auth.uid(), c.team_id))
);
CREATE POLICY "Users can update their own messages" ON public.messages FOR UPDATE TO public USING (
  auth.uid() = user_id AND EXISTS (SELECT 1 FROM channels c WHERE c.id = messages.channel_id AND is_team_member(auth.uid(), c.team_id))
);
CREATE POLICY "Users can delete their own messages" ON public.messages FOR DELETE TO public USING (
  auth.uid() = user_id AND EXISTS (SELECT 1 FROM channels c WHERE c.id = messages.channel_id AND is_team_member(auth.uid(), c.team_id))
);

-- ============ DIRECT_MESSAGES ============
DROP POLICY IF EXISTS "Users can view their DMs" ON public.direct_messages;
DROP POLICY IF EXISTS "Users can send DMs" ON public.direct_messages;
DROP POLICY IF EXISTS "Users can delete their sent DMs" ON public.direct_messages;
DROP POLICY IF EXISTS "Receivers can mark DMs as read" ON public.direct_messages;

CREATE POLICY "Users can view their DMs" ON public.direct_messages FOR SELECT TO public USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
CREATE POLICY "Users can send DMs" ON public.direct_messages FOR INSERT TO public WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "Users can delete their sent DMs" ON public.direct_messages FOR DELETE TO public USING (auth.uid() = sender_id);
CREATE POLICY "Receivers can mark DMs as read" ON public.direct_messages FOR UPDATE TO authenticated USING (auth.uid() = receiver_id) WITH CHECK (auth.uid() = receiver_id);

-- ============ ATTACHMENTS ============
DROP POLICY IF EXISTS "Users can view attachments in their messages" ON public.attachments;
DROP POLICY IF EXISTS "Users can create attachments for their messages" ON public.attachments;
DROP POLICY IF EXISTS "Users can delete attachments from their messages" ON public.attachments;

CREATE POLICY "Users can view attachments in their messages" ON public.attachments FOR SELECT TO public USING (
  (message_id IS NOT NULL AND EXISTS (SELECT 1 FROM messages m JOIN channels c ON c.id = m.channel_id WHERE m.id = attachments.message_id AND is_team_member(auth.uid(), c.team_id)))
  OR (dm_id IS NOT NULL AND EXISTS (SELECT 1 FROM direct_messages dm WHERE dm.id = attachments.dm_id AND (auth.uid() = dm.sender_id OR auth.uid() = dm.receiver_id)))
);
CREATE POLICY "Users can create attachments for their messages" ON public.attachments FOR INSERT TO public WITH CHECK (
  auth.uid() IS NOT NULL AND (
    (message_id IS NOT NULL AND EXISTS (SELECT 1 FROM messages m JOIN channels c ON c.id = m.channel_id WHERE m.id = attachments.message_id AND m.user_id = auth.uid() AND is_team_member(auth.uid(), c.team_id)))
    OR (dm_id IS NOT NULL AND EXISTS (SELECT 1 FROM direct_messages dm WHERE dm.id = attachments.dm_id AND auth.uid() = dm.sender_id))
  )
);
CREATE POLICY "Users can delete attachments from their messages" ON public.attachments FOR DELETE TO public USING (
  (message_id IS NOT NULL AND EXISTS (SELECT 1 FROM messages m WHERE m.id = attachments.message_id AND m.user_id = auth.uid()))
  OR (dm_id IS NOT NULL AND EXISTS (SELECT 1 FROM direct_messages dm WHERE dm.id = attachments.dm_id AND dm.sender_id = auth.uid()))
);

-- ============ REACTIONS ============
DROP POLICY IF EXISTS "Team members can view message reactions" ON public.reactions;
DROP POLICY IF EXISTS "Users can add reactions" ON public.reactions;
DROP POLICY IF EXISTS "Users can remove own reactions" ON public.reactions;

CREATE POLICY "Team members can view message reactions" ON public.reactions FOR SELECT TO authenticated USING (
  (message_id IS NOT NULL AND EXISTS (SELECT 1 FROM messages m JOIN channels c ON c.id = m.channel_id WHERE m.id = reactions.message_id AND is_team_member(auth.uid(), c.team_id)))
  OR (dm_id IS NOT NULL AND EXISTS (SELECT 1 FROM direct_messages dm WHERE dm.id = reactions.dm_id AND (auth.uid() = dm.sender_id OR auth.uid() = dm.receiver_id)))
);
CREATE POLICY "Users can add reactions" ON public.reactions FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = user_id AND (
    (message_id IS NOT NULL AND EXISTS (SELECT 1 FROM messages m JOIN channels c ON c.id = m.channel_id WHERE m.id = reactions.message_id AND is_team_member(auth.uid(), c.team_id)))
    OR (dm_id IS NOT NULL AND EXISTS (SELECT 1 FROM direct_messages dm WHERE dm.id = reactions.dm_id AND (auth.uid() = dm.sender_id OR auth.uid() = dm.receiver_id)))
  )
);
CREATE POLICY "Users can remove own reactions" ON public.reactions FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============ CHANNEL_MEMBERS ============
DROP POLICY IF EXISTS "Team members can view channel members" ON public.channel_members;
DROP POLICY IF EXISTS "Admins can manage channel members" ON public.channel_members;
DROP POLICY IF EXISTS "Admins can remove channel members" ON public.channel_members;

CREATE POLICY "Team members can view channel members" ON public.channel_members FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM channels c WHERE c.id = channel_members.channel_id AND is_team_member(auth.uid(), c.team_id))
);
CREATE POLICY "Admins can manage channel members" ON public.channel_members FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM channels c WHERE c.id = channel_members.channel_id AND get_team_role(auth.uid(), c.team_id) IN ('owner', 'admin'))
);
CREATE POLICY "Admins can remove channel members" ON public.channel_members FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM channels c WHERE c.id = channel_members.channel_id AND get_team_role(auth.uid(), c.team_id) IN ('owner', 'admin'))
);

-- ============ MEETINGS ============
DROP POLICY IF EXISTS "Team members can view meetings" ON public.meetings;
DROP POLICY IF EXISTS "Team members can create meetings" ON public.meetings;
DROP POLICY IF EXISTS "Meeting creator can update" ON public.meetings;
DROP POLICY IF EXISTS "Meeting creator can delete" ON public.meetings;

CREATE POLICY "Team members can view meetings" ON public.meetings FOR SELECT TO public USING (is_team_member(auth.uid(), team_id));
CREATE POLICY "Team members can create meetings" ON public.meetings FOR INSERT TO public WITH CHECK (auth.uid() = created_by AND is_team_member(auth.uid(), team_id));
CREATE POLICY "Meeting creator can update" ON public.meetings FOR UPDATE TO public USING (auth.uid() = created_by);
CREATE POLICY "Meeting creator can delete" ON public.meetings FOR DELETE TO public USING (auth.uid() = created_by);
