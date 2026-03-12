
-- Create a security definer function to check channel membership without triggering RLS
CREATE OR REPLACE FUNCTION public.is_channel_member(_user_id uuid, _channel_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.channel_members
    WHERE user_id = _user_id AND channel_id = _channel_id
  )
$$;

-- Drop and recreate channels SELECT policy to use the function
DROP POLICY IF EXISTS "Team members can view channels" ON public.channels;
CREATE POLICY "Team members can view channels" ON public.channels
FOR SELECT TO authenticated
USING (
  is_team_member(auth.uid(), team_id)
  AND (
    is_private IS NOT TRUE
    OR is_channel_member(auth.uid(), id)
    OR get_team_role(auth.uid(), team_id) IN ('owner', 'admin')
  )
);

-- Drop and recreate channel_members SELECT policy to use the function instead of joining channels
DROP POLICY IF EXISTS "Team members can view channel members" ON public.channel_members;
CREATE POLICY "Team members can view channel members" ON public.channel_members
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.channels c
    WHERE c.id = channel_members.channel_id
    AND is_team_member(auth.uid(), c.team_id)
  )
);

-- Fix messages SELECT policy similarly
DROP POLICY IF EXISTS "Team members can view messages" ON public.messages;
CREATE POLICY "Team members can view messages" ON public.messages
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.channels c
    WHERE c.id = messages.channel_id
    AND is_team_member(auth.uid(), c.team_id)
    AND (
      c.is_private IS NOT TRUE
      OR is_channel_member(auth.uid(), c.id)
      OR get_team_role(auth.uid(), c.team_id) IN ('owner', 'admin')
    )
  )
);
