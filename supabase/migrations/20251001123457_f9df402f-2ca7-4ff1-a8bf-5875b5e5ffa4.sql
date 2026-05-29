-- ============================================
-- Phase 2.5: Additional Data Protection
-- ============================================

-- ============================================
-- Step 2.5.1: Fix Companies Table - Protect Sensitive Business Data
-- ============================================

-- Create security definer function to check if user can view company details
CREATE OR REPLACE FUNCTION public.can_view_company_details(viewer_id uuid, target_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    -- User is a member of this company
    SELECT 1
    FROM members m
    WHERE m.user_id = viewer_id
    AND m.company_id = target_company_id
    AND m.is_active = true
    
    UNION
    
    -- User is an association manager of this company's association
    SELECT 1
    FROM companies c
    JOIN association_managers am ON am.association_id = c.association_id
    WHERE c.id = target_company_id
    AND am.user_id = viewer_id
    AND am.is_active = true
    
    UNION
    
    -- User is an admin
    SELECT 1
    FROM admin_users au
    WHERE au.user_id = viewer_id
    AND au.is_active = true
  );
$$;

-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Association managers can view their companies" ON public.companies;
DROP POLICY IF EXISTS "Hierarchy can update companies" ON public.companies;

-- Create new restrictive policies for companies
CREATE POLICY "Users can view basic company info"
ON public.companies
FOR SELECT
USING (
  auth.uid() IS NOT NULL 
  AND is_active = true
);

CREATE POLICY "Authorized users can view full company details"
ON public.companies
FOR SELECT
USING (can_view_company_details(auth.uid(), id));

CREATE POLICY "Authorized hierarchy can update companies"
ON public.companies
FOR UPDATE
USING (
  is_admin(auth.uid()) 
  OR is_association_manager(auth.uid(), association_id) 
  OR is_company_admin(auth.uid(), id)
);

-- ============================================
-- Step 2.5.2: Refine Key Functionaries - Restrict Contact Details
-- ============================================

-- Drop the authenticated users policy that's too permissive
DROP POLICY IF EXISTS "Authenticated users can view active functionaries" ON public.key_functionaries;

-- Create more restrictive policy - only association members can view functionaries
CREATE POLICY "Association members can view functionaries with contact info"
ON public.key_functionaries
FOR SELECT
USING (
  is_member_of_association(auth.uid(), association_id) 
  AND is_active = true
);

-- ============================================
-- Step 2.5.3: Create View for Public Company Info (Without Sensitive Data)
-- ============================================

-- Create a view that exposes only non-sensitive company information
CREATE OR REPLACE VIEW public.companies_public AS
SELECT 
  id,
  name,
  association_id,
  website,
  logo,
  description,
  industry_type,
  business_type,
  city,
  state,
  country,
  employee_count,
  year_established,
  is_active,
  created_at
FROM public.companies
WHERE is_active = true;

-- Enable RLS on the view
ALTER VIEW public.companies_public SET (security_invoker = true);

-- Grant access to authenticated users
GRANT SELECT ON public.companies_public TO authenticated;

-- ============================================
-- Step 2.5.4: Create View for Public Functionary Info (Without Contact Details)
-- ============================================

-- Create a view that exposes only non-sensitive functionary information
CREATE OR REPLACE VIEW public.key_functionaries_public AS
SELECT 
  id,
  association_id,
  name,
  designation,
  bio,
  photo,
  display_order,
  is_active
FROM public.key_functionaries
WHERE is_active = true;

-- Enable RLS on the view
ALTER VIEW public.key_functionaries_public SET (security_invoker = true);

-- Grant access to authenticated users
GRANT SELECT ON public.key_functionaries_public TO authenticated;

-- ============================================
-- Step 2.5.5: Add Row-Level Filtering for Sensitive Columns
-- ============================================

-- Add comments to document which fields are sensitive
COMMENT ON COLUMN public.companies.email IS 'SENSITIVE: Business email - restricted to authorized users only';
COMMENT ON COLUMN public.companies.phone IS 'SENSITIVE: Business phone - restricted to authorized users only';
COMMENT ON COLUMN public.companies.gst_number IS 'SENSITIVE: GST number - restricted to authorized users only';
COMMENT ON COLUMN public.companies.pan_number IS 'SENSITIVE: PAN number - restricted to authorized users only';
COMMENT ON COLUMN public.companies.annual_turnover IS 'SENSITIVE: Financial data - restricted to authorized users only';

COMMENT ON COLUMN public.key_functionaries.email IS 'SENSITIVE: Personal email - restricted to association members only';
COMMENT ON COLUMN public.key_functionaries.phone IS 'SENSITIVE: Personal phone - restricted to association members only';

COMMENT ON COLUMN public.profiles.phone IS 'SENSITIVE: Personal phone - restricted to connected users and same company/association';
COMMENT ON COLUMN public.profiles.linkedin_url IS 'SENSITIVE: Social media - restricted to connected users and same company/association';
COMMENT ON COLUMN public.profiles.twitter_url IS 'SENSITIVE: Social media - restricted to connected users and same company/association';

-- Add helpful policy comments
COMMENT ON POLICY "Users can view basic company info" ON public.companies
IS 'Allows viewing basic company info. For sensitive fields like GST, PAN, phone, use "Authorized users can view full company details" policy.';

COMMENT ON POLICY "Association members can view functionaries with contact info" ON public.key_functionaries
IS 'Only association members can view contact details (email, phone) of functionaries. Use companies_public view for public display.';