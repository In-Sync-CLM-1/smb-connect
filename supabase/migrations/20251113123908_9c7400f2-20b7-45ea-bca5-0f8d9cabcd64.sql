-- Drop the problematic RLS policy that causes circular dependency
DROP POLICY IF EXISTS "Association managers can view their own associations" ON public.associations;

-- Create a security definer function to check if user is an association manager
CREATE OR REPLACE FUNCTION public.is_user_association_manager(_user_id UUID, _association_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.association_managers
    WHERE user_id = _user_id
      AND association_id = _association_id
      AND is_active = true
  )
$$;

-- Recreate the policy using the security definer function
CREATE POLICY "Association managers can view their own associations"
ON public.associations
FOR SELECT
TO authenticated
USING (
  public.is_user_association_manager(auth.uid(), id)
);