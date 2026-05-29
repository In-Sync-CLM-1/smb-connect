-- Add is_default column to companies table
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT FALSE;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_companies_is_default ON public.companies(is_default) WHERE is_default = true;

-- Create function to auto-create default company when association is created
CREATE OR REPLACE FUNCTION create_default_company_for_association()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.companies (
    association_id,
    name,
    email,
    description,
    is_active,
    is_verified,
    is_default
  ) VALUES (
    NEW.id,
    CONCAT(NEW.name, '_Direct Members'),
    NEW.contact_email,
    CONCAT('Default company for direct members of ', NEW.name),
    true,
    true,
    true
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to auto-create default company
DROP TRIGGER IF EXISTS on_association_created ON public.associations;
CREATE TRIGGER on_association_created
AFTER INSERT ON public.associations
FOR EACH ROW
EXECUTE FUNCTION create_default_company_for_association();

-- Backfill: Create default companies for existing associations that don't have one
INSERT INTO public.companies (association_id, name, email, description, is_active, is_verified, is_default)
SELECT 
  a.id,
  CONCAT(a.name, '_Direct Members'),
  a.contact_email,
  CONCAT('Default company for direct members of ', a.name),
  true,
  true,
  true
FROM public.associations a
WHERE NOT EXISTS (
  SELECT 1 FROM public.companies c 
  WHERE c.association_id = a.id AND c.is_default = true
);