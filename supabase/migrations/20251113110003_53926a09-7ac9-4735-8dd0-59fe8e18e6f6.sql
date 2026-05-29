-- Security Fix: Remove overly permissive RLS policies and replace with granular access controls

-- 1. Fix profiles table - Remove dangerous "Authenticated users can view all profiles" policy
DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON public.profiles;

-- 2. Fix members table - Remove overly permissive policy and any conflicting policies
DROP POLICY IF EXISTS "Members can view other active members" ON public.members;
DROP POLICY IF EXISTS "Company admins can view company members" ON public.members;
DROP POLICY IF EXISTS "Admins can view all members" ON public.members;
DROP POLICY IF EXISTS "Association managers can view network members" ON public.members;
DROP POLICY IF EXISTS "Company members can view colleagues" ON public.members;
DROP POLICY IF EXISTS "Users can view own member records" ON public.members;

-- Create granular member access policies

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
USING (
  EXISTS (
    SELECT 1 FROM members m
    WHERE m.user_id = auth.uid()
    AND m.company_id = members.company_id
    AND m.role IN ('owner', 'admin')
    AND m.is_active = true
  )
);

-- Association managers can view members in their network
CREATE POLICY "Association managers can view network members"
ON public.members
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM companies c
    JOIN association_managers am ON am.association_id = c.association_id
    WHERE c.id = members.company_id
    AND am.user_id = auth.uid()
    AND am.is_active = true
  )
);

-- Members can view other members in the same company
CREATE POLICY "Company members can view colleagues"
ON public.members
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM members m
    WHERE m.user_id = auth.uid()
    AND m.company_id = members.company_id
    AND m.is_active = true
  )
);