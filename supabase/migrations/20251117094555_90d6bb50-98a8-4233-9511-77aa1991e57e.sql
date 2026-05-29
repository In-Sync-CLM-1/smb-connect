-- Step 1: Add organizational columns to email_lists (nullable first)
ALTER TABLE email_lists 
ADD COLUMN IF NOT EXISTS association_id UUID REFERENCES associations(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;

-- Step 2: Migrate existing email lists FIRST before adding constraint
-- Update lists created by association managers
UPDATE email_lists el
SET association_id = am.association_id
FROM association_managers am
WHERE el.created_by = am.user_id
AND am.is_active = true
AND el.association_id IS NULL
AND el.company_id IS NULL;

-- Update lists created by company admins
UPDATE email_lists el
SET company_id = m.company_id
FROM members m
WHERE el.created_by = m.user_id
AND m.role IN ('owner', 'admin')
AND m.is_active = true
AND el.association_id IS NULL
AND el.company_id IS NULL;

-- Update any remaining lists created by super admins - assign to first association
UPDATE email_lists el
SET association_id = (SELECT id FROM associations LIMIT 1)
WHERE el.association_id IS NULL
AND el.company_id IS NULL
AND EXISTS (SELECT 1 FROM admin_users WHERE user_id = el.created_by AND is_super_admin = true);

-- Step 3: NOW add constraint after data is migrated
ALTER TABLE email_lists 
ADD CONSTRAINT email_lists_org_check 
CHECK (
  (association_id IS NOT NULL AND company_id IS NULL) OR 
  (association_id IS NULL AND company_id IS NOT NULL)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_email_lists_association_id ON email_lists(association_id);
CREATE INDEX IF NOT EXISTS idx_email_lists_company_id ON email_lists(company_id);

-- Step 4: Drop old RLS policies
DROP POLICY IF EXISTS "Only authorized users can manage email lists" ON email_lists;
DROP POLICY IF EXISTS "Super admins can view all email lists" ON email_lists;
DROP POLICY IF EXISTS "Super admins can create email lists" ON email_lists;
DROP POLICY IF EXISTS "Super admins can update email lists" ON email_lists;
DROP POLICY IF EXISTS "Super admins can delete email lists" ON email_lists;

-- Step 5: Create new organization-aware RLS policies

-- SELECT policies
CREATE POLICY "Super admins view all lists"
ON email_lists FOR SELECT
TO authenticated
USING (is_super_admin(auth.uid()));

CREATE POLICY "Association managers view their lists"
ON email_lists FOR SELECT
TO authenticated
USING (
  association_id IN (
    SELECT association_id FROM association_managers
    WHERE user_id = auth.uid() AND is_active = true
  )
);

CREATE POLICY "Company admins view their lists"
ON email_lists FOR SELECT
TO authenticated
USING (
  company_id IN (
    SELECT company_id FROM members
    WHERE user_id = auth.uid() 
    AND role IN ('owner', 'admin')
    AND is_active = true
  )
);

-- INSERT policies
CREATE POLICY "Association managers create lists"
ON email_lists FOR INSERT
TO authenticated
WITH CHECK (
  association_id IN (
    SELECT association_id FROM association_managers
    WHERE user_id = auth.uid() AND is_active = true
  )
  AND created_by = auth.uid()
  AND company_id IS NULL
);

CREATE POLICY "Company admins create lists"
ON email_lists FOR INSERT
TO authenticated
WITH CHECK (
  company_id IN (
    SELECT company_id FROM members
    WHERE user_id = auth.uid() 
    AND role IN ('owner', 'admin')
    AND is_active = true
  )
  AND created_by = auth.uid()
  AND association_id IS NULL
);

CREATE POLICY "Super admins create lists"
ON email_lists FOR INSERT
TO authenticated
WITH CHECK (
  is_super_admin(auth.uid())
  AND created_by = auth.uid()
);

-- UPDATE policies
CREATE POLICY "Users update their organization lists"
ON email_lists FOR UPDATE
TO authenticated
USING (
  is_super_admin(auth.uid())
  OR association_id IN (
    SELECT association_id FROM association_managers
    WHERE user_id = auth.uid() AND is_active = true
  )
  OR company_id IN (
    SELECT company_id FROM members
    WHERE user_id = auth.uid() 
    AND role IN ('owner', 'admin')
    AND is_active = true
  )
);

-- DELETE policies
CREATE POLICY "Users delete their organization lists"
ON email_lists FOR DELETE
TO authenticated
USING (
  is_super_admin(auth.uid())
  OR association_id IN (
    SELECT association_id FROM association_managers
    WHERE user_id = auth.uid() AND is_active = true
  )
  OR company_id IN (
    SELECT company_id FROM members
    WHERE user_id = auth.uid() 
    AND role IN ('owner', 'admin')
    AND is_active = true
  )
);