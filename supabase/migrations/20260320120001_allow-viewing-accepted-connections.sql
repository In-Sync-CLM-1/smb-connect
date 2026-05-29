-- Allow all authenticated users to view accepted connections
-- so that connection counts are visible on member profiles.
CREATE POLICY "Authenticated users can view accepted connections"
ON public.connections
FOR SELECT
TO authenticated
USING (status = 'accepted');
