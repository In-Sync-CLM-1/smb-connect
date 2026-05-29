-- Add certificate file URL column to certifications table
ALTER TABLE public.certifications 
ADD COLUMN IF NOT EXISTS certificate_file_url TEXT;

-- Create certificates storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('certificates', 'certificates', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for certificates bucket
-- Allow public to view certificate files
CREATE POLICY "Certificate files are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'certificates');

-- Allow authenticated users to upload their own certificates
CREATE POLICY "Users can upload their own certificates"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'certificates' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to update their own certificates
CREATE POLICY "Users can update their own certificates"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'certificates' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to delete their own certificates
CREATE POLICY "Users can delete their own certificates"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'certificates' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);