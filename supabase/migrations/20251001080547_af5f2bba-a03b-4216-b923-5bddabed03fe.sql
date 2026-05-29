-- Add industry column to associations table
ALTER TABLE public.associations 
ADD COLUMN industry TEXT;