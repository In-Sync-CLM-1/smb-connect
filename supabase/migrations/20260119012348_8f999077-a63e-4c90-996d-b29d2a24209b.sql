-- Add document URL column to posts table for Word/PDF attachments
ALTER TABLE public.posts 
ADD COLUMN IF NOT EXISTS document_url TEXT;