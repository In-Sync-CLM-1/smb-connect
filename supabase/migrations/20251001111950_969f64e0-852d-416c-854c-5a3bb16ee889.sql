-- Create email lists table for storing recipient groups
CREATE TABLE public.email_lists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID NOT NULL,
  total_recipients INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create email list recipients table
CREATE TABLE public.email_list_recipients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  list_id UUID NOT NULL REFERENCES public.email_lists(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_list_recipients ENABLE ROW LEVEL SECURITY;

-- RLS Policies for email_lists
CREATE POLICY "Super admins can view all email lists"
  ON public.email_lists FOR SELECT
  USING (is_super_admin(auth.uid()));

CREATE POLICY "Super admins can create email lists"
  ON public.email_lists FOR INSERT
  WITH CHECK (
    is_super_admin(auth.uid()) AND created_by = auth.uid()
  );

CREATE POLICY "Super admins can update email lists"
  ON public.email_lists FOR UPDATE
  USING (is_super_admin(auth.uid()));

CREATE POLICY "Super admins can delete email lists"
  ON public.email_lists FOR DELETE
  USING (is_super_admin(auth.uid()));

-- RLS Policies for email_list_recipients
CREATE POLICY "Super admins can view all recipients"
  ON public.email_list_recipients FOR SELECT
  USING (is_super_admin(auth.uid()));

CREATE POLICY "Super admins can add recipients"
  ON public.email_list_recipients FOR INSERT
  WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "Super admins can update recipients"
  ON public.email_list_recipients FOR UPDATE
  USING (is_super_admin(auth.uid()));

CREATE POLICY "Super admins can delete recipients"
  ON public.email_list_recipients FOR DELETE
  USING (is_super_admin(auth.uid()));

-- Create indexes for performance
CREATE INDEX idx_email_lists_created_by ON public.email_lists(created_by);
CREATE INDEX idx_email_list_recipients_list_id ON public.email_list_recipients(list_id);
CREATE INDEX idx_email_list_recipients_email ON public.email_list_recipients(email);

-- Add trigger for updated_at
CREATE TRIGGER update_email_lists_updated_at
  BEFORE UPDATE ON public.email_lists
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to update total_recipients count
CREATE OR REPLACE FUNCTION update_email_list_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE email_lists
  SET total_recipients = (
    SELECT COUNT(*) FROM email_list_recipients WHERE list_id = COALESCE(NEW.list_id, OLD.list_id)
  )
  WHERE id = COALESCE(NEW.list_id, OLD.list_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_list_count_after_insert
  AFTER INSERT ON public.email_list_recipients
  FOR EACH ROW
  EXECUTE FUNCTION update_email_list_count();

CREATE TRIGGER update_list_count_after_delete
  AFTER DELETE ON public.email_list_recipients
  FOR EACH ROW
  EXECUTE FUNCTION update_email_list_count();