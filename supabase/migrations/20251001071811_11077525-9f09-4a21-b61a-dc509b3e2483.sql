-- Fix infinite recursion in RLS policies by adding admin bypass policies
-- These policies will allow admins to view data without complex joins that cause recursion

-- Drop problematic policies and recreate them with admin bypass
-- ASSOCIATIONS TABLE
DROP POLICY IF EXISTS "Members can view their association" ON associations;

-- Simple admin bypass policy for associations
CREATE POLICY "Admins have full access to associations" 
ON associations 
FOR ALL 
TO authenticated
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

-- Recreate member view policy without complex joins
CREATE POLICY "Members can view associations through direct company link" 
ON associations 
FOR SELECT 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM members m
    WHERE m.user_id = auth.uid() 
    AND m.is_active = true
    AND m.company_id IN (
      SELECT id FROM companies WHERE association_id = associations.id
    )
  )
);

-- COMPANIES TABLE  
DROP POLICY IF EXISTS "Members can view companies in association" ON companies;

-- Simple admin bypass for companies
CREATE POLICY "Admins have full access to companies"
ON companies
FOR ALL
TO authenticated  
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

-- Recreate member view without recursion
CREATE POLICY "Members can view companies in their association"
ON companies
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM members m
    WHERE m.user_id = auth.uid()
    AND m.is_active = true
    AND m.company_id IN (
      SELECT id FROM companies c WHERE c.association_id = companies.association_id
    )
  )
);

-- MEMBERS TABLE
DROP POLICY IF EXISTS "Users can view members in association" ON members;

-- Simple admin bypass for members
CREATE POLICY "Admins have full access to members"
ON members
FOR ALL
TO authenticated
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

-- ASSOCIATION_MANAGERS TABLE
DROP POLICY IF EXISTS "Admins can manage association managers" ON association_managers;
DROP POLICY IF EXISTS "Association owners can view their managers" ON association_managers;

-- Simple admin policies without recursion
CREATE POLICY "Admins have full access to association managers"
ON association_managers
FOR ALL
TO authenticated
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Users can view their own manager records"
ON association_managers
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);