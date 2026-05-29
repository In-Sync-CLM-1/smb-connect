-- Create coupons table for event landing pages
CREATE TABLE public.event_coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value DECIMAL(10,2) NOT NULL CHECK (discount_value > 0),
  landing_page_id UUID REFERENCES public.event_landing_pages(id) ON DELETE CASCADE,
  valid_from TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  valid_until TIMESTAMP WITH TIME ZONE NOT NULL,
  max_uses INTEGER,
  max_uses_per_user INTEGER NOT NULL DEFAULT 1,
  current_uses INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  CONSTRAINT event_coupons_code_unique UNIQUE (code)
);

-- Create usage tracking table
CREATE TABLE public.event_coupon_usages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id UUID NOT NULL REFERENCES public.event_coupons(id) ON DELETE CASCADE,
  registration_id UUID NOT NULL REFERENCES public.event_registrations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  discount_applied DECIMAL(10,2) NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Add coupon fields to registrations
ALTER TABLE public.event_registrations 
ADD COLUMN coupon_id UUID REFERENCES public.event_coupons(id),
ADD COLUMN discount_amount DECIMAL(10,2) DEFAULT 0,
ADD COLUMN original_amount DECIMAL(10,2),
ADD COLUMN final_amount DECIMAL(10,2);

-- Create index on coupon code for fast lookups
CREATE INDEX idx_event_coupons_code ON public.event_coupons(code);
CREATE INDEX idx_event_coupons_landing_page ON public.event_coupons(landing_page_id);
CREATE INDEX idx_event_coupon_usages_coupon ON public.event_coupon_usages(coupon_id);
CREATE INDEX idx_event_coupon_usages_email ON public.event_coupon_usages(email);

-- Enable RLS
ALTER TABLE public.event_coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_coupon_usages ENABLE ROW LEVEL SECURITY;

-- Super Admin policies for coupons
CREATE POLICY "Super admins can manage coupons"
  ON public.event_coupons FOR ALL
  USING (is_super_admin(auth.uid()));

-- Super Admin policies for coupon usages
CREATE POLICY "Super admins can view coupon usages"
  ON public.event_coupon_usages FOR SELECT
  USING (is_super_admin(auth.uid()));

-- Trigger function to update current_uses count
CREATE OR REPLACE FUNCTION public.update_coupon_usage_count()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.event_coupons 
  SET current_uses = current_uses + 1,
      updated_at = now()
  WHERE id = NEW.coupon_id;
  RETURN NEW;
END;
$$;

-- Trigger to increment usage count on insert
CREATE TRIGGER increment_coupon_usage
AFTER INSERT ON public.event_coupon_usages
FOR EACH ROW EXECUTE FUNCTION public.update_coupon_usage_count();

-- Trigger function to update updated_at timestamp
CREATE TRIGGER update_event_coupons_updated_at
BEFORE UPDATE ON public.event_coupons
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();