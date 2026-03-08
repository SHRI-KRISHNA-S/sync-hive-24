
-- Create reactions table
CREATE TABLE public.reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES public.messages(id) ON DELETE CASCADE,
  dm_id UUID REFERENCES public.direct_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id, emoji),
  UNIQUE (dm_id, user_id, emoji),
  CHECK ((message_id IS NOT NULL AND dm_id IS NULL) OR (message_id IS NULL AND dm_id IS NOT NULL))
);

-- Enable RLS
ALTER TABLE public.reactions ENABLE ROW LEVEL SECURITY;

-- RLS: team members can view reactions on channel messages
CREATE POLICY "Team members can view message reactions"
ON public.reactions FOR SELECT
TO authenticated
USING (
  (message_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM messages m JOIN channels c ON c.id = m.channel_id
    WHERE m.id = reactions.message_id AND is_team_member(auth.uid(), c.team_id)
  ))
  OR
  (dm_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM direct_messages dm
    WHERE dm.id = reactions.dm_id AND (auth.uid() = dm.sender_id OR auth.uid() = dm.receiver_id)
  ))
);

-- RLS: authenticated users can add reactions
CREATE POLICY "Users can add reactions"
ON public.reactions FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND (
    (message_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM messages m JOIN channels c ON c.id = m.channel_id
      WHERE m.id = reactions.message_id AND is_team_member(auth.uid(), c.team_id)
    ))
    OR
    (dm_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM direct_messages dm
      WHERE dm.id = reactions.dm_id AND (auth.uid() = dm.sender_id OR auth.uid() = dm.receiver_id)
    ))
  )
);

-- RLS: users can remove their own reactions
CREATE POLICY "Users can remove own reactions"
ON public.reactions FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.reactions;
