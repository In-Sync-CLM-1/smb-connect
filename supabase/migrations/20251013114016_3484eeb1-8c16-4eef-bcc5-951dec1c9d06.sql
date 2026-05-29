-- Add created_by tracking to members, companies, and associations
ALTER TABLE members 
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

ALTER TABLE companies
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

ALTER TABLE associations
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_members_created_by ON members(created_by);
CREATE INDEX IF NOT EXISTS idx_companies_created_by ON companies(created_by);
CREATE INDEX IF NOT EXISTS idx_associations_created_by ON associations(created_by);

-- Drop existing policy if it exists and recreate
DROP POLICY IF EXISTS "Association managers can view their network members" ON members;
CREATE POLICY "Association managers can view their network members"
ON members FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM companies c
    JOIN association_managers am ON am.association_id = c.association_id
    WHERE c.id = members.company_id
    AND am.user_id = auth.uid()
    AND am.is_active = true
  )
  OR created_by = auth.uid()
);

-- Drop existing policy if it exists and recreate with updated logic
DROP POLICY IF EXISTS "Company admins can view company members" ON members;
CREATE POLICY "Company admins can view company members"
ON members FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM members m
    WHERE m.company_id = members.company_id
    AND m.user_id = auth.uid()
    AND m.role IN ('owner', 'admin')
    AND m.is_active = true
  )
  OR created_by = auth.uid()
);