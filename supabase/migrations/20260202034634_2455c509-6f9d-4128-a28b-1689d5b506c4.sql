-- Add registration_fee column to event_landing_pages
ALTER TABLE public.event_landing_pages
ADD COLUMN registration_fee NUMERIC DEFAULT NULL;

-- Add comment for clarity
COMMENT ON COLUMN public.event_landing_pages.registration_fee IS 'Registration fee in INR. NULL or 0 means free event.';