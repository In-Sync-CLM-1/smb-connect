-- P1: Resend member invitation RPC
-- Consolidates 6 sequential DB roundtrips → 1 atomic call
-- Edge function remains as thin wrapper for Resend email API

CREATE OR REPLACE FUNCTION public.resend_member_invitation_db(
  p_user_id UUID,
  p_invitation_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invitation RECORD;
  v_org_name TEXT;
  v_raw_token TEXT;
  v_token_hash TEXT;
  v_new_expires_at TIMESTAMPTZ;
BEGIN
  -- Fetch invitation
  SELECT * INTO v_invitation
  FROM member_invitations
  WHERE id = p_invitation_id
    AND status IN ('pending', 'expired');

  IF v_invitation IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invitation not found or cannot be resent', 'status', 404);
  END IF;

  -- Permission check
  IF v_invitation.organization_type = 'company' THEN
    IF NOT EXISTS (
      SELECT 1 FROM members
      WHERE user_id = p_user_id
        AND company_id = v_invitation.organization_id
        AND role IN ('owner', 'admin')
    ) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: User cannot resend this invitation', 'status', 401);
    END IF;
  ELSIF v_invitation.organization_type = 'association' THEN
    IF NOT EXISTS (
      SELECT 1 FROM association_managers
      WHERE user_id = p_user_id
        AND association_id = v_invitation.organization_id
    ) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: User cannot resend this invitation', 'status', 401);
    END IF;
  END IF;

  -- Generate new token via pgcrypto
  v_raw_token := encode(gen_random_bytes(32), 'hex');
  v_token_hash := encode(digest(v_raw_token, 'sha256'), 'hex');
  v_new_expires_at := NOW() + INTERVAL '48 hours';

  -- Update invitation with new token and expiry
  UPDATE member_invitations
  SET token_hash = v_token_hash,
      expires_at = v_new_expires_at,
      status = 'pending'
  WHERE id = p_invitation_id;

  -- Get organization name
  IF v_invitation.organization_type = 'company' THEN
    SELECT name INTO v_org_name FROM companies WHERE id = v_invitation.organization_id;
  ELSE
    SELECT name INTO v_org_name FROM associations WHERE id = v_invitation.organization_id;
  END IF;

  -- Audit log
  INSERT INTO member_invitation_audit (invitation_id, action, performed_by, notes)
  VALUES (p_invitation_id, 'resent', p_user_id, 'Invitation resent with new token');

  RETURN jsonb_build_object(
    'success', true,
    'raw_token', v_raw_token,
    'organization_name', COALESCE(v_org_name, 'the organization'),
    'invitation_email', v_invitation.email,
    'first_name', v_invitation.first_name,
    'role', v_invitation.role,
    'designation', v_invitation.designation,
    'department', v_invitation.department,
    'organization_id', v_invitation.organization_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.resend_member_invitation_db(UUID, UUID) TO service_role;
