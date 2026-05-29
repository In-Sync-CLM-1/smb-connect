-- Create pages table for multi-page landing pages
CREATE TABLE public.event_landing_page_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  landing_page_id UUID NOT NULL REFERENCES public.event_landing_pages(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  slug TEXT NOT NULL DEFAULT '',
  html_content TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE(landing_page_id, slug)
);

-- Enable RLS
ALTER TABLE public.event_landing_page_pages ENABLE ROW LEVEL SECURITY;

-- RLS policies for admin access
CREATE POLICY "Admins can manage landing page pages"
  ON public.event_landing_page_pages
  FOR ALL
  USING (is_admin_safe(auth.uid()));

-- Association managers can manage their landing page pages
CREATE POLICY "Association managers can manage their landing page pages"
  ON public.event_landing_page_pages
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.event_landing_pages elp
      JOIN public.association_managers am ON am.association_id = elp.association_id
      WHERE elp.id = event_landing_page_pages.landing_page_id
      AND am.user_id = auth.uid()
      AND am.is_active = true
    )
  );

-- Create trigger for updated_at
CREATE TRIGGER update_event_landing_page_pages_updated_at
  BEFORE UPDATE ON public.event_landing_page_pages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Migrate existing landing pages to the new structure
-- Create a default page for each existing landing page that has html_content
INSERT INTO public.event_landing_page_pages (landing_page_id, title, slug, html_content, sort_order, is_default)
SELECT id, 'Home', '', COALESCE(html_content, ''), 0, true
FROM public.event_landing_pages
WHERE html_content IS NOT NULL AND html_content != '';