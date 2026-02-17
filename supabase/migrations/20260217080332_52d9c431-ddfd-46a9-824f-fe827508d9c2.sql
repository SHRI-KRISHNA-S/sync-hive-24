-- Fix message UPDATE policy to require team membership
DROP POLICY "Users can update their own messages" ON public.messages;
CREATE POLICY "Users can update their own messages" ON public.messages
FOR UPDATE USING (
  auth.uid() = user_id AND
  EXISTS (
    SELECT 1 FROM public.channels c
    WHERE c.id = channel_id AND public.is_team_member(auth.uid(), c.team_id)
  )
);

-- Fix message DELETE policy to require team membership
DROP POLICY "Users can delete their own messages" ON public.messages;
CREATE POLICY "Users can delete their own messages" ON public.messages
FOR DELETE USING (
  auth.uid() = user_id AND
  EXISTS (
    SELECT 1 FROM public.channels c
    WHERE c.id = channel_id AND public.is_team_member(auth.uid(), c.team_id)
  )
);