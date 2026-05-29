-- P1: Parse email/whatsapp list RPCs
-- Replaces edge functions with direct RPCs (no external API calls needed)
-- Client parses CSV, passes JSON array to RPC for bulk insert
-- ~6x faster: eliminates cold start + batch roundtrips

-- ============================================================
-- Email list bulk import RPC
-- ============================================================
CREATE OR REPLACE FUNCTION public.import_email_list_recipients(
  p_list_id UUID,
  p_recipients JSONB  -- Array of {email, name, metadata}
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recipient JSONB;
  v_imported INT := 0;
  v_errors TEXT[] := '{}';
  v_email TEXT;
  v_name TEXT;
  v_metadata JSONB;
BEGIN
  -- Validate list exists
  IF NOT EXISTS (SELECT 1 FROM email_lists WHERE id = p_list_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Email list not found');
  END IF;

  -- Process each recipient
  FOR v_recipient IN SELECT * FROM jsonb_array_elements(p_recipients)
  LOOP
    v_email := TRIM(v_recipient->>'email');
    v_name := v_recipient->>'name';
    v_metadata := v_recipient->'metadata';

    -- Skip invalid emails
    IF v_email IS NULL OR v_email = '' OR v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' THEN
      v_errors := array_append(v_errors, 'Invalid email: ' || COALESCE(v_email, 'null'));
      CONTINUE;
    END IF;

    BEGIN
      INSERT INTO email_list_recipients (list_id, email, name, metadata)
      VALUES (p_list_id, v_email, v_name, v_metadata);
      v_imported := v_imported + 1;
    EXCEPTION WHEN unique_violation THEN
      v_errors := array_append(v_errors, 'Duplicate: ' || v_email);
    WHEN OTHERS THEN
      v_errors := array_append(v_errors, v_email || ': ' || SQLERRM);
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'imported', v_imported,
    'errors', to_jsonb(v_errors)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.import_email_list_recipients(UUID, JSONB) TO authenticated;

-- ============================================================
-- WhatsApp list bulk import RPC
-- ============================================================
CREATE OR REPLACE FUNCTION public.import_whatsapp_list_recipients(
  p_list_id UUID,
  p_recipients JSONB  -- Array of {phone, name}
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recipient JSONB;
  v_imported INT := 0;
  v_errors TEXT[] := '{}';
  v_phone TEXT;
  v_name TEXT;
BEGIN
  -- Validate list exists
  IF NOT EXISTS (SELECT 1 FROM whatsapp_lists WHERE id = p_list_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'WhatsApp list not found');
  END IF;

  FOR v_recipient IN SELECT * FROM jsonb_array_elements(p_recipients)
  LOOP
    v_phone := TRIM(v_recipient->>'phone');
    v_name := v_recipient->>'name';

    IF v_phone IS NULL OR v_phone = '' THEN
      v_errors := array_append(v_errors, 'Missing phone number');
      CONTINUE;
    END IF;

    BEGIN
      INSERT INTO whatsapp_list_recipients (list_id, phone, name)
      VALUES (p_list_id, v_phone, v_name);
      v_imported := v_imported + 1;
    EXCEPTION WHEN unique_violation THEN
      v_errors := array_append(v_errors, 'Duplicate: ' || v_phone);
    WHEN OTHERS THEN
      v_errors := array_append(v_errors, v_phone || ': ' || SQLERRM);
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'imported', v_imported,
    'errors', to_jsonb(v_errors)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.import_whatsapp_list_recipients(UUID, JSONB) TO authenticated;
