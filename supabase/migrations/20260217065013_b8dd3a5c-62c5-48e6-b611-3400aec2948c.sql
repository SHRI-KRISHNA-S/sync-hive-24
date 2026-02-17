-- Fix 1: Add length constraints to prevent storage abuse
ALTER TABLE public.messages ADD CONSTRAINT message_content_length CHECK (length(content) <= 4000);
ALTER TABLE public.direct_messages ADD CONSTRAINT dm_content_length CHECK (length(content) <= 4000);
ALTER TABLE public.meetings ADD CONSTRAINT meeting_title_length CHECK (length(title) <= 200);
ALTER TABLE public.meetings ADD CONSTRAINT meeting_description_length CHECK (description IS NULL OR length(description) <= 2000);
ALTER TABLE public.teams ADD CONSTRAINT team_name_length CHECK (length(name) <= 100);
ALTER TABLE public.channels ADD CONSTRAINT channel_name_length CHECK (length(name) <= 100);

-- Fix 2: Add DELETE policy for attachments
CREATE POLICY "Users can delete attachments from their messages"
ON public.attachments
FOR DELETE
USING (
  (message_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.messages m
    WHERE m.id = message_id AND m.user_id = auth.uid()
  ))
  OR
  (dm_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.direct_messages dm
    WHERE dm.id = dm_id AND dm.sender_id = auth.uid()
  ))
);

-- Fix 3: Restrict profile visibility to team members only
DROP POLICY "Users can view all profiles" ON public.profiles;
CREATE POLICY "Team members can view profiles" ON public.profiles
FOR SELECT USING (
  auth.uid() = user_id OR
  EXISTS (
    SELECT 1 FROM public.team_members tm1
    JOIN public.team_members tm2 ON tm1.team_id = tm2.team_id
    WHERE tm1.user_id = auth.uid() AND tm2.user_id = profiles.user_id
  )
);