-- P2: Hard delete users RPC (DB portion only)
-- Same pattern as existing hard_delete_companies/associations
-- Edge function handles Auth user deletion + password verification

CREATE OR REPLACE FUNCTION public.hard_delete_users_db(
  p_admin_user_id UUID,
  p_user_ids UUID[],
  p_notes TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_success INT := 0;
  v_failed INT := 0;
  v_errors TEXT[] := '{}';
BEGIN
  -- Verify super admin
  IF NOT EXISTS (
    SELECT 1 FROM admin_users
    WHERE user_id = p_admin_user_id AND is_active = true AND is_super_admin = true
  ) THEN
    RETURN jsonb_build_object('success', 0, 'failed', 0, 'errors', ARRAY['Super admin access required']);
  END IF;

  FOREACH v_user_id IN ARRAY p_user_ids
  LOOP
    BEGIN
      -- Delete related records (order matters for FK constraints)
      DELETE FROM members WHERE user_id = v_user_id;
      DELETE FROM admin_users WHERE user_id = v_user_id;
      DELETE FROM association_managers WHERE user_id = v_user_id;
      DELETE FROM company_admins WHERE user_id = v_user_id;
      DELETE FROM profiles WHERE id = v_user_id;

      -- Audit log
      INSERT INTO audit_logs (user_id, action, resource, resource_id, changes)
      VALUES (p_admin_user_id, 'hard_delete', 'user', v_user_id,
              jsonb_build_object('deletion_notes', p_notes));

      v_success := v_success + 1;
    EXCEPTION WHEN OTHERS THEN
      v_failed := v_failed + 1;
      v_errors := array_append(v_errors, v_user_id::TEXT || ': ' || SQLERRM);
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'success', v_success,
    'failed', v_failed,
    'errors', to_jsonb(v_errors)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.hard_delete_users_db(UUID, UUID[], TEXT) TO service_role;
