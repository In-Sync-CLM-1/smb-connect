-- Fix: Allow senders to delete their own rejected connections so they can re-send requests.
-- Previously the DELETE policy only allowed deleting 'pending' connections, causing
-- re-send to fail with a unique constraint violation when a prior rejected row exists.

DROP POLICY IF EXISTS "Users can delete their sent requests" ON public.connections;

CREATE POLICY "Users can delete their sent requests"
ON public.connections
FOR DELETE
USING (
  sender_id IN (SELECT id FROM public.members WHERE user_id = auth.uid())
  AND status IN ('pending', 'rejected')
);
