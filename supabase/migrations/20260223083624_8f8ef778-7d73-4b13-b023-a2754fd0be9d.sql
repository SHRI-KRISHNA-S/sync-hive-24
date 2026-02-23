
-- RPC for owner/admin to kick a member from a team
CREATE OR REPLACE FUNCTION public.kick_team_member(_team_id uuid, _user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role team_role;
  target_role team_role;
BEGIN
  -- Caller must be owner or admin
  caller_role := get_team_role(_team_id, auth.uid());
  IF caller_role IS NULL OR caller_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Only owners and admins can remove members';
  END IF;

  -- Cannot kick yourself
  IF _user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot remove yourself. Use leave_team instead.';
  END IF;

  -- Cannot kick the owner
  target_role := get_team_role(_team_id, _user_id);
  IF target_role = 'owner' THEN
    RAISE EXCEPTION 'Cannot remove the team owner';
  END IF;

  -- Admins cannot kick other admins
  IF caller_role = 'admin' AND target_role = 'admin' THEN
    RAISE EXCEPTION 'Admins cannot remove other admins';
  END IF;

  DELETE FROM public.team_members
  WHERE team_id = _team_id AND user_id = _user_id;
END;
$$;
