-- Step 1: Create Security Definer Functions to prevent infinite recursion

-- Safe function to check if user is admin (bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_admin_safe(check_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM admin_users
    WHERE user_id = check_user_id 
    AND is_active = true
  );
$$;

-- Safe function to check if user is company admin for specific company
CREATE OR REPLACE FUNCTION public.is_company_member_admin(check_user_id uuid, check_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
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

-- Safe function to check if user is association manager for company's association
CREATE OR REPLACE FUNCTION public.is_association_network_manager(check_user_id uuid, check_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM companies c
    JOIN association_managers am ON am.association_id = c.association_id
    WHERE c.id = check_company_id
    AND am.user_id = check_user_id
    AND am.is_active = true
  );
$$;

-- Step 2: Add created_by column to members table
ALTER TABLE members 
ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS idx_members_created_by ON members(created_by);

-- Step 3: Drop existing problematic RLS policies on members table
DROP POLICY IF EXISTS "Company admins can view company members" ON members;
DROP POLICY IF EXISTS "Association managers can view their network members" ON members;
DROP POLICY IF EXISTS "Admins have full access to members" ON members;
DROP POLICY IF EXISTS "Admins can manage members" ON members;
DROP POLICY IF EXISTS "Admins can view all members" ON members;
DROP POLICY IF EXISTS "Company admins can view their company members" ON members;
DROP POLICY IF EXISTS "Users can view own member record" ON members;
DROP POLICY IF EXISTS "Members can view their own record" ON members;
DROP POLICY IF EXISTS "System can create member records" ON members;

-- Step 4: Create new safe RLS policies using security definer functions

-- Admin full access policy
CREATE POLICY "Admins have full access to members"
ON members
FOR ALL
TO authenticated
USING (is_admin_safe(auth.uid()))
WITH CHECK (is_admin_safe(auth.uid()));

-- Critical INSERT policy that prevents recursion
CREATE POLICY "System can create member records"
ON members
FOR INSERT
TO authenticated
WITH CHECK (
  -- User creating their own record
  auth.uid() = user_id
  OR
  -- Admin creating records for others
  is_admin_safe(auth.uid())
);

-- Company admins can view their company members
CREATE POLICY "Company admins can view company members"
ON members
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR is_admin_safe(auth.uid())
  OR is_company_member_admin(auth.uid(), company_id)
  OR (created_by = auth.uid() AND created_by IS NOT NULL)
);

-- Association managers can view network members
CREATE POLICY "Association managers can view network members"
ON members
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR is_admin_safe(auth.uid())
  OR is_association_network_manager(auth.uid(), company_id)
  OR (created_by = auth.uid() AND created_by IS NOT NULL)
);

-- Users can update their own records
CREATE POLICY "Users can update own member record"
ON members
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Company admins can update their company members
CREATE POLICY "Company admins can update company members"
ON members
FOR UPDATE
TO authenticated
USING (
  is_admin_safe(auth.uid())
  OR is_company_member_admin(auth.uid(), company_id)
)
WITH CHECK (
  is_admin_safe(auth.uid())
  OR is_company_member_admin(auth.uid(), company_id)
);