
-- Add RLS policy for association managers to view member profiles
CREATE POLICY "Association managers can view member profiles in their network"
ON profiles FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM members m
    JOIN companies c ON c.id = m.company_id
    JOIN association_managers am ON am.association_id = c.association_id
    WHERE m.user_id = profiles.id
    AND am.user_id = auth.uid()
    AND am.is_active = true
    AND m.is_active = true
  )
);

-- Also add policy for company admins to view their company member profiles
CREATE POLICY "Company admins can view their company member profiles"
ON profiles FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM members m1
    JOIN members m2 ON m2.company_id = m1.company_id
    WHERE m1.user_id = auth.uid()
    AND m1.role IN ('owner', 'admin')
    AND m1.is_active = true
    AND m2.user_id = profiles.id
    AND m2.is_active = true
  )
);
