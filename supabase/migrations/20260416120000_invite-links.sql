-- Invite Links: shareable join links for associations and companies
-- Creates invite_links table + 4 RPCs (create, get details, accept, revoke)

-- ============================================================
-- 1. Table
-- ============================================================
CREATE TABLE invite_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  organization_type TEXT NOT NULL CHECK (organization_type IN ('association', 'company')),
  token TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'member',
  max_uses INTEGER DEFAULT NULL,
  use_count INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ DEFAULT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_invite_links_token ON invite_links(token) WHERE is_active = true;
CREATE INDEX idx_invite_links_organization ON invite_links(organization_id, organization_type);

-- ============================================================
-- 2. RLS
-- ============================================================
ALTER TABLE invite_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org admins can view their invite links"
  ON invite_links FOR SELECT
  USING (
    is_admin(auth.uid())
    OR (
      organization_type = 'association' AND EXISTS (
        SELECT 1 FROM association_managers am
        WHERE am.association_id = invite_links.organization_id
          AND am.user_id = auth.uid()
          AND am.is_active = true
      )
    )
    OR (
      organization_type = 'company' AND EXISTS (
        SELECT 1 FROM members m
        WHERE m.company_id = invite_links.organization_id
          AND m.user_id = auth.uid()
          AND m.role IN ('owner', 'admin')
          AND m.is_active = true
      )
    )
  );

-- ============================================================
-- 3. RPC: create_invite_link
--    Creates (or replaces) an active invite link for an org.
--    Returns { success, id, token, organization_name }
-- ============================================================
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
SET search_path = public
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

-- ============================================================
-- 4. RPC: get_invite_link_details (PUBLIC — no auth required)
--    Returns org info for a valid token without consuming it.
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_invite_link_details(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link invite_links%ROWTYPE;
  v_org_name TEXT;
  v_org_logo TEXT;
BEGIN
  SELECT * INTO v_link FROM invite_links WHERE token = p_token AND is_active = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Invite link not found or inactive');
  END IF;

  IF v_link.expires_at IS NOT NULL AND v_link.expires_at < NOW() THEN
    RETURN jsonb_build_object('valid', false, 'error', 'This invite link has expired');
  END IF;

  IF v_link.max_uses IS NOT NULL AND v_link.use_count >= v_link.max_uses THEN
    RETURN jsonb_build_object('valid', false, 'error', 'This invite link has reached its maximum uses');
  END IF;

  IF v_link.organization_type = 'association' THEN
    SELECT name, logo INTO v_org_name, v_org_logo FROM associations WHERE id = v_link.organization_id;
  ELSIF v_link.organization_type = 'company' THEN
    SELECT name, logo INTO v_org_name, v_org_logo FROM companies WHERE id = v_link.organization_id;
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'id', v_link.id,
    'organization_id', v_link.organization_id,
    'organization_type', v_link.organization_type,
    'organization_name', v_org_name,
    'organization_logo', v_org_logo,
    'role', v_link.role,
    'max_uses', v_link.max_uses,
    'use_count', v_link.use_count,
    'expires_at', v_link.expires_at,
    'created_at', v_link.created_at
  );
END;
$$;

-- ============================================================
-- 5. RPC: accept_invite_link (requires auth)
--    Creates membership and increments use_count atomically.
--    Returns { success, organization_name, organization_type }
--    or { success: false, already_member: true } if already joined.
-- ============================================================
CREATE OR REPLACE FUNCTION public.accept_invite_link(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_link invite_links%ROWTYPE;
  v_org_name TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Must be logged in to join');
  END IF;

  SELECT * INTO v_link FROM invite_links
  WHERE token = p_token AND is_active = true
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invite link not found or inactive');
  END IF;

  IF v_link.expires_at IS NOT NULL AND v_link.expires_at < NOW() THEN
    RETURN jsonb_build_object('success', false, 'error', 'This invite link has expired');
  END IF;

  IF v_link.max_uses IS NOT NULL AND v_link.use_count >= v_link.max_uses THEN
    RETURN jsonb_build_object('success', false, 'error', 'This invite link has reached its maximum uses');
  END IF;

  IF v_link.organization_type = 'company' THEN
    IF EXISTS (
      SELECT 1 FROM members
      WHERE user_id = v_user_id AND company_id = v_link.organization_id AND is_active = true
    ) THEN
      SELECT name INTO v_org_name FROM companies WHERE id = v_link.organization_id;
      RETURN jsonb_build_object(
        'success', false, 'already_member', true,
        'organization_name', v_org_name,
        'organization_type', v_link.organization_type
      );
    END IF;

    INSERT INTO members (user_id, company_id, role, is_active)
    VALUES (v_user_id, v_link.organization_id, v_link.role, true);

    SELECT name INTO v_org_name FROM companies WHERE id = v_link.organization_id;

  ELSIF v_link.organization_type = 'association' THEN
    IF EXISTS (
      SELECT 1 FROM association_managers
      WHERE user_id = v_user_id AND association_id = v_link.organization_id AND is_active = true
    ) THEN
      SELECT name INTO v_org_name FROM associations WHERE id = v_link.organization_id;
      RETURN jsonb_build_object(
        'success', false, 'already_member', true,
        'organization_name', v_org_name,
        'organization_type', v_link.organization_type
      );
    END IF;

    INSERT INTO association_managers (user_id, association_id, role, is_active)
    VALUES (v_user_id, v_link.organization_id, v_link.role, true);

    SELECT name INTO v_org_name FROM associations WHERE id = v_link.organization_id;
  END IF;

  UPDATE invite_links SET use_count = use_count + 1 WHERE id = v_link.id;

  RETURN jsonb_build_object(
    'success', true,
    'organization_name', v_org_name,
    'organization_type', v_link.organization_type
  );
END;
$$;

-- ============================================================
-- 6. RPC: revoke_invite_link (requires auth, org admin only)
-- ============================================================
CREATE OR REPLACE FUNCTION public.revoke_invite_link(p_link_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_link invite_links%ROWTYPE;
  v_has_permission BOOLEAN := FALSE;
BEGIN
  SELECT * INTO v_link FROM invite_links WHERE id = p_link_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Link not found');
  END IF;

  IF v_link.organization_type = 'association' THEN
    SELECT EXISTS (
      SELECT 1 FROM association_managers am
      WHERE am.association_id = v_link.organization_id
        AND am.user_id = v_user_id AND am.is_active = true
    ) INTO v_has_permission;
  ELSIF v_link.organization_type = 'company' THEN
    SELECT EXISTS (
      SELECT 1 FROM members m
      WHERE m.company_id = v_link.organization_id
        AND m.user_id = v_user_id
        AND m.role IN ('owner', 'admin') AND m.is_active = true
    ) INTO v_has_permission;
  END IF;

  IF NOT v_has_permission THEN
    SELECT EXISTS (
      SELECT 1 FROM admin_users WHERE user_id = v_user_id AND is_active = true
    ) INTO v_has_permission;
  END IF;

  IF NOT v_has_permission THEN
    RETURN jsonb_build_object('success', false, 'error', 'Permission denied');
  END IF;

  UPDATE invite_links SET is_active = false WHERE id = p_link_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ============================================================
-- 7. Permissions
-- ============================================================
GRANT EXECUTE ON FUNCTION public.create_invite_link TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_invite_link_details TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_invite_link TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_invite_link TO authenticated;
