
CREATE OR REPLACE FUNCTION public.leave_team(_team_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Owners cannot leave; they must delete the team
  IF public.get_team_role(auth.uid(), _team_id) = 'owner' THEN
    RAISE EXCEPTION 'Team owner cannot leave. Delete the team instead.';
  END IF;

  -- Must be a member to leave
  IF NOT public.is_team_member(auth.uid(), _team_id) THEN
    RAISE EXCEPTION 'Not a member of this team';
  END IF;

  DELETE FROM public.team_members
  WHERE team_id = _team_id AND user_id = auth.uid();
END;
$$;
