
-- Remove the overly permissive "view teams by invite code" policy
DROP POLICY IF EXISTS "Users can view teams by invite code" ON public.teams;

-- Create a secure RPC function to join teams by invite code
-- This avoids exposing all teams to all authenticated users
CREATE OR REPLACE FUNCTION public.join_team_by_invite_code(code TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  team_uuid UUID;
  existing_membership UUID;
BEGIN
  -- Validate input
  IF code IS NULL OR length(trim(code)) = 0 OR length(trim(code)) > 50 THEN
    RAISE EXCEPTION 'Invalid invite code';
  END IF;

  -- Find team by invite code
  SELECT id INTO team_uuid FROM public.teams WHERE invite_code = trim(code);
  
  IF team_uuid IS NULL THEN
    RAISE EXCEPTION 'Invalid invite code';
  END IF;

  -- Check if already a member
  SELECT id INTO existing_membership FROM public.team_members
  WHERE team_id = team_uuid AND user_id = auth.uid();
  
  IF existing_membership IS NOT NULL THEN
    RETURN team_uuid;
  END IF;

  -- Insert membership
  INSERT INTO public.team_members (team_id, user_id, role)
  VALUES (team_uuid, auth.uid(), 'member');

  RETURN team_uuid;
END;
$$;
