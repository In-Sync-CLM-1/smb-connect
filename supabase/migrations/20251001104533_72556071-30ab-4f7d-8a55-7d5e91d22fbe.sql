-- Create a security definer function to check company admin status without recursion
CREATE OR REPLACE FUNCTION public.is_company_admin_safe(check_user_id uuid, check_company_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM members
    WHERE user_id = check_user_id 
    AND company_id = check_company_id
    AND role IN ('owner', 'admin')
    AND is_active = true
  );
$$;

-- Drop and recreate the policy to avoid recursion
DROP POLICY IF EXISTS "Company admins can view company members" ON public.members;

CREATE POLICY "Company admins can view company members"
ON public.members
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM members m
    WHERE m.user_id = auth.uid()
    AND m.company_id = members.company_id
    AND m.role IN ('owner', 'admin')
    AND m.is_active = true
  )
);