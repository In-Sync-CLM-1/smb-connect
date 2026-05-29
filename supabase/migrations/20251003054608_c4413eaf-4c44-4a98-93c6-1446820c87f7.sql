-- Create company_requests table
CREATE TABLE public.company_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  association_id uuid REFERENCES public.associations(id),
  name text NOT NULL,
  description text,
  email text NOT NULL,
  phone text,
  website text,
  address text,
  city text,
  state text,
  country text DEFAULT 'India',
  postal_code text,
  gst_number text,
  pan_number text,
  business_type text,
  industry_type text,
  employee_count integer,
  annual_turnover numeric,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_notes text,
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.company_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can create company requests"
  ON public.company_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own requests"
  ON public.company_requests
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all requests"
  ON public.company_requests
  FOR SELECT
  TO authenticated
  USING (is_admin(auth.uid()));

CREATE POLICY "Admins can update requests"
  ON public.company_requests
  FOR UPDATE
  TO authenticated
  USING (is_admin(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_company_requests_updated_at
  BEFORE UPDATE ON public.company_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();