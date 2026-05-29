-- Allow admins to view all connections regardless of status.
-- Without this, admins can only see connections they're personally a part of
-- (via "Users can view their connections") plus accepted connections from everyone
-- (via "Authenticated users can view accepted connections").
-- Pending and rejected connections from other users are invisible to admins,
-- causing analytics and admin reports to show incomplete data.

CREATE POLICY "Admins can view all connections"
  ON public.connections
  FOR SELECT
  USING (is_admin(auth.uid()));
