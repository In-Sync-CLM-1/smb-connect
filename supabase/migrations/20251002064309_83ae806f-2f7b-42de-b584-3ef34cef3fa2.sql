-- Allow authenticated users to view basic association info for filtering
CREATE POLICY "Authenticated users can view associations for filtering"
ON public.associations
FOR SELECT
TO authenticated
USING (is_active = true);

-- Ensure authenticated users can view basic company info (policy may already exist but let's be explicit)
DROP POLICY IF EXISTS "Authenticated users can view active companies" ON public.companies;

CREATE POLICY "Authenticated users can view active companies"
ON public.companies
FOR SELECT
TO authenticated
USING (is_active = true);