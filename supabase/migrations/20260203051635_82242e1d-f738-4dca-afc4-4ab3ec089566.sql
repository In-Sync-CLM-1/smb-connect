-- Update Bharat DtoC association manager role from 'manager' to 'owner'
-- This enables the manager to save logos and cover images per RLS policy requirements

UPDATE public.association_managers
SET role = 'owner', updated_at = now()
WHERE association_id = (
  SELECT id FROM public.associations WHERE name = 'Bharat DtoC'
)
AND role = 'manager';