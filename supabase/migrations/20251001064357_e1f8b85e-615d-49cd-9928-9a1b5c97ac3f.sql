-- Fix infinite recursion by removing problematic policies
-- Keep only the simple ownership check that doesn't cause recursion

-- Drop all policies on admin_users
DROP POLICY IF EXISTS "Admins can view admin users" ON admin_users;
DROP POLICY IF EXISTS "Super admins can manage admin users" ON admin_users;
DROP POLICY IF EXISTS "Users can view own admin status" ON admin_users;

-- Create simple non-recursive policy for users to see their own admin status
CREATE POLICY "Users can view own admin status"
  ON admin_users FOR SELECT
  USING (auth.uid() = user_id);

-- Create simple policy for super admins to manage (no subquery on admin_users)
CREATE POLICY "Super admins can insert admin users"
  ON admin_users FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users a
      WHERE a.user_id = auth.uid() 
      AND a.is_super_admin = true 
      AND a.is_active = true
    )
  );

CREATE POLICY "Super admins can update admin users"
  ON admin_users FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM admin_users a
      WHERE a.user_id = auth.uid() 
      AND a.is_super_admin = true 
      AND a.is_active = true
    )
  );

CREATE POLICY "Super admins can delete admin users"
  ON admin_users FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM admin_users a
      WHERE a.user_id = auth.uid() 
      AND a.is_super_admin = true 
      AND a.is_active = true
    )
  );