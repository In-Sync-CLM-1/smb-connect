-- Add css_content column to event_landing_pages table
ALTER TABLE public.event_landing_pages
ADD COLUMN css_content TEXT;