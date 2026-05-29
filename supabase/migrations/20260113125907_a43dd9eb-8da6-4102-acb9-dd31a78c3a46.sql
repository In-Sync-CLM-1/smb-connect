-- Add cover_image column to associations table
ALTER TABLE public.associations 
ADD COLUMN IF NOT EXISTS cover_image text;