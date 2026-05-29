-- Secure company_invitations table with RLS policies
-- This prevents email harvesting and unauthorized access to invitation tokens

-- Enable RLS on company_invitations (should already be enabled, but making sure)
ALTER TABLE company_invitations ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies to start fresh
DROP POLICY IF EXISTS "Admins can view all invitations" ON company_invitations;
DROP POLICY IF EXISTS "Admins can manage invitations" ON company_invitations;
DROP POLICY IF EXISTS "Association managers can view their invitations" ON company_invitations;
DROP POLICY IF EXISTS "Association managers can create invitations" ON company_invitations;
DROP POLICY IF EXISTS "Association managers can update their invitations" ON company_invitations;
DROP POLICY IF EXISTS "Users can view invitations sent to their email" ON company_invitations;
DROP POLICY IF EXISTS "Invited users can accept their invitations" ON company_invitations;

-- 1. Admins can view and manage all invitations
CREATE POLICY "Admins can view all invitations"
  ON company_invitations FOR SELECT
  USING (is_admin(auth.uid()));

CREATE POLICY "Admins can manage invitations"
  ON company_invitations FOR ALL
  USING (is_admin(auth.uid()));

-- 2. Association managers can view invitations for their associations
CREATE POLICY "Association managers can view their invitations"
  ON company_invitations FOR SELECT
  USING (is_association_manager(auth.uid(), association_id));

-- 3. Association managers can create invitations for their associations
CREATE POLICY "Association managers can create invitations"
  ON company_invitations FOR INSERT
  WITH CHECK (is_association_manager(auth.uid(), association_id));

-- 4. Association managers can update invitations for their associations
CREATE POLICY "Association managers can update their invitations"
  ON company_invitations FOR UPDATE
  USING (is_association_manager(auth.uid(), association_id));

-- 5. Users can view invitations sent to their email address
-- This allows invited users to see their own invitations
CREATE POLICY "Users can view invitations sent to their email"
  ON company_invitations FOR SELECT
  USING (
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- 6. Invited users can update their own invitations (to accept them)
CREATE POLICY "Invited users can accept their invitations"
  ON company_invitations FOR UPDATE
  USING (
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
    AND status = 'pending'
  )
  WITH CHECK (
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
    AND status IN ('accepted', 'pending')
  );