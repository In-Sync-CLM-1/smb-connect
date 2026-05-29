-- P2: Complete member invitation RPC
-- After Auth user creation, this RPC atomically handles:
--   member/association_manager creation + invitation status update + audit
-- If it fails, the edge function rolls back the auth user

CREATE OR REPLACE FUNCTION public.complete_member_invitation_db(
  p_invitation_id UUID,
  p_user_id UUID,  -- newly created auth user ID
  p_first_name TEXT DEFAULT NULL,
  p_last_name TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invitation RECORD;
  v_update_count INT;
BEGIN
  -- Lock and fetch invitation (prevents concurrent acceptance)
  SELECT * INTO v_invitation
  FROM member_invitations
  WHERE id = p_invitation_id AND status = 'pending'
  FOR UPDATE;

  IF v_invitation IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'This invitation has already been used or was modified');
  END IF;

  -- Create member record
  IF v_invitation.organization_type = 'company' THEN
    INSERT INTO members (user_id, company_id, role, designation, department, is_active)
    VALUES (p_user_id, v_invitation.organization_id, v_invitation.role,
            v_invitation.designation, v_invitation.department, true);

  ELSIF v_invitation.organization_type = 'association' THEN
    -- Create association_managers for admin/manager roles
    IF v_invitation.role IN ('admin', 'manager') THEN
      INSERT INTO association_managers (user_id, association_id, is_active)
      VALUES (p_user_id, v_invitation.organization_id, true);
    END IF;

    -- Create member record for all association invitees
    INSERT INTO members (user_id, role, is_active)
    VALUES (p_user_id, v_invitation.role, true);
  END IF;

  -- Mark invitation as accepted (atomic — only if still pending)
  UPDATE member_invitations
  SET status = 'accepted',
      accepted_at = NOW(),
      accepted_by = p_user_id
  WHERE id = p_invitation_id AND status = 'pending';

  GET DIAGNOSTICS v_update_count = ROW_COUNT;
  IF v_update_count = 0 THEN
    RAISE EXCEPTION 'Invitation was modified concurrently';
  END IF;

  -- Audit log
  INSERT INTO member_invitation_audit (invitation_id, action, performed_by, notes)
  VALUES (p_invitation_id, 'accepted', p_user_id, 'Registration completed successfully');

  RETURN jsonb_build_object('success', true, 'user_id', p_user_id);

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_member_invitation_db(UUID, UUID, TEXT, TEXT) TO service_role;
