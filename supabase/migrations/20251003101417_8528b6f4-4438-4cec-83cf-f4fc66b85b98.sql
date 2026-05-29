-- Create event requisitions table
CREATE TABLE public.event_requisitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES auth.users(id),
  requester_type TEXT NOT NULL CHECK (requester_type IN ('association', 'company')),
  association_id UUID REFERENCES public.associations(id),
  company_id UUID REFERENCES public.companies(id),
  
  event_name TEXT NOT NULL,
  event_description TEXT,
  event_type TEXT,
  event_date TIMESTAMP WITH TIME ZONE,
  event_location TEXT,
  expected_attendees INTEGER,
  budget_estimate NUMERIC,
  
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_notes TEXT,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.event_requisitions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can create their own requests
CREATE POLICY "Users can create event requisitions"
ON public.event_requisitions
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = requester_id AND
  (
    (requester_type = 'association' AND association_id IN (
      SELECT association_id FROM association_managers 
      WHERE user_id = auth.uid() AND is_active = true
    ))
    OR
    (requester_type = 'company' AND company_id IN (
      SELECT company_id FROM members 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND is_active = true
    ))
  )
);

-- Policy: Users can view their own requests
CREATE POLICY "Users can view own event requisitions"
ON public.event_requisitions
FOR SELECT
TO authenticated
USING (auth.uid() = requester_id);

-- Policy: Super admins can view all requests
CREATE POLICY "Super admins can view all event requisitions"
ON public.event_requisitions
FOR SELECT
TO authenticated
USING (is_super_admin(auth.uid()));

-- Policy: Super admins can update requests
CREATE POLICY "Super admins can update event requisitions"
ON public.event_requisitions
FOR UPDATE
TO authenticated
USING (is_super_admin(auth.uid()));

-- Add trigger for updated_at
CREATE TRIGGER update_event_requisitions_updated_at
BEFORE UPDATE ON public.event_requisitions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();