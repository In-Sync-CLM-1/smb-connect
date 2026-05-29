-- Allow authenticated users to create events
CREATE POLICY "Authenticated users can create events"
ON public.events
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = created_by);