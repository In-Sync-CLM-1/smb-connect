-- Fix infinite recursion in profiles RLS policies

-- Drop problematic policies on profiles table
DROP POLICY IF EXISTS "Association managers can view member profiles in their network" ON public.profiles;
DROP POLICY IF EXISTS "Company admins can view their company member profiles" ON public.profiles;

-- Create security definer functions for profiles access
CREATE OR REPLACE FUNCTION public.can_view_profile_as_association_manager(
  viewer_id UUID,
  profile_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM members m
    JOIN companies c ON c.id = m.company_id
    JOIN association_managers am ON am.association_id = c.association_id
    WHERE m.user_id = profile_user_id
    AND am.user_id = viewer_id
    AND am.is_active = true
    AND m.is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.can_view_profile_as_company_admin(
  viewer_id UUID,
  profile_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM members m1
    JOIN members m2 ON m2.company_id = m1.company_id
    WHERE m1.user_id = viewer_id
    AND m1.role IN ('owner', 'admin')
    AND m1.is_active = true
    AND m2.user_id = profile_user_id
    AND m2.is_active = true
  );
$$;

-- Recreate policies using security definer functions
CREATE POLICY "Association managers can view member profiles in their network"
ON public.profiles
FOR SELECT
USING (can_view_profile_as_association_manager(auth.uid(), id));

CREATE POLICY "Company admins can view their company member profiles"
ON public.profiles
FOR SELECT
USING (can_view_profile_as_company_admin(auth.uid(), id));