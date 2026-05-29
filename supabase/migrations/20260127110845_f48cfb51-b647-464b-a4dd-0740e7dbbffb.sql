-- Create event_landing_pages table
CREATE TABLE public.event_landing_pages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  html_content TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  association_id UUID NOT NULL REFERENCES public.associations(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  registration_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create event_registrations table
CREATE TABLE public.event_registrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  landing_page_id UUID NOT NULL REFERENCES public.event_landing_pages(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT,
  user_id UUID,
  registration_data JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_event_landing_pages_slug ON public.event_landing_pages(slug);
CREATE INDEX idx_event_landing_pages_association ON public.event_landing_pages(association_id);
CREATE INDEX idx_event_registrations_landing_page ON public.event_registrations(landing_page_id);
CREATE INDEX idx_event_registrations_email ON public.event_registrations(email);

-- Enable RLS
ALTER TABLE public.event_landing_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_registrations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for event_landing_pages
-- Admins can view all landing pages
CREATE POLICY "Admins can view all landing pages"
ON public.event_landing_pages FOR SELECT
USING (
  EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid() AND is_active = true)
);

-- Association managers can view their landing pages
CREATE POLICY "Association managers can view their landing pages"
ON public.event_landing_pages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.association_managers 
    WHERE user_id = auth.uid() 
    AND association_id = event_landing_pages.association_id 
    AND is_active = true
  )
);

-- Admins can insert landing pages
CREATE POLICY "Admins can insert landing pages"
ON public.event_landing_pages FOR INSERT
WITH CHECK (
  EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid() AND is_active = true)
);

-- Association managers can insert landing pages for their association
CREATE POLICY "Association managers can insert landing pages"
ON public.event_landing_pages FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.association_managers 
    WHERE user_id = auth.uid() 
    AND association_id = event_landing_pages.association_id 
    AND is_active = true
  )
);

-- Admins can update landing pages
CREATE POLICY "Admins can update landing pages"
ON public.event_landing_pages FOR UPDATE
USING (
  EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid() AND is_active = true)
);

-- Association managers can update their landing pages
CREATE POLICY "Association managers can update landing pages"
ON public.event_landing_pages FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.association_managers 
    WHERE user_id = auth.uid() 
    AND association_id = event_landing_pages.association_id 
    AND is_active = true
  )
);

-- Admins can delete landing pages
CREATE POLICY "Admins can delete landing pages"
ON public.event_landing_pages FOR DELETE
USING (
  EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid() AND is_active = true)
);

-- Association managers can delete their landing pages
CREATE POLICY "Association managers can delete landing pages"
ON public.event_landing_pages FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.association_managers 
    WHERE user_id = auth.uid() 
    AND association_id = event_landing_pages.association_id 
    AND is_active = true
  )
);

-- RLS Policies for event_registrations
-- Admins can view all registrations
CREATE POLICY "Admins can view all registrations"
ON public.event_registrations FOR SELECT
USING (
  EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid() AND is_active = true)
);

-- Association managers can view registrations for their landing pages
CREATE POLICY "Association managers can view registrations"
ON public.event_registrations FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.event_landing_pages elp
    JOIN public.association_managers am ON am.association_id = elp.association_id
    WHERE elp.id = event_registrations.landing_page_id
    AND am.user_id = auth.uid()
    AND am.is_active = true
  )
);

-- Public insert for registrations (handled by edge function with service role)
CREATE POLICY "Allow public insert for registrations"
ON public.event_registrations FOR INSERT
WITH CHECK (true);

-- Trigger for updated_at
CREATE TRIGGER update_event_landing_pages_updated_at
BEFORE UPDATE ON public.event_landing_pages
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();