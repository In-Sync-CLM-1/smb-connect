-- Security Fix: Add search_path to all security definer functions
-- This prevents schema confusion attacks

-- Recreate is_admin function with proper search_path
CREATE OR REPLACE FUNCTION public.is_admin(check_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM admin_users
    WHERE user_id = check_user_id AND is_active = true
  );
END;
$$;

-- Recreate is_association_manager function with proper search_path
CREATE OR REPLACE FUNCTION public.is_association_manager(check_user_id uuid, check_association_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM association_managers
    WHERE user_id = check_user_id 
    AND association_id = check_association_id
    AND is_active = true
  );
END;
$$;

-- Recreate is_company_admin function with proper search_path
CREATE OR REPLACE FUNCTION public.is_company_admin(check_user_id uuid, check_company_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM members
    WHERE user_id = check_user_id 
    AND company_id = check_company_id
    AND role IN ('owner', 'admin')
    AND is_active = true
  );
END;
$$;

-- Recreate get_user_role_context function with proper search_path
CREATE OR REPLACE FUNCTION public.get_user_role_context(check_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if admin
  IF EXISTS (SELECT 1 FROM admin_users WHERE user_id = check_user_id AND is_active = true) THEN
    RETURN 'admin';
  END IF;
  
  -- Check if association manager
  IF EXISTS (SELECT 1 FROM association_managers WHERE user_id = check_user_id AND is_active = true) THEN
    RETURN 'association';
  END IF;
  
  -- Check if company owner/admin
  IF EXISTS (SELECT 1 FROM members WHERE user_id = check_user_id AND role IN ('owner', 'admin') AND is_active = true) THEN
    RETURN 'company';
  END IF;
  
  -- Default to member
  RETURN 'member';
END;
$$;