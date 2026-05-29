-- Allow authenticated users to view profiles of post authors (for feed functionality)
CREATE POLICY "Authenticated users can view profiles of post authors"
ON public.profiles
FOR SELECT
USING (
  auth.uid() IS NOT NULL 
  AND EXISTS (
    SELECT 1 FROM public.posts WHERE posts.user_id = profiles.id
  )
);