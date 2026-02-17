-- Fix attachments INSERT policy to verify ownership
DROP POLICY "Users can create attachments" ON public.attachments;

CREATE POLICY "Users can create attachments for their messages"
ON public.attachments
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL AND (
    (message_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.messages m
      JOIN public.channels c ON c.id = m.channel_id
      WHERE m.id = message_id
        AND m.user_id = auth.uid()
        AND public.is_team_member(auth.uid(), c.team_id)
    ))
    OR
    (dm_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.direct_messages dm
      WHERE dm.id = dm_id AND auth.uid() = dm.sender_id
    ))
  )
);