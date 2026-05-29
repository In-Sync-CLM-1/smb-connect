-- Per-org email subdomains: each association/company gets a verified Resend
-- subdomain of smbconnect.in (e.g. apex-association.smbconnect.in) used as
-- the From for emails sent on its behalf.

ALTER TABLE public.associations
  ADD COLUMN IF NOT EXISTS email_subdomain          TEXT,
  ADD COLUMN IF NOT EXISTS email_domain_status      TEXT NOT NULL DEFAULT 'pending'
    CHECK (email_domain_status IN ('pending', 'verified', 'failed')),
  ADD COLUMN IF NOT EXISTS email_domain_resend_id   TEXT,
  ADD COLUMN IF NOT EXISTS email_domain_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS email_domain_provisioned_at TIMESTAMPTZ;

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS email_subdomain          TEXT,
  ADD COLUMN IF NOT EXISTS email_domain_status      TEXT NOT NULL DEFAULT 'pending'
    CHECK (email_domain_status IN ('pending', 'verified', 'failed')),
  ADD COLUMN IF NOT EXISTS email_domain_resend_id   TEXT,
  ADD COLUMN IF NOT EXISTS email_domain_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS email_domain_provisioned_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS uq_associations_email_subdomain
  ON public.associations (email_subdomain) WHERE email_subdomain IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_companies_email_subdomain
  ON public.companies (email_subdomain) WHERE email_subdomain IS NOT NULL;
