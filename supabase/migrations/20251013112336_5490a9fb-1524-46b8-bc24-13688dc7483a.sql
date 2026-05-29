-- Create function to check if user can send emails
CREATE OR REPLACE FUNCTION public.can_send_emails(check_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Check if Super Admin
  IF EXISTS (
    SELECT 1 FROM admin_users
    WHERE user_id = check_user_id 
    AND is_super_admin = true 
    AND is_active = true
  ) THEN
    RETURN true;
  END IF;
  
  -- Check if Association Manager
  IF EXISTS (
    SELECT 1 FROM association_managers
    WHERE user_id = check_user_id 
    AND is_active = true
  ) THEN
    RETURN true;
  END IF;
  
  -- Check if Company Admin
  IF EXISTS (
    SELECT 1 FROM members
    WHERE user_id = check_user_id 
    AND role IN ('owner', 'admin')
    AND is_active = true
  ) THEN
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$;

-- Add RLS policy for email conversations - only authorized users can create
DROP POLICY IF EXISTS "Only authorized users can create email conversations" ON email_conversations;
CREATE POLICY "Only authorized users can create email conversations"
ON email_conversations FOR INSERT
TO authenticated
WITH CHECK (can_send_emails(auth.uid()));

-- Add RLS policy for email lists - only authorized users can manage
DROP POLICY IF EXISTS "Only authorized users can manage email lists" ON email_lists;
CREATE POLICY "Only authorized users can manage email lists"
ON email_lists FOR ALL
TO authenticated
USING (can_send_emails(auth.uid()))
WITH CHECK (can_send_emails(auth.uid()));

-- Add RLS policy for email list recipients - only authorized users can manage
DROP POLICY IF EXISTS "Only authorized users can manage recipients" ON email_list_recipients;
CREATE POLICY "Only authorized users can manage recipients"
ON email_list_recipients FOR ALL
TO authenticated
USING (
  list_id IN (
    SELECT id FROM email_lists WHERE can_send_emails(auth.uid())
  )
)
WITH CHECK (
  list_id IN (
    SELECT id FROM email_lists WHERE can_send_emails(auth.uid())
  )
);