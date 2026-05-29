-- Add event details columns to event_landing_pages table
ALTER TABLE public.event_landing_pages
ADD COLUMN event_date DATE,
ADD COLUMN event_time TEXT,
ADD COLUMN event_venue TEXT;