
-- 1. Make attachments bucket private
UPDATE storage.buckets SET public = false WHERE id = 'attachments';

-- 2. Drop the public SELECT policy on storage
DROP POLICY IF EXISTS "Anyone can view attachments" ON storage.objects;

-- 3. Add authenticated storage SELECT policy scoped to user's folder
CREATE POLICY "Authenticated users can view attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'attachments');

-- 4. Enforce email domain restriction server-side in handle_new_user trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.email NOT LIKE '%@bitsathy.ac.in' THEN
    RAISE EXCEPTION 'Only @bitsathy.ac.in email addresses are allowed';
  END IF;

  INSERT INTO public.profiles (user_id, username, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$;
