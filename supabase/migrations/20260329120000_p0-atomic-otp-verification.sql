-- P0: Atomic OTP verification to eliminate race condition
-- Before: SELECT otp → (race window) → UPDATE used=true (two requests can use same OTP)
-- After: Single atomic UPDATE...RETURNING eliminates the race window entirely

CREATE OR REPLACE FUNCTION public.verify_and_consume_otp(
  p_email TEXT,
  p_otp TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_otp_record RECORD;
  v_normalized_email TEXT;
  v_user_id UUID;
  v_profile_count INT;
BEGIN
  v_normalized_email := LOWER(TRIM(p_email));

  IF v_normalized_email IS NULL OR p_otp IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Email and OTP are required');
  END IF;

  -- Atomically find and consume the OTP in one UPDATE
  -- FOR UPDATE SKIP LOCKED prevents concurrent use of the same OTP row
  UPDATE password_reset_otps
  SET used = true, used_at = NOW()
  WHERE id = (
    SELECT id FROM password_reset_otps
    WHERE LOWER(email) = v_normalized_email
      AND otp_code = p_otp
      AND used = false
      AND expires_at > NOW()
    ORDER BY created_at DESC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING * INTO v_otp_record;

  IF v_otp_record IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Invalid or expired verification code');
  END IF;

  -- Resolve user from profiles (deterministic lookup)
  SELECT COUNT(*) INTO v_profile_count
  FROM profiles
  WHERE LOWER(email) = v_normalized_email;

  IF v_profile_count = 1 THEN
    SELECT id INTO v_user_id
    FROM profiles
    WHERE LOWER(email) = v_normalized_email;

    RETURN jsonb_build_object('valid', true, 'user_id', v_user_id);
  ELSIF v_profile_count > 1 THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Unable to resolve user identity - please contact support');
  END IF;

  -- No profile match — edge function will do paginated auth scan as fallback
  RETURN jsonb_build_object('valid', true, 'user_id', NULL, 'needs_auth_scan', true);
END;
$$;

-- Grant to service_role only (called from edge function, not client)
GRANT EXECUTE ON FUNCTION public.verify_and_consume_otp(TEXT, TEXT) TO service_role;
