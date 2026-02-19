
CREATE OR REPLACE FUNCTION public.delete_team(_team_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only team owner can delete
  IF public.get_team_role(auth.uid(), _team_id) != 'owner' THEN
    RAISE EXCEPTION 'Only team owner can delete the team';
  END IF;

  -- Delete attachments linked to messages in team channels
  DELETE FROM public.attachments
  WHERE message_id IN (
    SELECT m.id FROM public.messages m
    JOIN public.channels c ON c.id = m.channel_id
    WHERE c.team_id = _team_id
  );

  -- Delete messages in team channels
  DELETE FROM public.messages
  WHERE channel_id IN (
    SELECT id FROM public.channels WHERE team_id = _team_id
  );

  -- Delete meetings
  DELETE FROM public.meetings WHERE team_id = _team_id;

  -- Delete channels
  DELETE FROM public.channels WHERE team_id = _team_id;

  -- Delete team members
  DELETE FROM public.team_members WHERE team_id = _team_id;

  -- Delete the team
  DELETE FROM public.teams WHERE id = _team_id;
END;
$$;
