-- Drop the restrictive INSERT policy and recreate as permissive
DROP POLICY IF EXISTS "Authenticated users can create teams" ON public.teams;

CREATE POLICY "Authenticated users can create teams"
ON public.teams
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

-- Also need to allow users to view teams by invite code for joining
CREATE POLICY "Users can view teams by invite code"
ON public.teams
FOR SELECT
TO authenticated
USING (true);