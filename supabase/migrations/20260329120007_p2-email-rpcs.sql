-- P2: Email-related RPCs
-- 1. setup_email_campaign: Consolidates 4 DB roundtrips for bulk email setup → 1
-- 2. store_email_conversation: Consolidates 2 DB roundtrips for send-email → 1

-- ============================================================
-- 1. Bulk email campaign setup RPC
-- ============================================================
CREATE OR REPLACE FUNCTION public.setup_email_campaign(
  p_user_id UUID,
  p_list_id UUID,
  p_subject TEXT,
  p_sender_name TEXT,
  p_sender_email TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_list RECORD;
  v_campaign RECORD;
  v_recipients JSONB;
  v_recipient_count INT;
BEGIN
  -- Fetch recipients
  SELECT jsonb_agg(jsonb_build_object('email', r.email, 'name', r.name))
  INTO v_recipients
  FROM email_list_recipients r
  WHERE r.list_id = p_list_id;

  IF v_recipients IS NULL OR jsonb_array_length(v_recipients) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'No recipients found in list');
  END IF;

  v_recipient_count := jsonb_array_length(v_recipients);

  IF v_recipient_count > 10000 THEN
    RETURN jsonb_build_object('success', false, 'error',
      format('Recipient limit exceeded. Maximum 10000 allowed. You have %s.', v_recipient_count));
  END IF;

  -- Get list context
  SELECT * INTO v_list FROM email_lists WHERE id = p_list_id;
  IF v_list IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Email list not found');
  END IF;

  -- Create campaign
  INSERT INTO email_campaigns (
    list_id, subject, sender_name, sender_email,
    association_id, company_id, created_by, total_recipients
  ) VALUES (
    p_list_id, p_subject, p_sender_name, p_sender_email,
    v_list.association_id, v_list.company_id, p_user_id, v_recipient_count
  )
  RETURNING * INTO v_campaign;

  -- Create recipient records
  INSERT INTO email_campaign_recipients (campaign_id, email, name)
  SELECT v_campaign.id, r->>'email', r->>'name'
  FROM jsonb_array_elements(v_recipients) AS r;

  RETURN jsonb_build_object(
    'success', true,
    'campaign_id', v_campaign.id,
    'recipients', v_recipients,
    'total_recipients', v_recipient_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.setup_email_campaign(UUID, UUID, TEXT, TEXT, TEXT) TO service_role;

-- ============================================================
-- 2. Store email conversation + message RPC
-- ============================================================
CREATE OR REPLACE FUNCTION public.store_email_conversation(
  p_conversation_id UUID,
  p_subject TEXT,
  p_sender_type TEXT,
  p_sender_id UUID,
  p_recipient_type TEXT,
  p_recipient_id UUID,
  p_sender_email TEXT,
  p_recipient_email TEXT,
  p_body_html TEXT,
  p_body_text TEXT,
  p_sender_name TEXT,
  p_external_message_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conversation_id UUID;
BEGIN
  IF p_conversation_id IS NOT NULL THEN
    -- Update existing conversation
    UPDATE email_conversations
    SET last_message_at = NOW()
    WHERE id = p_conversation_id;
    v_conversation_id := p_conversation_id;
  ELSE
    -- Create new conversation
    INSERT INTO email_conversations (subject, sender_type, sender_id, recipient_type, recipient_id)
    VALUES (p_subject, p_sender_type, p_sender_id, p_recipient_type, p_recipient_id)
    RETURNING id INTO v_conversation_id;
  END IF;

  -- Insert message
  INSERT INTO email_messages (
    conversation_id, sender_email, recipient_email, subject,
    body_html, body_text, direction, external_message_id, sender_name
  ) VALUES (
    v_conversation_id, p_sender_email, p_recipient_email, p_subject,
    p_body_html, p_body_text, 'outbound', p_external_message_id, p_sender_name
  );

  RETURN jsonb_build_object('success', true, 'conversation_id', v_conversation_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.store_email_conversation(UUID, TEXT, TEXT, UUID, TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO service_role;
