-- Allow users to update their own events
CREATE POLICY "Users can update their own events"
ON public.events
FOR UPDATE
TO authenticated
USING (auth.uid() = created_by)
WITH CHECK (auth.uid() = created_by);

-- Allow users to delete their own events
CREATE POLICY "Users can delete their own events"
ON public.events
FOR DELETE
TO authenticated
USING (auth.uid() = created_by);