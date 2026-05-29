-- Generic payments table for Razorpay (and future gateways)
-- Designed to be purpose-agnostic so future use cases (membership, subscription,
-- event registration, etc.) can plug in without schema changes.

CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Who paid
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email TEXT NOT NULL,

  -- What was paid for
  purpose TEXT NOT NULL CHECK (purpose IN ('event_registration')),
  reference_table TEXT,
  reference_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,

  -- Money
  amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
  currency TEXT NOT NULL DEFAULT 'INR',

  -- Lifecycle
  status TEXT NOT NULL DEFAULT 'created'
    CHECK (status IN ('created', 'paid', 'failed', 'refunded')),
  failure_reason TEXT,

  -- Razorpay-specific (other gateways would use other columns or a separate table)
  gateway TEXT NOT NULL DEFAULT 'razorpay',
  razorpay_order_id TEXT UNIQUE,
  razorpay_payment_id TEXT,
  razorpay_signature TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_payments_user_id ON public.payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_email ON public.payments(email);
CREATE INDEX IF NOT EXISTS idx_payments_purpose_ref ON public.payments(purpose, reference_id);
CREATE INDEX IF NOT EXISTS idx_payments_razorpay_order ON public.payments(razorpay_order_id);
CREATE INDEX IF NOT EXISTS idx_payments_status_created_at ON public.payments(status, created_at DESC);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.payments_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS payments_updated_at ON public.payments;
CREATE TRIGGER payments_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.payments_set_updated_at();

-- RLS
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Users can view their own payments (matched by user_id OR by email if not yet linked)
CREATE POLICY "Users can view their own payments"
ON public.payments FOR SELECT
USING (
  auth.uid() = user_id
  OR LOWER(email) = LOWER(COALESCE((auth.jwt() ->> 'email'), ''))
);

-- Admins can view all payments
CREATE POLICY "Admins can view all payments"
ON public.payments FOR SELECT
USING (
  EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid() AND is_active = true)
);

-- Association managers can view payments tied to their landing pages (event_registration only)
CREATE POLICY "Association managers can view their event payments"
ON public.payments FOR SELECT
USING (
  purpose = 'event_registration'
  AND EXISTS (
    SELECT 1
    FROM public.event_landing_pages lp
    JOIN public.association_managers am ON am.association_id = lp.association_id
    WHERE lp.id = (payments.metadata ->> 'landing_page_id')::UUID
      AND am.user_id = auth.uid()
      AND am.is_active = true
  )
);

-- No INSERT/UPDATE/DELETE policies — only service_role (edge functions) can write.

COMMENT ON TABLE public.payments IS 'Generic payment records across gateways and purposes. Insert/update only via edge functions using service_role.';
COMMENT ON COLUMN public.payments.purpose IS 'What the payment is for. Currently only event_registration. Add to CHECK constraint when adding new purposes.';
COMMENT ON COLUMN public.payments.metadata IS 'Purpose-specific payload. For event_registration: landing_page_id, coupon_id, registration form data, utm_*, etc.';
COMMENT ON COLUMN public.payments.reference_id IS 'FK to the row in reference_table that this payment fulfills. Null until fulfillment completes.';
