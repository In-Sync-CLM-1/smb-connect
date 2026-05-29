-- Add UTM tracking columns to event_registrations table
ALTER TABLE public.event_registrations
ADD COLUMN utm_source TEXT,
ADD COLUMN utm_medium TEXT,
ADD COLUMN utm_campaign TEXT;