-- ==================== ADMIN & HIERARCHY TABLES ====================

-- System Admins Table
CREATE TABLE admin_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  is_super_admin BOOLEAN DEFAULT false,
  permissions JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Association Managers Table  
CREATE TABLE association_managers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  association_id UUID NOT NULL REFERENCES associations(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'manager', -- 'owner', 'manager'
  permissions JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, association_id)
);

-- Add association_id to profiles for context
ALTER TABLE profiles ADD COLUMN current_context TEXT DEFAULT 'member'; -- 'admin', 'association', 'company', 'member'

-- Create indexes
CREATE INDEX idx_admin_users_user ON admin_users(user_id, is_active);
CREATE INDEX idx_association_managers_user ON association_managers(user_id, association_id);
CREATE INDEX idx_association_managers_association ON association_managers(association_id, is_active);

-- Triggers for updated_at
CREATE TRIGGER update_admin_users_updated_at BEFORE UPDATE ON admin_users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_association_managers_updated_at BEFORE UPDATE ON association_managers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ==================== HELPER FUNCTIONS ====================

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin(check_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM admin_users
    WHERE user_id = check_user_id AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user is association manager
CREATE OR REPLACE FUNCTION is_association_manager(check_user_id UUID, check_association_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM association_managers
    WHERE user_id = check_user_id 
    AND association_id = check_association_id
    AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user is company owner/admin
CREATE OR REPLACE FUNCTION is_company_admin(check_user_id UUID, check_company_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM members
    WHERE user_id = check_user_id 
    AND company_id = check_company_id
    AND role IN ('owner', 'admin')
    AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user role context
CREATE OR REPLACE FUNCTION get_user_role_context(check_user_id UUID)
RETURNS TEXT AS $$
BEGIN
  -- Check if admin
  IF EXISTS (SELECT 1 FROM admin_users WHERE user_id = check_user_id AND is_active = true) THEN
    RETURN 'admin';
  END IF;
  
  -- Check if association manager
  IF EXISTS (SELECT 1 FROM association_managers WHERE user_id = check_user_id AND is_active = true) THEN
    RETURN 'association';
  END IF;
  
  -- Check if company owner/admin
  IF EXISTS (SELECT 1 FROM members WHERE user_id = check_user_id AND role IN ('owner', 'admin') AND is_active = true) THEN
    RETURN 'company';
  END IF;
  
  -- Default to member
  RETURN 'member';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==================== ENABLE RLS ====================

ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE association_managers ENABLE ROW LEVEL SECURITY;

-- ==================== ADMIN POLICIES ====================

-- Admins can view all admin users
CREATE POLICY "Admins can view admin users"
  ON admin_users FOR SELECT
  USING (is_admin(auth.uid()));

-- Super admins can manage admin users
CREATE POLICY "Super admins can manage admin users"
  ON admin_users FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE user_id = auth.uid() AND is_super_admin = true AND is_active = true
    )
  );

-- Users can view their own admin status
CREATE POLICY "Users can view own admin status"
  ON admin_users FOR SELECT
  USING (auth.uid() = user_id);

-- ==================== ASSOCIATION MANAGER POLICIES ====================

-- Admins can view all association managers
CREATE POLICY "Admins can view all association managers"
  ON association_managers FOR SELECT
  USING (is_admin(auth.uid()));

-- Association owners can view managers in their association
CREATE POLICY "Association owners can view their managers"
  ON association_managers FOR SELECT
  USING (
    is_association_manager(auth.uid(), association_id) OR
    auth.uid() = user_id
  );

-- Admins and association owners can manage association managers
CREATE POLICY "Admins can manage association managers"
  ON association_managers FOR ALL
  USING (
    is_admin(auth.uid()) OR
    (is_association_manager(auth.uid(), association_id) AND 
     EXISTS (SELECT 1 FROM association_managers WHERE user_id = auth.uid() AND association_id = association_managers.association_id AND role = 'owner'))
  );

-- ==================== UPDATED ASSOCIATIONS POLICIES ====================

-- Drop old policy and create new ones
DROP POLICY IF EXISTS "Members can view associations" ON associations;

-- Admins can view all associations
CREATE POLICY "Admins can view all associations"
  ON associations FOR SELECT
  USING (is_admin(auth.uid()));

-- Association managers can view their associations
CREATE POLICY "Association managers can view their associations"
  ON associations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM association_managers
      WHERE association_managers.association_id = associations.id
      AND association_managers.user_id = auth.uid()
      AND association_managers.is_active = true
    )
  );

-- Company members can view their association
CREATE POLICY "Members can view their association"
  ON associations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM members m
      JOIN companies c ON m.company_id = c.id
      WHERE c.association_id = associations.id
      AND m.user_id = auth.uid()
      AND m.is_active = true
    )
  );

-- Admins can manage all associations
CREATE POLICY "Admins can manage associations"
  ON associations FOR ALL
  USING (is_admin(auth.uid()));

-- Association owners can manage their association
CREATE POLICY "Association owners can manage their association"
  ON associations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM association_managers
      WHERE association_managers.association_id = associations.id
      AND association_managers.user_id = auth.uid()
      AND association_managers.role = 'owner'
      AND association_managers.is_active = true
    )
  );

-- ==================== UPDATED COMPANIES POLICIES ====================

-- Drop old policies and create new hierarchy-aware ones
DROP POLICY IF EXISTS "Users can view companies in their association" ON companies;
DROP POLICY IF EXISTS "Company owners can update company" ON companies;
DROP POLICY IF EXISTS "Users can create companies" ON companies;

-- Admins can view all companies
CREATE POLICY "Admins can view all companies"
  ON companies FOR SELECT
  USING (is_admin(auth.uid()));

-- Association managers can view companies in their associations
CREATE POLICY "Association managers can view their companies"
  ON companies FOR SELECT
  USING (
    is_association_manager(auth.uid(), association_id)
  );

-- Company members can view companies in same association
CREATE POLICY "Members can view companies in association"
  ON companies FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM members m
      JOIN companies c ON m.company_id = c.id
      WHERE c.association_id = companies.association_id
      AND m.user_id = auth.uid()
      AND m.is_active = true
    )
  );

-- Admins and association managers can create companies
CREATE POLICY "Admins and association managers can create companies"
  ON companies FOR INSERT
  WITH CHECK (
    is_admin(auth.uid()) OR
    is_association_manager(auth.uid(), association_id)
  );

-- Admins, association managers, and company admins can update companies
CREATE POLICY "Hierarchy can update companies"
  ON companies FOR UPDATE
  USING (
    is_admin(auth.uid()) OR
    is_association_manager(auth.uid(), association_id) OR
    is_company_admin(auth.uid(), id)
  );

-- ==================== SEED ADMIN ====================

-- Create a super admin user (you'll need to create this user in auth first)
-- This is just a placeholder - actual admin will be created via signup
INSERT INTO associations (name, contact_email, description, city, state) 
VALUES (
  'SMB Connect Platform',
  'admin@smbconnect.com',
  'Main platform association for system administration',
  'Mumbai',
  'Maharashtra'
) ON CONFLICT DO NOTHING;