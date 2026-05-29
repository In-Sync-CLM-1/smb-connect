-- Drop the existing delete policy that's causing recursion
DROP POLICY IF EXISTS "Super admins can delete members" ON public.members;

-- Create a new delete policy that avoids recursion by directly checking admin_users
CREATE POLICY "Super admins can delete members"
ON public.members
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE admin_users.user_id = auth.uid()
    AND admin_users.is_super_admin = true
    AND admin_users.is_active = true
  )
);