-- Complete fix for infinite recursion - drop ALL complex policies
-- and create simple, direct policies for admins

-- ASSOCIATIONS - Keep only admin and association manager policies
DROP POLICY IF EXISTS "Members can view associations through direct company link" ON associations;
DROP POLICY IF EXISTS "Association managers can view their associations" ON associations;

CREATE POLICY "Association managers can view their own associations"
ON associations
FOR SELECT
TO authenticated
USING (
  id IN (
    SELECT association_id FROM association_managers 
    WHERE user_id = auth.uid() AND is_active = true
  )
);

-- COMPANIES - Keep only admin and simple manager policies
DROP POLICY IF EXISTS "Members can view companies in their association" ON companies;
DROP POLICY IF EXISTS "Association managers can view their companies" ON companies;

CREATE POLICY "Association managers can view their companies"
ON companies
FOR SELECT
TO authenticated
USING (
  association_id IN (
    SELECT association_id FROM association_managers 
    WHERE user_id = auth.uid() AND is_active = true
  )
);

-- MEMBERS - Simple policies without recursion
DROP POLICY IF EXISTS "Company admins can manage members" ON members;

CREATE POLICY "Users can view their own member record"
ON members
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Company admins can view company members"
ON members
FOR SELECT  
TO authenticated
USING (
  company_id IN (
    SELECT company_id FROM members 
    WHERE user_id = auth.uid() 
    AND role IN ('owner', 'admin')
    AND is_active = true
  )
);