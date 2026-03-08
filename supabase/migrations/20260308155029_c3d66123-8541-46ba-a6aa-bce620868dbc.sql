
-- 1. Fix PRIVILEGE_ESCALATION: Restrict team_members INSERT to role='member' only
DROP POLICY IF EXISTS "Users can insert themselves via invite" ON public.team_members;

CREATE POLICY "Users can insert themselves as member only"
ON public.team_members FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND role = 'member'
);

-- 2. Fix private channels: Add channel_members table for private channel access control
CREATE TABLE IF NOT EXISTS public.channel_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  added_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(channel_id, user_id)
);

ALTER TABLE public.channel_members ENABLE ROW LEVEL SECURITY;

-- Channel members can view membership
CREATE POLICY "Team members can view channel members"
ON public.channel_members FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM channels c
    WHERE c.id = channel_members.channel_id
    AND is_team_member(auth.uid(), c.team_id)
  )
);

-- Admins/owners can manage channel members
CREATE POLICY "Admins can manage channel members"
ON public.channel_members FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM channels c
    WHERE c.id = channel_members.channel_id
    AND get_team_role(auth.uid(), c.team_id) IN ('owner', 'admin')
  )
);

CREATE POLICY "Admins can remove channel members"
ON public.channel_members FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM channels c
    WHERE c.id = channel_members.channel_id
    AND get_team_role(auth.uid(), c.team_id) IN ('owner', 'admin')
  )
);

-- 3. Update channels SELECT policy to respect is_private flag
DROP POLICY IF EXISTS "Team members can view channels" ON public.channels;

CREATE POLICY "Team members can view channels"
ON public.channels FOR SELECT
TO authenticated
USING (
  is_team_member(auth.uid(), team_id)
  AND (
    is_private IS NOT TRUE
    OR EXISTS (
      SELECT 1 FROM public.channel_members cm
      WHERE cm.channel_id = channels.id AND cm.user_id = auth.uid()
    )
    OR get_team_role(auth.uid(), team_id) IN ('owner', 'admin')
  )
);

-- 4. Update messages SELECT to respect private channels
DROP POLICY IF EXISTS "Team members can view messages" ON public.messages;

CREATE POLICY "Team members can view messages"
ON public.messages FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM channels c
    WHERE c.id = messages.channel_id
    AND is_team_member(auth.uid(), c.team_id)
    AND (
      c.is_private IS NOT TRUE
      OR EXISTS (
        SELECT 1 FROM public.channel_members cm
        WHERE cm.channel_id = c.id AND cm.user_id = auth.uid()
      )
      OR get_team_role(auth.uid(), c.team_id) IN ('owner', 'admin')
    )
  )
);
