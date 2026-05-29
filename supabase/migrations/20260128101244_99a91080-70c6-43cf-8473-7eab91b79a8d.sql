-- Fix association update policy to allow managers with edit_association permission
DROP POLICY IF EXISTS "Association owners can manage their association" ON public.associations;

CREATE POLICY "Association managers can update their association" 
ON public.associations 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM association_managers
    WHERE association_managers.association_id = associations.id 
    AND association_managers.user_id = auth.uid() 
    AND association_managers.is_active = true
    AND (
      association_managers.role = 'owner' 
      OR (association_managers.permissions->>'edit_association')::boolean = true
    )
  )
);