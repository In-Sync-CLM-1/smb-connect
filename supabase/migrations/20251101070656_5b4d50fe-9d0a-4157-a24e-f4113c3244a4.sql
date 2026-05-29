-- Create table to store password reset OTP codes
CREATE TABLE IF NOT EXISTS public.password_reset_otps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  otp_code TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '1 hour'),
  used BOOLEAN NOT NULL DEFAULT false,
  used_at TIMESTAMPTZ
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_password_reset_otps_email ON public.password_reset_otps(email);
CREATE INDEX IF NOT EXISTS idx_password_reset_otps_expires ON public.password_reset_otps(expires_at);

-- Enable RLS
ALTER TABLE public.password_reset_otps ENABLE ROW LEVEL SECURITY;

-- No policies needed - edge functions will use service role
COMMENT ON TABLE public.password_reset_otps IS 'Stores OTP codes for password reset - accessed only via edge functions with service role';