-- Auto-provision an email subdomain whenever a new association or company
-- is inserted, and periodically refresh verification status for pending
-- subdomains. Uses pg_net to invoke the corresponding edge functions and
-- pulls the service-role JWT from Supabase Vault.

-- ────────────────────────────────────────────────────────────────────────
-- Helper: read the service-role key out of Vault.
-- The migration that stores the secret runs separately so we don't put the
-- secret in source control. We fall back to a no-op call if the secret is
-- absent (the row will still get its subdomain on the next manual run).
-- ────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public._email_domain_service_key()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key TEXT;
BEGIN
  SELECT decrypted_secret INTO v_key
  FROM vault.decrypted_secrets
  WHERE name = 'service_role_key'
  LIMIT 1;
  RETURN v_key;
END;
$$;

CREATE OR REPLACE FUNCTION public._email_domain_functions_base_url()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url TEXT;
BEGIN
  SELECT decrypted_secret INTO v_url
  FROM vault.decrypted_secrets
  WHERE name = 'supabase_functions_url'
  LIMIT 1;
  RETURN v_url;
END;
$$;

-- ────────────────────────────────────────────────────────────────────────
-- Trigger function: fires after insert on associations or companies.
-- TG_ARGV[0] = 'association' | 'company'
-- ────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_provision_org_email_domain()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url TEXT;
  v_key TEXT;
BEGIN
  v_url := public._email_domain_functions_base_url();
  v_key := public._email_domain_service_key();
  IF v_url IS NULL OR v_key IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := v_url || '/provision-org-email-domain',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_key,
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'org_type', TG_ARGV[0],
      'org_id',   NEW.id
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_provision_assoc_email_domain ON public.associations;
CREATE TRIGGER trg_provision_assoc_email_domain
  AFTER INSERT ON public.associations
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_provision_org_email_domain('association');

DROP TRIGGER IF EXISTS trg_provision_company_email_domain ON public.companies;
CREATE TRIGGER trg_provision_company_email_domain
  AFTER INSERT ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_provision_org_email_domain('company');

-- ────────────────────────────────────────────────────────────────────────
-- Periodic refresh: every 5 minutes, call refresh-org-email-domain so that
-- pending subdomains advance to 'verified' once Resend confirms DNS.
-- ────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_refresh_pending_email_domains()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url     TEXT;
  v_key     TEXT;
  v_pending INT;
BEGIN
  SELECT COUNT(*) INTO v_pending FROM (
    SELECT 1 FROM public.associations WHERE email_domain_status <> 'verified' AND email_domain_resend_id IS NOT NULL
    UNION ALL
    SELECT 1 FROM public.companies    WHERE email_domain_status <> 'verified' AND email_domain_resend_id IS NOT NULL
  ) p;

  IF v_pending = 0 THEN
    RETURN;
  END IF;

  v_url := public._email_domain_functions_base_url();
  v_key := public._email_domain_service_key();
  IF v_url IS NULL OR v_key IS NULL THEN
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := v_url || '/refresh-org-email-domain',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_key,
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
END;
$$;

DO $$
BEGIN
  PERFORM cron.unschedule('refresh-org-email-domains');
EXCEPTION WHEN OTHERS THEN
  -- job didn't exist yet
  NULL;
END $$;

SELECT cron.schedule(
  'refresh-org-email-domains',
  '*/5 * * * *',
  $$SELECT public.fn_refresh_pending_email_domains()$$
);
