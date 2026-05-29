-- Drop the problematic SELECT policy that directly queries auth.users
DROP POLICY IF EXISTS "Users can view invitations sent to their email" ON company_invitations;

-- Recreate using the security definer function
CREATE POLICY "Users can view invitations sent to their email"
ON company_invitations
FOR SELECT
USING (
  email = get_user_email(auth.uid())
);