
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _username TEXT;
  _display_name TEXT;
  new_team_id UUID;
BEGIN
  IF NEW.email NOT LIKE '%@bitsathy.ac.in' THEN
    RAISE EXCEPTION 'Only @bitsathy.ac.in email addresses are allowed';
  END IF;

  _username := COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1));
  _display_name := COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1));

  -- Create profile
  INSERT INTO public.profiles (user_id, username, display_name)
  VALUES (NEW.id, _username, _display_name);

  -- Create personal team
  INSERT INTO public.teams (name, description, created_by)
  VALUES (_username || '''s Space', 'Personal workspace for ' || _display_name, NEW.id)
  RETURNING id INTO new_team_id;

  -- Add user as owner
  INSERT INTO public.team_members (team_id, user_id, role)
  VALUES (new_team_id, NEW.id, 'owner');

  -- Create default general channel
  INSERT INTO public.channels (team_id, name, description, created_by, is_private)
  VALUES (new_team_id, 'general', 'Your personal channel', NEW.id, true);

  RETURN NEW;
END;
$function$;
