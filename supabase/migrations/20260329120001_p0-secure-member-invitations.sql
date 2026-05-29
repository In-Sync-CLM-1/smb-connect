-- P0: Secure member invitations
-- 1. Add unique partial index to prevent duplicate pending invitations (TOCTOU race fix)
-- 2. Make plaintext token column nullable (security: stop persisting raw tokens)
-- 3. Create RPC for single invitation creation (consolidates 6 DB roundtrips → 1)

-- ============================================================
-- 1. Unique partial index: prevents concurrent duplicate invitations
-- ============================================================
-- First, deduplicate existing pending invitations (keep the newest one)
DELETE FROM member_invitations mi
WHERE mi.status = 'pending'
  AND mi.id <> (
    SELECT id FROM member_invitations mi2
    WHERE LOWER(mi2.email) = LOWER(mi.email)
      AND mi2.organization_id = mi.organization_id
      AND mi2.status = 'pending'
    ORDER BY mi2.created_at DESC
    LIMIT 1
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_member_invitations_pending_unique
ON member_invitations (LOWER(email), organization_id)
WHERE status = 'pending';

-- ============================================================
-- 2. Stop storing plaintext tokens (security hardening)
-- ============================================================
-- Drop the UNIQUE constraint on token (auto-named by Supabase)
DO $$
BEGIN
  -- Try common constraint name patterns
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints
             WHERE table_name = 'member_invitations' AND constraint_name = 'member_invitations_token_key') THEN
    ALTER TABLE member_invitations DROP CONSTRAINT member_invitations_token_key;
  END IF;
END $$;

-- Also drop any unique index on token
DROP INDEX IF EXISTS member_invitations_token_key;

-- Make token nullable — new invitations will store NULL
ALTER TABLE member_invitations ALTER COLUMN token DROP NOT NULL;
ALTER TABLE member_invitations ALTER COLUMN token SET DEFAULT NULL;

-- Clear existing plaintext tokens (they serve no purpose — hash is used for verification)
UPDATE member_invitations SET token = NULL WHERE token IS NOT NULL;

-- ============================================================
-- 3. RPC: create_single_member_invitation
--    Consolidates: permission check + rate limit + dedup + insert + org name + audit
--    Returns raw_token for email (generated via pgcrypto, never persisted)
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_single_member_invitation(
  p_user_id UUID,
  p_email TEXT,
  p_first_name TEXT,
  p_last_name TEXT,
  p_organization_id UUID,
  p_organization_type TEXT,
  p_role TEXT,
  p_designation TEXT DEFAULT NULL,
  p_department TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invitation RECORD;
  v_org_name TEXT;
  v_rate_count INT;
  v_raw_token TEXT;
  v_token_hash TEXT;
BEGIN
  -- Input validation
  IF p_email IS NULL OR p_organization_id IS NULL OR p_organization_type IS NULL OR p_role IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Missing required fields: email, organization_id, organization_type, role', 'status', 400);
  END IF;

  IF p_first_name IS NULL OR p_last_name IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Missing required fields: first_name, last_name', 'status', 400);
  END IF;

  -- Permission check
  IF p_organization_type = 'company' THEN
    IF NOT EXISTS (
      SELECT 1 FROM members
      WHERE user_id = p_user_id
        AND company_id = p_organization_id
        AND role IN ('owner', 'admin')
    ) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: User cannot invite to this company', 'status', 401);
    END IF;
  ELSIF p_organization_type = 'association' THEN
    IF NOT EXISTS (
      SELECT 1 FROM association_managers
      WHERE user_id = p_user_id
        AND association_id = p_organization_id
    ) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: User cannot invite to this association', 'status', 401);
    END IF;
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Invalid organization_type', 'status', 400);
  END IF;

  -- Rate limit: max 5 invitations per minute per user
  SELECT COUNT(*) INTO v_rate_count
  FROM member_invitations
  WHERE invited_by = p_user_id
    AND created_at >= NOW() - INTERVAL '1 minute';

  IF v_rate_count >= 5 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Rate limit exceeded: Maximum 5 invitations per minute', 'status', 429);
  END IF;

  -- Duplicate check (also enforced by unique partial index)
  IF EXISTS (
    SELECT 1 FROM member_invitations
    WHERE LOWER(email) = LOWER(TRIM(p_email))
      AND organization_id = p_organization_id
      AND status = 'pending'
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'An active invitation already exists for this email', 'status', 409);
  END IF;

  -- Generate token: raw (for email URL) + hash (for DB storage)
  v_raw_token := encode(gen_random_bytes(32), 'hex');
  v_token_hash := encode(digest(v_raw_token, 'sha256'), 'hex');

  -- Insert invitation (token column is NULL — only hash is stored)
  INSERT INTO member_invitations (
    email, first_name, last_name, organization_id, organization_type,
    role, designation, department, token_hash, expires_at, invited_by, status
  ) VALUES (
    LOWER(TRIM(p_email)), p_first_name, p_last_name, p_organization_id, p_organization_type,
    p_role, p_designation, p_department, v_token_hash,
    NOW() + INTERVAL '48 hours', p_user_id, 'pending'
  )
  RETURNING * INTO v_invitation;

  -- Get organization name
  IF p_organization_type = 'company' THEN
    SELECT name INTO v_org_name FROM companies WHERE id = p_organization_id;
  ELSE
    SELECT name INTO v_org_name FROM associations WHERE id = p_organization_id;
  END IF;

  -- Audit log
  INSERT INTO member_invitation_audit (invitation_id, action, performed_by)
  VALUES (v_invitation.id, 'created', p_user_id);

  RETURN jsonb_build_object(
    'success', true,
    'invitation_id', v_invitation.id,
    'organization_name', COALESCE(v_org_name, 'the organization'),
    'raw_token', v_raw_token,
    'email', v_invitation.email
  );

EXCEPTION
  WHEN unique_violation THEN
    -- Caught by the partial unique index — concurrent duplicate
    RETURN jsonb_build_object('success', false, 'error', 'An active invitation already exists for this email', 'status', 409);
END;
$$;

-- Grant to service_role only (called from edge function)
GRANT EXECUTE ON FUNCTION public.create_single_member_invitation(UUID, TEXT, TEXT, TEXT, UUID, TEXT, TEXT, TEXT, TEXT) TO service_role;
