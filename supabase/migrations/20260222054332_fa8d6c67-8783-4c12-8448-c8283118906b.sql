CREATE POLICY "Authenticated users can view all non-hidden profiles"
  ON public.profiles
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL 
    AND NOT is_hidden_admin(id)
  );