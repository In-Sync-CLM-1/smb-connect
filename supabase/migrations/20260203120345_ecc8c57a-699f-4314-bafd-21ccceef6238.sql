-- Add default UTM configuration fields to event_landing_pages table
ALTER TABLE public.event_landing_pages
ADD COLUMN IF NOT EXISTS default_utm_source TEXT,
ADD COLUMN IF NOT EXISTS default_utm_medium TEXT,
ADD COLUMN IF NOT EXISTS default_utm_campaign TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.event_landing_pages.default_utm_source IS 'Default UTM source value for registrations from this landing page';
COMMENT ON COLUMN public.event_landing_pages.default_utm_medium IS 'Default UTM medium value for registrations from this landing page';
COMMENT ON COLUMN public.event_landing_pages.default_utm_campaign IS 'Default UTM campaign value for registrations from this landing page';