-- Create company_admins table for the new Company Admin role
CREATE TABLE IF NOT EXISTS public.company_admins (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, company_id)
);

-- Enable RLS
ALTER TABLE public.company_admins ENABLE ROW LEVEL SECURITY;

-- Create policies for company_admins
CREATE POLICY "Admins have full access to company admins"
ON public.company_admins
FOR ALL
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Company admins can view their own record"
ON public.company_admins
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Super admins can delete company admins"
ON public.company_admins
FOR DELETE
USING (is_super_admin(auth.uid()));

-- Add trigger for updated_at
CREATE TRIGGER update_company_admins_updated_at
BEFORE UPDATE ON public.company_admins
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create helper function to check if user is a company admin
CREATE OR REPLACE FUNCTION public.is_company_admin_role(check_user_id uuid, check_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM company_admins
    WHERE user_id = check_user_id 
    AND company_id = check_company_id
    AND is_active = true
  );
$$;