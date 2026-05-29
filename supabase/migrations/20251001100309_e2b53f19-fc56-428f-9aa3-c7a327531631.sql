-- Create function to check if user is super admin
CREATE OR REPLACE FUNCTION public.is_super_admin(check_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM admin_users
    WHERE user_id = check_user_id 
    AND is_super_admin = true 
    AND is_active = true
  );
END;
$function$;

-- Add DELETE policies for super admins on associations
CREATE POLICY "Super admins can delete associations"
  ON associations FOR DELETE
  USING (is_super_admin(auth.uid()));

-- Add DELETE policies for super admins on companies  
CREATE POLICY "Super admins can delete companies"
  ON companies FOR DELETE
  USING (is_super_admin(auth.uid()));

-- Add DELETE policies for super admins on members
CREATE POLICY "Super admins can delete members"
  ON members FOR DELETE
  USING (is_super_admin(auth.uid()));