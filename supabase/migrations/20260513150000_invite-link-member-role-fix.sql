-- Fix: invite link joiners should be assigned 'member', not auto-promoted to association manager.
-- 1) Rewrites accept_invite_link to mirror the email-invitation logic for associations:
--    - Only adds to association_managers when role is admin/manager
--    - Always inserts a members row for association joiners
-- 2) Updates already-issued active association invite links from role='manager' to 'member'
-- 3) Deactivates already-wrongly-promoted association_managers rows that came from invite links
--    (role='manager', no matching accepted admin/manager email invitation) and backfills a
--    members row for them if missing.

-- ============================================================
-- 1) accept_invite_link RPC
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
    IF v_link.role IN ('admin', 'manager') THEN
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

      INSERT INTO members (user_id, role, is_active)
      VALUES (v_user_id, v_link.role, true);
    ELSE
      IF EXISTS (
        SELECT 1 FROM members
        WHERE user_id = v_user_id
          AND company_id IS NULL
          AND is_active = true
      ) THEN
        SELECT name INTO v_org_name FROM associations WHERE id = v_link.organization_id;
        RETURN jsonb_build_object(
          'success', false, 'already_member', true,
          'organization_name', v_org_name,
          'organization_type', v_link.organization_type
        );
      END IF;

      INSERT INTO members (user_id, role, is_active)
      VALUES (v_user_id, v_link.role, true);
    END IF;

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

GRANT EXECUTE ON FUNCTION public.accept_invite_link(TEXT) TO authenticated;

-- ============================================================
-- 2) Update existing active association invite links to use 'member'
-- ============================================================
UPDATE invite_links
SET role = 'member'
WHERE organization_type = 'association'
  AND is_active = true
  AND role = 'manager';

-- ============================================================
-- 3) Demote already-wrongly-promoted association_managers
--    Heuristic: role='manager', is_active=true, and NO matching accepted
--    admin/manager email invitation for that user+association.
--    These were almost certainly created by the buggy accept_invite_link.
-- ============================================================
WITH wrongly_promoted AS (
  SELECT am.id, am.user_id, am.association_id
  FROM association_managers am
  WHERE am.role = 'manager'
    AND am.is_active = true
    AND NOT EXISTS (
      SELECT 1
      FROM member_invitations mi
      WHERE mi.organization_type = 'association'
        AND mi.organization_id = am.association_id
        AND mi.accepted_by = am.user_id
        AND mi.status = 'accepted'
        AND mi.role IN ('admin', 'manager')
    )
),
deactivated AS (
  UPDATE association_managers am
  SET is_active = false,
      updated_at = NOW()
  FROM wrongly_promoted wp
  WHERE am.id = wp.id
  RETURNING am.user_id
)
INSERT INTO members (user_id, role, is_active)
SELECT DISTINCT d.user_id, 'member', true
FROM deactivated d
WHERE NOT EXISTS (
  SELECT 1 FROM members m
  WHERE m.user_id = d.user_id
    AND m.company_id IS NULL
    AND m.is_active = true
);
