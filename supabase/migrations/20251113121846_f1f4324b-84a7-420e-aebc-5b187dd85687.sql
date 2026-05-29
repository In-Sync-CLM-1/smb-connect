-- Fix infinite recursion in members RLS policies - Drop all dependent policies first

-- Drop ALL policies on members table that might depend on the functions
DROP POLICY IF EXISTS "Company admins can view company members" ON public.members;
DROP POLICY IF EXISTS "Company admins can update company members" ON public.members;
DROP POLICY IF EXISTS "Company members can view colleagues" ON public.members;
DROP POLICY IF EXISTS "Association managers can view network members" ON public.members;
DROP POLICY IF EXISTS "Admins can view all members" ON public.members;
DROP POLICY IF EXISTS "Users can view own member records" ON public.members;

-- Now drop the functions with CASCADE to remove any remaining dependencies
DROP FUNCTION IF EXISTS public.is_company_member_admin(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS public.is_same_company(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS public.is_association_manager_of_user(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS public.is_company_admin_of_user(UUID, UUID) CASCADE;

-- Create security definer functions to check permissions without recursion
CREATE FUNCTION public.is_company_member_admin(
  check_user_id UUID,
  check_company_id UUID
)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.members
    WHERE user_id = check_user_id
    AND company_id = check_company_id
    AND role IN ('owner', 'admin')
    AND is_active = true
  );
$$;

CREATE FUNCTION public.is_same_company(
  check_user_id UUID,
  target_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.members m1
    INNER JOIN public.members m2 ON m1.company_id = m2.company_id
    WHERE m1.user_id = check_user_id
    AND m2.user_id = target_user_id
    AND m1.is_active = true
    AND m2.is_active = true
  );
$$;

CREATE FUNCTION public.is_association_manager_of_user(
  manager_user_id UUID,
  target_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.members m
    INNER JOIN public.companies c ON c.id = m.company_id
    INNER JOIN public.association_managers am ON am.association_id = c.association_id
    WHERE m.user_id = target_user_id
    AND am.user_id = manager_user_id
    AND am.is_active = true
    AND m.is_active = true
  );
$$;

CREATE FUNCTION public.is_company_admin_of_user(
  admin_user_id UUID,
  target_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.members m1
    INNER JOIN public.members m2 ON m1.company_id = m2.company_id
    WHERE m2.user_id = target_user_id
    AND m1.user_id = admin_user_id
    AND m1.role IN ('owner', 'admin')
    AND m1.is_active = true
    AND m2.is_active = true
  );
$$;

-- Recreate policies using security definer functions

-- Users can view their own member records
CREATE POLICY "Users can view own member records"
ON public.members
FOR SELECT
USING (user_id = auth.uid());

-- Admins can view all members
CREATE POLICY "Admins can view all members"
ON public.members
FOR SELECT
USING (is_admin(auth.uid()));

-- Company admins can view members of their companies
CREATE POLICY "Company admins can view company members"
ON public.members
FOR SELECT
USING (is_company_member_admin(auth.uid(), company_id));

-- Company admins can update company members
CREATE POLICY "Company admins can update company members"
ON public.members
FOR UPDATE
USING (is_admin_safe(auth.uid()) OR is_company_member_admin(auth.uid(), company_id));

-- Association managers can view members in their network
CREATE POLICY "Association managers can view network members"
ON public.members
FOR SELECT
USING (is_association_manager_of_user(auth.uid(), user_id));

-- Members can view other members in the same company
CREATE POLICY "Company members can view colleagues"
ON public.members
FOR SELECT
USING (is_same_company(auth.uid(), user_id));