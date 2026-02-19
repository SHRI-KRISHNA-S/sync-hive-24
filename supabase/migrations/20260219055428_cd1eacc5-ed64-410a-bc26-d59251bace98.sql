
CREATE OR REPLACE FUNCTION public.create_team_with_defaults(
  _name text,
  _description text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_team_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF _name IS NULL OR length(trim(_name)) = 0 OR length(trim(_name)) > 100 THEN
    RAISE EXCEPTION 'Invalid team name';
  END IF;

  -- Create team
  INSERT INTO public.teams (name, description, created_by)
  VALUES (trim(_name), _description, auth.uid())
  RETURNING id INTO new_team_id;

  -- Add creator as owner
  INSERT INTO public.team_members (team_id, user_id, role)
  VALUES (new_team_id, auth.uid(), 'owner');

  -- Create default general channel
  INSERT INTO public.channels (team_id, name, description, created_by)
  VALUES (new_team_id, 'general', 'General discussion', auth.uid());

  RETURN new_team_id;
END;
$$;
