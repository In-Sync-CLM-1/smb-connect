-- Fix: add extensions to search_path so gen_random_bytes() resolves correctly
-- pgcrypto is installed in the extensions schema in Supabase Cloud

CREATE OR REPLACE FUNCTION public.create_invite_link(
  p_organization_id UUID,
  p_organization_type TEXT,
  p_role TEXT DEFAULT 'member',
  p_expires_at TIMESTAMPTZ DEFAULT NULL,
  p_max_uses INTEGER DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_has_permission BOOLEAN := FALSE;
  v_token TEXT;
  v_link_id UUID;
  v_org_name TEXT;
BEGIN
  IF p_organization_type = 'association' THEN
    SELECT EXISTS (
      SELECT 1 FROM association_managers am
      WHERE am.association_id = p_organization_id
        AND am.user_id = v_user_id AND am.is_active = true
    ) INTO v_has_permission;
    SELECT name INTO v_org_name FROM associations WHERE id = p_organization_id;
  ELSIF p_organization_type = 'company' THEN
    SELECT EXISTS (
      SELECT 1 FROM members m
      WHERE m.company_id = p_organization_id
        AND m.user_id = v_user_id
        AND m.role IN ('owner', 'admin') AND m.is_active = true
    ) INTO v_has_permission;
    SELECT name INTO v_org_name FROM companies WHERE id = p_organization_id;
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Invalid organization type');
  END IF;

  IF NOT v_has_permission THEN
    SELECT EXISTS (
      SELECT 1 FROM admin_users WHERE user_id = v_user_id AND is_active = true
    ) INTO v_has_permission;
  END IF;

  IF NOT v_has_permission THEN
    RETURN jsonb_build_object('success', false, 'error', 'Permission denied');
  END IF;

  -- Deactivate existing active links for this org
  UPDATE invite_links
  SET is_active = false
  WHERE organization_id = p_organization_id
    AND organization_type = p_organization_type
    AND is_active = true;

  v_token := encode(gen_random_bytes(16), 'hex');

  INSERT INTO invite_links (
    organization_id, organization_type, token, role, max_uses, expires_at, created_by
  ) VALUES (
    p_organization_id, p_organization_type, v_token, p_role, p_max_uses, p_expires_at, v_user_id
  )
  RETURNING id INTO v_link_id;

  RETURN jsonb_build_object(
    'success', true,
    'id', v_link_id,
    'token', v_token,
    'organization_name', v_org_name
  );
END;
$$;
