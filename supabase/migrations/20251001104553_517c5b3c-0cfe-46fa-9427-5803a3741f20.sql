-- Drop the problematic policy
DROP POLICY IF EXISTS "Company admins can view company members" ON public.members;

-- Create a security definer function that bypasses RLS to check company admin status
CREATE OR REPLACE FUNCTION public.check_company_admin_for_member(member_company_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_admin boolean;
BEGIN
  -- Check if current user is an admin of the given company
  SELECT EXISTS (
    SELECT 1 FROM members
    WHERE user_id = auth.uid()
    AND company_id = member_company_id
    AND role IN ('owner', 'admin')
    AND is_active = true
  ) INTO is_admin;
  
  RETURN is_admin;
END;
$$;

-- Recreate the policy using the security definer function
CREATE POLICY "Company admins can view company members"
ON public.members
FOR SELECT
USING (public.check_company_admin_for_member(company_id));