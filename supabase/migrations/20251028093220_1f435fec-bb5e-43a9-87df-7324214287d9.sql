-- Create security definer function to safely access user emails
CREATE OR REPLACE FUNCTION public.get_user_email(check_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT email::text FROM auth.users WHERE id = check_user_id;
$$;

-- Drop the existing problematic policy
DROP POLICY IF EXISTS "Invited users can accept their invitations" ON company_invitations;

-- Recreate policy using the security definer function
CREATE POLICY "Invited users can accept their invitations"
ON company_invitations
FOR UPDATE
USING (
  email = get_user_email(auth.uid())
  AND status = 'pending'
)
WITH CHECK (
  email = get_user_email(auth.uid())
  AND status IN ('accepted', 'pending')
);