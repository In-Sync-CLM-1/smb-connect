-- Add employment status field to profiles
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS employment_status TEXT,
ADD COLUMN IF NOT EXISTS open_to_work BOOLEAN DEFAULT false;

-- Create an enum-like check constraint for employment_status
ALTER TABLE profiles
ADD CONSTRAINT employment_status_check 
CHECK (employment_status IS NULL OR employment_status IN (
  'open_to_opportunities',
  'actively_looking',
  'hiring',
  'not_looking',
  'open_to_consulting',
  'available_for_freelance'
));