-- ============================================
-- Phase 1, Step 1.1: Fix Profiles Table RLS
-- ============================================

-- Create security definer function to check if users are connected
CREATE OR REPLACE FUNCTION public.is_connected_to(viewer_id uuid, target_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM connections c
    JOIN members m1 ON m1.id = c.sender_id
    JOIN members m2 ON m2.id = c.receiver_id
    WHERE c.status = 'accepted'
    AND (
      (m1.user_id = viewer_id AND m2.user_id = target_user_id)
      OR (m1.user_id = target_user_id AND m2.user_id = viewer_id)
    )
  );
$$;

-- Create security definer function to check if viewer is in same company as target
CREATE OR REPLACE FUNCTION public.is_same_company(viewer_id uuid, target_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM members m1
    JOIN members m2 ON m1.company_id = m2.company_id
    WHERE m1.user_id = viewer_id
    AND m2.user_id = target_user_id
    AND m1.company_id IS NOT NULL
    AND m1.is_active = true
    AND m2.is_active = true
  );
$$;

-- Create security definer function to check if viewer is company admin of target's company
CREATE OR REPLACE FUNCTION public.is_company_admin_of_user(viewer_id uuid, target_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM members m_viewer
    JOIN members m_target ON m_viewer.company_id = m_target.company_id
    WHERE m_viewer.user_id = viewer_id
    AND m_target.user_id = target_user_id
    AND m_viewer.role IN ('owner', 'admin')
    AND m_viewer.is_active = true
    AND m_target.is_active = true
  );
$$;

-- Create security definer function to check if viewer is association manager of target's association
CREATE OR REPLACE FUNCTION public.is_association_manager_of_user(viewer_id uuid, target_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM association_managers am
    JOIN companies c ON c.association_id = am.association_id
    JOIN members m ON m.company_id = c.id
    WHERE am.user_id = viewer_id
    AND m.user_id = target_user_id
    AND am.is_active = true
    AND m.is_active = true
  );
$$;

-- Drop existing policies on profiles table
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- Create new comprehensive RLS policies for profiles table
CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
USING (is_admin(auth.uid()));

CREATE POLICY "Connected users can view each other's profiles"
ON public.profiles
FOR SELECT
USING (is_connected_to(auth.uid(), id));

CREATE POLICY "Company managers can view their company members' profiles"
ON public.profiles
FOR SELECT
USING (is_company_admin_of_user(auth.uid(), id));

CREATE POLICY "Association managers can view profiles in their network"
ON public.profiles
FOR SELECT
USING (is_association_manager_of_user(auth.uid(), id));

CREATE POLICY "Company members can view same company profiles"
ON public.profiles
FOR SELECT
USING (is_same_company(auth.uid(), id));

CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
USING (auth.uid() = id);

-- ============================================
-- BONUS: Fix existing security definer functions
-- (Addresses "Function Search Path Mutable" warnings)
-- ============================================

-- Fix handle_new_user function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  -- Insert profile
  INSERT INTO public.profiles (id, first_name, last_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', '')
  );
  
  -- Auto-create member record with 'member' role
  INSERT INTO public.members (user_id, role, company_id)
  VALUES (NEW.id, 'member', NULL);
  
  RETURN NEW;
END;
$function$;

-- Fix update_updated_at_column function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;