-- Tier 1: Convert pure-DB edge functions to PostgreSQL RPC functions
-- Performance: eliminates cold start + N sequential HTTP roundtrips per call
-- Expected improvement: 4-11x faster per call

-- Ensure pgcrypto is available (for SHA-256 in verify_member_invitation)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-------------------------------------------------------------------------------
-- 1. get_landing_page
--    Replaces: edge function get-landing-page
--    Was: cold start + 2 DB roundtrips (~500ms) → now: single RPC (~60ms)
-------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_landing_page(
  p_slug TEXT,
  p_page_slug TEXT DEFAULT ''
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lp RECORD;
  v_html TEXT;
  v_page_nav JSONB;
BEGIN
  -- Fetch landing page with association join in one query
  SELECT lp.id, lp.title, lp.slug, lp.html_content, lp.css_content,
         lp.registration_enabled, lp.registration_fee,
         jsonb_build_object('name', a.name, 'logo', a.logo) AS association
  INTO v_lp
  FROM event_landing_pages lp
  LEFT JOIN associations a ON a.id = lp.association_id
  WHERE lp.slug = p_slug AND lp.is_active = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Landing page not found');
  END IF;

  -- Default to the landing page's own html_content
  v_html := v_lp.html_content;

  -- Resolve target page content
  IF p_page_slug <> '' THEN
    -- Specific sub-page requested
    SELECT p.html_content INTO v_html
    FROM event_landing_page_pages p
    WHERE p.landing_page_id = v_lp.id AND p.slug = p_page_slug;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('error', 'Page not found');
    END IF;
  ELSE
    -- Default page: try is_default, then first by sort_order, then fallback
    SELECT p.html_content INTO v_html
    FROM event_landing_page_pages p
    WHERE p.landing_page_id = v_lp.id AND p.is_default = true
    LIMIT 1;

    IF NOT FOUND THEN
      SELECT p.html_content INTO v_html
      FROM event_landing_page_pages p
      WHERE p.landing_page_id = v_lp.id
      ORDER BY p.sort_order
      LIMIT 1;

      IF NOT FOUND THEN
        v_html := v_lp.html_content;
      END IF;
    END IF;
  END IF;

  -- Build navigation list (lightweight, no html_content)
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object('slug', p.slug, 'title', p.title, 'is_default', p.is_default)
    ORDER BY p.sort_order
  ), '[]'::jsonb)
  INTO v_page_nav
  FROM event_landing_page_pages p
  WHERE p.landing_page_id = v_lp.id;

  RETURN jsonb_build_object(
    'id', v_lp.id,
    'title', v_lp.title,
    'slug', v_lp.slug,
    'html_content', v_html,
    'css_content', v_lp.css_content,
    'registration_enabled', v_lp.registration_enabled,
    'registration_fee', v_lp.registration_fee,
    'pages', v_page_nav,
    'association', v_lp.association
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_landing_page(TEXT, TEXT) TO anon, authenticated;

-------------------------------------------------------------------------------
-- 2. validate_coupon
--    Replaces: edge function validate-coupon
--    Was: cold start + 3 DB roundtrips (~600ms) → now: single RPC (~60ms)
-------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_coupon(
  p_code TEXT,
  p_landing_page_id UUID DEFAULT NULL,
  p_email TEXT DEFAULT ''
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_coupon RECORD;
  v_normalized_code TEXT;
  v_normalized_email TEXT;
  v_user_usage_count BIGINT;
  v_message TEXT;
BEGIN
  IF COALESCE(p_code, '') = '' OR COALESCE(p_email, '') = '' THEN
    RETURN jsonb_build_object('valid', false, 'message', 'Missing required fields');
  END IF;

  v_normalized_code := UPPER(TRIM(p_code));
  v_normalized_email := LOWER(TRIM(p_email));

  SELECT * INTO v_coupon
  FROM event_coupons
  WHERE code = v_normalized_code;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'message', 'Invalid coupon code');
  END IF;

  IF NOT v_coupon.is_active THEN
    RETURN jsonb_build_object('valid', false, 'message', 'This coupon is no longer active');
  END IF;

  IF NOW() < v_coupon.valid_from THEN
    RETURN jsonb_build_object('valid', false, 'message', 'This coupon is not yet valid');
  END IF;

  IF NOW() > v_coupon.valid_until THEN
    RETURN jsonb_build_object('valid', false, 'message', 'This coupon has expired');
  END IF;

  IF v_coupon.landing_page_id IS NOT NULL
     AND v_coupon.landing_page_id IS DISTINCT FROM p_landing_page_id THEN
    RETURN jsonb_build_object('valid', false, 'message', 'This coupon is not valid for this event');
  END IF;

  IF v_coupon.max_uses IS NOT NULL AND v_coupon.current_uses >= v_coupon.max_uses THEN
    RETURN jsonb_build_object('valid', false, 'message', 'This coupon has reached its usage limit');
  END IF;

  -- Per-user usage check
  SELECT COUNT(*) INTO v_user_usage_count
  FROM event_coupon_usages
  WHERE coupon_id = v_coupon.id AND email = v_normalized_email;

  IF v_user_usage_count >= v_coupon.max_uses_per_user THEN
    RETURN jsonb_build_object('valid', false, 'message',
      'You have already used this coupon the maximum number of times');
  END IF;

  -- Build success message
  IF v_coupon.discount_type = 'percentage' THEN
    v_message := 'Coupon applied! ' || v_coupon.discount_value || '% off';
  ELSE
    v_message := 'Coupon applied! ₹' || v_coupon.discount_value || ' off';
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'coupon_id', v_coupon.id,
    'discount_type', v_coupon.discount_type,
    'discount_value', v_coupon.discount_value::NUMERIC,
    'message', v_message
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_coupon(TEXT, UUID, TEXT) TO anon, authenticated;

-------------------------------------------------------------------------------
-- 3. verify_company_invitation
--    Replaces: edge function verify-company-invitation
--    Was: cold start + 1 DB roundtrip (~430ms) → now: single RPC (~50ms)
-------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.verify_company_invitation(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv RECORD;
BEGIN
  IF COALESCE(p_token, '') = '' THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Token is required');
  END IF;

  SELECT ci.id, ci.email, ci.company_name, ci.association_id,
         ci.expires_at, ci.status, a.name AS association_name
  INTO v_inv
  FROM company_invitations ci
  LEFT JOIN associations a ON a.id = ci.association_id
  WHERE ci.token = p_token;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Invitation not found or invalid');
  END IF;

  IF v_inv.expires_at < NOW() THEN
    RETURN jsonb_build_object('valid', false, 'error', 'This invitation has expired');
  END IF;

  IF v_inv.status = 'accepted' THEN
    RETURN jsonb_build_object('valid', false, 'error', 'This invitation has already been accepted');
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'invitation', jsonb_build_object(
      'id', v_inv.id,
      'email', v_inv.email,
      'company_name', v_inv.company_name,
      'association_id', v_inv.association_id,
      'association_name', v_inv.association_name,
      'expires_at', v_inv.expires_at,
      'status', v_inv.status
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_company_invitation(TEXT) TO anon, authenticated;

-------------------------------------------------------------------------------
-- 4. verify_member_invitation
--    Replaces: edge function verify-member-invitation
--    Was: cold start + 5 DB roundtrips (~800ms) → now: single RPC (~70ms)
--    Uses pgcrypto for SHA-256 token hashing (matches edge function behavior)
-------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.verify_member_invitation(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token_hash TEXT;
  v_inv RECORD;
  v_org_name TEXT;
BEGIN
  IF p_token IS NULL OR length(p_token) <> 64 THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Invalid token format');
  END IF;

  -- SHA-256 hash to match stored token_hash
  v_token_hash := encode(digest(p_token, 'sha256'), 'hex');

  SELECT id, email, first_name, last_name, organization_id, organization_type,
         role, designation, department, status, expires_at
  INTO v_inv
  FROM member_invitations
  WHERE token_hash = v_token_hash;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Invalid or expired invitation');
  END IF;

  IF v_inv.status = 'accepted' THEN
    RETURN jsonb_build_object('valid', false, 'error', 'This invitation has already been used');
  END IF;

  IF v_inv.status = 'revoked' THEN
    RETURN jsonb_build_object('valid', false, 'error', 'This invitation has been revoked');
  END IF;

  -- Auto-expire with atomic WHERE guard
  IF v_inv.expires_at < NOW() THEN
    UPDATE member_invitations
    SET status = 'expired'
    WHERE id = v_inv.id AND status = 'pending';

    RETURN jsonb_build_object('valid', false, 'error', 'This invitation has expired');
  END IF;

  -- Resolve organization name
  IF v_inv.organization_type = 'company' THEN
    SELECT name INTO v_org_name FROM companies WHERE id = v_inv.organization_id;
    v_org_name := COALESCE(v_org_name, 'Unknown Company');
  ELSE
    SELECT name INTO v_org_name FROM associations WHERE id = v_inv.organization_id;
    v_org_name := COALESCE(v_org_name, 'Unknown Association');
  END IF;

  -- Audit trail
  INSERT INTO member_invitation_audit (invitation_id, action, notes)
  VALUES (v_inv.id, 'viewed', 'Invitation token verified from registration page');

  RETURN jsonb_build_object(
    'valid', true,
    'email', v_inv.email,
    'first_name', v_inv.first_name,
    'last_name', v_inv.last_name,
    'organization_name', v_org_name,
    'organization_id', v_inv.organization_id,
    'organization_type', v_inv.organization_type,
    'role', v_inv.role,
    'designation', v_inv.designation,
    'department', v_inv.department,
    'expires_at', v_inv.expires_at
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_member_invitation(TEXT) TO anon, authenticated;

-------------------------------------------------------------------------------
-- 5. revoke_member_invitation
--    Replaces: edge function revoke-member-invitation
--    Was: cold start + 5 DB roundtrips (~800ms) → now: single RPC (~70ms)
--    Race condition fix: atomic UPDATE with WHERE status='pending' + ROW_COUNT
-------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.revoke_member_invitation(
  p_invitation_id UUID,
  p_reason TEXT DEFAULT 'Revoked by admin'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_inv RECORD;
  v_authorized BOOLEAN := false;
  v_updated_count INTEGER;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  -- Fetch invitation (must be pending)
  SELECT id, organization_id, organization_type
  INTO v_inv
  FROM member_invitations
  WHERE id = p_invitation_id AND status = 'pending';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invitation not found or cannot be revoked');
  END IF;

  -- Permission check: org admin/owner or association manager
  IF v_inv.organization_type = 'company' THEN
    SELECT EXISTS(
      SELECT 1 FROM members
      WHERE user_id = v_user_id
        AND company_id = v_inv.organization_id
        AND role IN ('owner', 'admin')
    ) INTO v_authorized;
  ELSIF v_inv.organization_type = 'association' THEN
    SELECT EXISTS(
      SELECT 1 FROM association_managers
      WHERE user_id = v_user_id
        AND association_id = v_inv.organization_id
    ) INTO v_authorized;
  END IF;

  -- System admins can always revoke
  IF NOT v_authorized THEN
    SELECT EXISTS(
      SELECT 1 FROM admin_users
      WHERE user_id = v_user_id AND is_active = true
    ) INTO v_authorized;
  END IF;

  IF NOT v_authorized THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: User cannot revoke this invitation');
  END IF;

  -- Atomic update: WHERE status='pending' prevents double-revoke race condition
  UPDATE member_invitations
  SET status = 'revoked',
      revoked_at = NOW(),
      revoked_by = v_user_id
  WHERE id = p_invitation_id
    AND status = 'pending';

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  IF v_updated_count = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invitation was already processed by another request');
  END IF;

  -- Audit log (only written if update succeeded — no duplicate audit entries)
  INSERT INTO member_invitation_audit (invitation_id, action, performed_by, notes)
  VALUES (p_invitation_id, 'revoked', v_user_id, p_reason);

  RETURN jsonb_build_object('success', true, 'message', 'Invitation revoked successfully');
END;
$$;

GRANT EXECUTE ON FUNCTION public.revoke_member_invitation(UUID, TEXT) TO authenticated;

-------------------------------------------------------------------------------
-- 6. increment_open_count / increment_click_count
--    These RPCs are called by receive-email-events edge function but were
--    never defined — they silently fail at runtime.
-------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.increment_open_count(recipient_id UUID)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE email_campaign_recipients
  SET open_count = COALESCE(open_count, 0) + 1
  WHERE id = recipient_id;
$$;

CREATE OR REPLACE FUNCTION public.increment_click_count(recipient_id UUID)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE email_campaign_recipients
  SET click_count = COALESCE(click_count, 0) + 1
  WHERE id = recipient_id;
$$;

GRANT EXECUTE ON FUNCTION public.increment_open_count(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.increment_click_count(UUID) TO service_role;
