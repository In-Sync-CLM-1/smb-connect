-- P2: Event registration RPCs
-- Splits process-event-registration into 2 RPCs:
--   Phase 1: validate_event_registration (landing page + dup check + coupon) → 4 roundtrips → 1
--   Phase 2: complete_event_registration (insert reg + member link + coupon usage) → 6 roundtrips → 1
-- Edge function handles Auth user creation + Resend email between phases

-- ============================================================
-- Phase 1: Validate everything before user creation
-- ============================================================
CREATE OR REPLACE FUNCTION public.validate_event_registration(
  p_landing_page_id UUID,
  p_email TEXT,
  p_coupon_code TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_landing_page RECORD;
  v_assoc_name TEXT;
  v_registration_fee NUMERIC;
  v_original_amount NUMERIC;
  v_discount_amount NUMERIC := 0;
  v_final_amount NUMERIC;
  v_coupon RECORD;
  v_coupon_id UUID := NULL;
  v_user_usage_count INT;
  v_normalized_email TEXT;
  v_normalized_code TEXT;
BEGIN
  v_normalized_email := LOWER(TRIM(p_email));

  -- Fetch landing page with association
  SELECT lp.*, a.name AS association_name
  INTO v_landing_page
  FROM event_landing_pages lp
  LEFT JOIN associations a ON a.id = lp.association_id
  WHERE lp.id = p_landing_page_id AND lp.is_active = true;

  IF v_landing_page IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Landing page not found or inactive', 'status', 404);
  END IF;

  IF NOT v_landing_page.registration_enabled THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Registration is not enabled for this event', 'status', 400);
  END IF;

  -- Check duplicate registration
  IF EXISTS (
    SELECT 1 FROM event_registrations
    WHERE landing_page_id = p_landing_page_id AND email = v_normalized_email
  ) THEN
    RETURN jsonb_build_object('valid', false, 'error', 'This email is already registered for this event', 'status', 409);
  END IF;

  -- Calculate amounts
  v_registration_fee := COALESCE(v_landing_page.registration_fee::NUMERIC, 0);
  v_original_amount := v_registration_fee;
  v_final_amount := v_registration_fee;

  -- Validate coupon if provided
  IF p_coupon_code IS NOT NULL AND TRIM(p_coupon_code) <> '' THEN
    v_normalized_code := UPPER(TRIM(p_coupon_code));

    SELECT * INTO v_coupon
    FROM event_coupons
    WHERE code = v_normalized_code;

    IF v_coupon IS NULL THEN
      RETURN jsonb_build_object('valid', false, 'error', 'Invalid coupon code', 'status', 400);
    END IF;

    IF NOT v_coupon.is_active THEN
      RETURN jsonb_build_object('valid', false, 'error', 'This coupon is no longer active', 'status', 400);
    END IF;

    IF NOW() < v_coupon.valid_from OR NOW() > v_coupon.valid_until THEN
      RETURN jsonb_build_object('valid', false, 'error', 'This coupon is not currently valid', 'status', 400);
    END IF;

    IF v_coupon.landing_page_id IS NOT NULL AND v_coupon.landing_page_id <> p_landing_page_id THEN
      RETURN jsonb_build_object('valid', false, 'error', 'This coupon is not valid for this event', 'status', 400);
    END IF;

    IF v_coupon.max_uses IS NOT NULL AND v_coupon.current_uses >= v_coupon.max_uses THEN
      RETURN jsonb_build_object('valid', false, 'error', 'This coupon has reached its usage limit', 'status', 400);
    END IF;

    -- Per-user usage check
    SELECT COUNT(*) INTO v_user_usage_count
    FROM event_coupon_usages
    WHERE coupon_id = v_coupon.id AND email = v_normalized_email;

    IF v_user_usage_count >= v_coupon.max_uses_per_user THEN
      RETURN jsonb_build_object('valid', false, 'error', 'You have already used this coupon the maximum number of times', 'status', 400);
    END IF;

    -- Calculate discount
    v_coupon_id := v_coupon.id;
    IF v_coupon.discount_type = 'percentage' THEN
      v_discount_amount := ROUND((v_original_amount * v_coupon.discount_value::NUMERIC) / 100);
    ELSE
      v_discount_amount := v_coupon.discount_value::NUMERIC;
    END IF;
    v_discount_amount := LEAST(v_discount_amount, v_original_amount);
    v_final_amount := v_original_amount - v_discount_amount;
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'landing_page_title', v_landing_page.title,
    'association_id', v_landing_page.association_id,
    'association_name', v_landing_page.association_name,
    'event_date', v_landing_page.event_date,
    'event_time', v_landing_page.event_time,
    'event_venue', v_landing_page.event_venue,
    'default_utm_source', v_landing_page.default_utm_source,
    'default_utm_medium', v_landing_page.default_utm_medium,
    'default_utm_campaign', v_landing_page.default_utm_campaign,
    'coupon_id', v_coupon_id,
    'original_amount', v_original_amount,
    'discount_amount', v_discount_amount,
    'final_amount', v_final_amount
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_event_registration(UUID, TEXT, TEXT) TO service_role;

-- ============================================================
-- Phase 2: Insert registration + link member + record coupon (atomic)
-- ============================================================
CREATE OR REPLACE FUNCTION public.complete_event_registration(
  p_landing_page_id UUID,
  p_email TEXT,
  p_first_name TEXT,
  p_last_name TEXT,
  p_phone TEXT,
  p_user_id UUID,
  p_association_id UUID,
  p_coupon_id UUID DEFAULT NULL,
  p_original_amount NUMERIC DEFAULT 0,
  p_discount_amount NUMERIC DEFAULT 0,
  p_final_amount NUMERIC DEFAULT 0,
  p_registration_data JSONB DEFAULT '{}'::JSONB,
  p_utm_source TEXT DEFAULT NULL,
  p_utm_medium TEXT DEFAULT NULL,
  p_utm_campaign TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_registration RECORD;
  v_company_id UUID;
  v_assoc_name TEXT;
  v_existing_member RECORD;
  v_null_member RECORD;
BEGIN
  -- Insert registration
  INSERT INTO event_registrations (
    landing_page_id, email, first_name, last_name, phone,
    user_id, registration_data, status,
    coupon_id, original_amount, discount_amount, final_amount,
    utm_source, utm_medium, utm_campaign
  ) VALUES (
    p_landing_page_id, LOWER(TRIM(p_email)), p_first_name, p_last_name, p_phone,
    p_user_id, COALESCE(p_registration_data, '{}'::JSONB), 'completed',
    p_coupon_id, p_original_amount, p_discount_amount, p_final_amount,
    p_utm_source, p_utm_medium, p_utm_campaign
  )
  RETURNING * INTO v_registration;

  -- Link user to association's default company (if applicable)
  IF p_user_id IS NOT NULL AND p_association_id IS NOT NULL THEN
    -- Find default company
    SELECT id INTO v_company_id
    FROM companies
    WHERE association_id = p_association_id AND is_active = true AND is_default = true
    LIMIT 1;

    -- Fallback: first active company
    IF v_company_id IS NULL THEN
      SELECT id INTO v_company_id
      FROM companies
      WHERE association_id = p_association_id AND is_active = true
      ORDER BY created_at ASC
      LIMIT 1;
    END IF;

    -- Create default company if none exists
    IF v_company_id IS NULL THEN
      SELECT name INTO v_assoc_name FROM associations WHERE id = p_association_id;
      INSERT INTO companies (association_id, name, email, is_default, is_active, description)
      VALUES (
        p_association_id,
        COALESCE(v_assoc_name, 'Association') || ' - General',
        'general@' || LOWER(REGEXP_REPLACE(COALESCE(v_assoc_name, 'org'), '[^a-z0-9]', '', 'g')) || '.org',
        true, true, 'Default company for association members'
      )
      RETURNING id INTO v_company_id;
    END IF;

    IF v_company_id IS NOT NULL THEN
      -- Check if already a member
      SELECT id, company_id INTO v_existing_member
      FROM members
      WHERE user_id = p_user_id AND company_id = v_company_id AND is_active = true;

      IF v_existing_member IS NULL THEN
        -- Check for null company_id member record to fix
        SELECT id INTO v_null_member
        FROM members
        WHERE user_id = p_user_id AND company_id IS NULL AND is_active = true;

        IF v_null_member IS NOT NULL THEN
          UPDATE members SET company_id = v_company_id WHERE id = v_null_member.id;
        ELSE
          INSERT INTO members (user_id, company_id, role, designation, is_active)
          VALUES (p_user_id, v_company_id, 'member', 'Event Registrant', true);
        END IF;
      END IF;
    END IF;
  END IF;

  -- Record coupon usage
  IF p_coupon_id IS NOT NULL THEN
    INSERT INTO event_coupon_usages (coupon_id, registration_id, email, discount_applied)
    VALUES (p_coupon_id, v_registration.id, LOWER(TRIM(p_email)), p_discount_amount);
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'registration_id', v_registration.id
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_event_registration(UUID, TEXT, TEXT, TEXT, TEXT, UUID, UUID, UUID, NUMERIC, NUMERIC, NUMERIC, JSONB, TEXT, TEXT, TEXT) TO service_role;
