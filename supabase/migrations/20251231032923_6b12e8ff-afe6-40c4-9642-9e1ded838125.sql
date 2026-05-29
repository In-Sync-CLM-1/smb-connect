-- Add link and thumbnail columns to events table
ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS event_link TEXT,
ADD COLUMN IF NOT EXISTS thumbnail_url TEXT,
ADD COLUMN IF NOT EXISTS link_preview_title TEXT,
ADD COLUMN IF NOT EXISTS link_preview_description TEXT,
ADD COLUMN IF NOT EXISTS link_preview_image TEXT;

-- Create event-media storage bucket for thumbnails
INSERT INTO storage.buckets (id, name, public)
VALUES ('event-media', 'event-media', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to event-media bucket
CREATE POLICY "Authenticated users can upload event media"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'event-media' AND auth.role() = 'authenticated');

-- Allow authenticated users to update their uploads
CREATE POLICY "Authenticated users can update event media"
ON storage.objects FOR UPDATE
USING (bucket_id = 'event-media' AND auth.role() = 'authenticated');

-- Allow authenticated users to delete their uploads
CREATE POLICY "Authenticated users can delete event media"
ON storage.objects FOR DELETE
USING (bucket_id = 'event-media' AND auth.role() = 'authenticated');

-- Allow public read access for event media
CREATE POLICY "Public can view event media"
ON storage.objects FOR SELECT
USING (bucket_id = 'event-media');