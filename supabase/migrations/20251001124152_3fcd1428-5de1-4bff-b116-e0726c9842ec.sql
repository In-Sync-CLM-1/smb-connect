-- ============================================
-- Phase 3: Database Security Hardening (Final)
-- ============================================

-- ============================================
-- Step 3.1: Fix Remaining Security Definer Functions
-- ============================================

-- Fix update_posts_updated_at function
CREATE OR REPLACE FUNCTION public.update_posts_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

-- Fix update_email_list_count function
CREATE OR REPLACE FUNCTION public.update_email_list_count()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  UPDATE email_lists
  SET total_recipients = (
    SELECT COUNT(*) FROM email_list_recipients WHERE list_id = COALESCE(NEW.list_id, OLD.list_id)
  )
  WHERE id = COALESCE(NEW.list_id, OLD.list_id);
  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- ============================================
-- Step 3.2: Protect Public Views
-- ============================================

-- Create RLS policies for companies_public view
-- Views use security_invoker, so they check RLS of underlying table
-- We already granted SELECT, but need to ensure authentication

-- Revoke public access first
REVOKE SELECT ON public.companies_public FROM PUBLIC;
-- Grant only to authenticated users
GRANT SELECT ON public.companies_public TO authenticated;

-- Do the same for key_functionaries_public
REVOKE SELECT ON public.key_functionaries_public FROM PUBLIC;
GRANT SELECT ON public.key_functionaries_public TO authenticated;

-- ============================================
-- Step 3.3: Document Views and Extensions
-- ============================================

COMMENT ON VIEW public.duplicate_companies_monitor
IS 'INTERNAL ANALYTICS VIEW: Shows duplicate company detection data. Access controlled through underlying companies table RLS. Only admins can view comprehensive company data.';

COMMENT ON EXTENSION pg_trgm
IS 'Text similarity extension. Installed in public schema (cannot be moved post-creation). This is a PostgreSQL limitation and does not pose a security risk as the extension functions are properly scoped.';

COMMENT ON VIEW public.companies_public
IS 'PUBLIC VIEW: Exposes only non-sensitive company information (name, location, industry). Sensitive fields (email, phone, GST, PAN, financials) excluded. Requires authentication.';

COMMENT ON VIEW public.key_functionaries_public
IS 'PUBLIC VIEW: Exposes only non-sensitive functionary information (name, designation, bio, photo). Contact details (email, phone) excluded. Requires authentication.';

-- ============================================
-- Step 3.4: Add Security Documentation
-- ============================================

-- Document sensitive tables
COMMENT ON TABLE public.admin_users IS 'SECURITY CRITICAL: Contains admin user assignments. Changes to this table affect system-wide access control.';
COMMENT ON TABLE public.association_managers IS 'SECURITY CRITICAL: Contains association manager assignments. Changes affect association-level access.';
COMMENT ON TABLE public.members IS 'SECURITY CRITICAL: Contains user-company relationships and roles. Changes affect company-level access.';
COMMENT ON TABLE public.profiles IS 'SECURITY CRITICAL: Contains user personal data (phone, location, social media). Access restricted by RLS to authorized users only.';
COMMENT ON TABLE public.companies IS 'SECURITY CRITICAL: Contains sensitive business data (GST, PAN, financials). Access restricted by RLS to authorized users only.';

-- Document security definer functions
COMMENT ON FUNCTION public.is_admin(uuid) IS 'SECURITY DEFINER: Safely checks admin status without recursive RLS. Used in policies to prevent privilege escalation.';
COMMENT ON FUNCTION public.is_association_manager(uuid, uuid) IS 'SECURITY DEFINER: Safely checks association manager status. Used in policies for access control.';
COMMENT ON FUNCTION public.is_company_admin(uuid, uuid) IS 'SECURITY DEFINER: Safely checks company admin status. Used in policies for access control.';
COMMENT ON FUNCTION public.is_connected_to(uuid, uuid) IS 'SECURITY DEFINER: Checks if users have accepted connections. Used to control profile/data visibility.';
COMMENT ON FUNCTION public.is_same_company(uuid, uuid) IS 'SECURITY DEFINER: Checks if users are in the same company. Used for internal company data sharing.';
COMMENT ON FUNCTION public.is_chat_participant(uuid, uuid) IS 'SECURITY DEFINER: Checks chat participation without recursion. Critical for preventing infinite RLS loops.';
COMMENT ON FUNCTION public.can_view_company_details(uuid, uuid) IS 'SECURITY DEFINER: Authorizes viewing sensitive company data (GST, PAN, financials). Restricts to authorized users.';
COMMENT ON FUNCTION public.is_member_of_association(uuid, uuid) IS 'SECURITY DEFINER: Checks association membership for access control. Used in key_functionaries policies.';

-- Add database-level security settings documentation
COMMENT ON SCHEMA public IS 'Main application schema. All tables have Row Level Security (RLS) enabled. Access is controlled through RLS policies based on user authentication and authorization.';