-- ============================================
-- Phase 1, Step 1.2: Fix Key Functionaries Contact Data
-- ============================================

-- Drop the overly permissive public policy
DROP POLICY IF EXISTS "Anyone can view active functionaries" ON public.key_functionaries;

-- Create security definer function to check if user is part of the association
CREATE OR REPLACE FUNCTION public.is_member_of_association(viewer_id uuid, target_association_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    -- Check if user is an association manager of this association
    SELECT 1
    FROM association_managers am
    WHERE am.user_id = viewer_id
    AND am.association_id = target_association_id
    AND am.is_active = true
    
    UNION
    
    -- Check if user is a member of a company in this association
    SELECT 1
    FROM members m
    JOIN companies c ON c.id = m.company_id
    WHERE m.user_id = viewer_id
    AND c.association_id = target_association_id
    AND m.is_active = true
  );
$$;

-- Policy 1: Authenticated users can view basic info of active functionaries
-- (This allows viewing name, designation, bio, photo but user should still authenticate)
CREATE POLICY "Authenticated users can view active functionaries"
ON public.key_functionaries
FOR SELECT
USING (
  auth.uid() IS NOT NULL 
  AND is_active = true
);

-- Policy 2: Association members can view their association's functionaries
-- (Including those that are inactive, for context)
CREATE POLICY "Association members can view their association functionaries"
ON public.key_functionaries
FOR SELECT
USING (is_member_of_association(auth.uid(), association_id));

-- Keep existing admin and association manager policies
-- (Already exist, no changes needed to these)

-- Add helpful comment
COMMENT ON POLICY "Authenticated users can view active functionaries" ON public.key_functionaries 
IS 'Requires authentication to view functionary information. Prevents public scraping of executive contact details.';

COMMENT ON POLICY "Association members can view their association functionaries" ON public.key_functionaries
IS 'Members of the association can view all functionaries including inactive ones for their own association.';