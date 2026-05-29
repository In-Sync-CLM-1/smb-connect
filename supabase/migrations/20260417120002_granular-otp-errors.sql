-- Make verify_and_consume_otp return specific reasons on failure so the UI
-- can tell the user whether the code was wrong, expired, already used, or
-- whether no reset was ever requested for that email.

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
  v_diag RECORD;
BEGIN
  v_normalized_email := LOWER(TRIM(p_email));

  IF v_normalized_email IS NULL OR p_otp IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Email and OTP are required');
  END IF;

  -- Atomic find-and-consume in a single UPDATE (prevents races)
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
    -- Diagnose: look at the most recent row for this email+code (any state)
    SELECT used, expires_at, created_at
      INTO v_diag
      FROM password_reset_otps
     WHERE LOWER(email) = v_normalized_email
       AND otp_code = p_otp
     ORDER BY created_at DESC
     LIMIT 1;

    IF FOUND THEN
      IF v_diag.used THEN
        RETURN jsonb_build_object('valid', false, 'error', 'This verification code has already been used. Please request a new code.');
      ELSIF v_diag.expires_at <= NOW() THEN
        RETURN jsonb_build_object('valid', false, 'error', 'This verification code has expired. Codes are valid for 1 hour — please request a new code.');
      ELSE
        -- Shouldn't happen (would have been consumed above), but handle safely
        RETURN jsonb_build_object('valid', false, 'error', 'Verification failed. Please request a new code.');
      END IF;
    END IF;

    -- No row matches email+code. Distinguish "wrong code" from "never requested".
    IF EXISTS (
      SELECT 1 FROM password_reset_otps
       WHERE LOWER(email) = v_normalized_email
         AND created_at > NOW() - interval '24 hours'
    ) THEN
      RETURN jsonb_build_object('valid', false, 'error', 'Incorrect verification code. Double-check the 6-digit code in your most recent reset email.');
    END IF;

    RETURN jsonb_build_object('valid', false, 'error', 'No recent password reset request found for this email. Please request a new code.');
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

  -- No profile match - edge function will do paginated auth scan as fallback
  RETURN jsonb_build_object('valid', true, 'user_id', NULL, 'needs_auth_scan', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_and_consume_otp(TEXT, TEXT) TO service_role;
