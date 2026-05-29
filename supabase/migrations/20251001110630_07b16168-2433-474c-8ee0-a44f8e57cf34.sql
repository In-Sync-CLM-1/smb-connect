-- Create email conversations table
CREATE TABLE public.email_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  subject TEXT NOT NULL,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('association', 'company')),
  sender_id UUID NOT NULL,
  recipient_type TEXT NOT NULL CHECK (recipient_type IN ('company', 'member')),
  recipient_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'deleted')),
  last_message_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create email messages table
CREATE TABLE public.email_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.email_conversations(id) ON DELETE CASCADE,
  sender_email TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  body_text TEXT,
  direction TEXT NOT NULL CHECK (direction IN ('outbound', 'inbound')),
  external_message_id TEXT,
  sender_name TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create email templates table
CREATE TABLE public.email_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  body_text TEXT,
  template_type TEXT NOT NULL CHECK (template_type IN ('joining_invitation', 'reminder', 'announcement', 'custom')),
  created_by UUID NOT NULL,
  association_id UUID,
  company_id UUID,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for email_conversations
CREATE POLICY "Users can view their own conversations"
  ON public.email_conversations FOR SELECT
  USING (
    (sender_type = 'association' AND sender_id IN (
      SELECT association_id FROM association_managers WHERE user_id = auth.uid() AND is_active = true
    ))
    OR
    (sender_type = 'company' AND sender_id IN (
      SELECT company_id FROM members WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND is_active = true
    ))
    OR
    (recipient_type = 'company' AND recipient_id IN (
      SELECT company_id FROM members WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND is_active = true
    ))
    OR
    (recipient_type = 'member' AND recipient_id = auth.uid())
  );

CREATE POLICY "Association managers can create conversations"
  ON public.email_conversations FOR INSERT
  WITH CHECK (
    sender_type = 'association' AND sender_id IN (
      SELECT association_id FROM association_managers WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Company admins can create conversations"
  ON public.email_conversations FOR INSERT
  WITH CHECK (
    sender_type = 'company' AND sender_id IN (
      SELECT company_id FROM members WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND is_active = true
    )
  );

-- RLS Policies for email_messages
CREATE POLICY "Users can view messages in their conversations"
  ON public.email_messages FOR SELECT
  USING (
    conversation_id IN (
      SELECT id FROM email_conversations WHERE
        (sender_type = 'association' AND sender_id IN (
          SELECT association_id FROM association_managers WHERE user_id = auth.uid() AND is_active = true
        ))
        OR
        (sender_type = 'company' AND sender_id IN (
          SELECT company_id FROM members WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND is_active = true
        ))
        OR
        (recipient_type = 'company' AND recipient_id IN (
          SELECT company_id FROM members WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND is_active = true
        ))
        OR
        (recipient_type = 'member' AND recipient_id = auth.uid())
    )
  );

CREATE POLICY "System can insert messages"
  ON public.email_messages FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can mark messages as read"
  ON public.email_messages FOR UPDATE
  USING (
    conversation_id IN (
      SELECT id FROM email_conversations WHERE
        (recipient_type = 'company' AND recipient_id IN (
          SELECT company_id FROM members WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND is_active = true
        ))
        OR
        (recipient_type = 'member' AND recipient_id = auth.uid())
    )
  );

-- RLS Policies for email_templates
CREATE POLICY "Users can view their templates"
  ON public.email_templates FOR SELECT
  USING (
    created_by = auth.uid()
    OR
    (association_id IN (
      SELECT association_id FROM association_managers WHERE user_id = auth.uid() AND is_active = true
    ))
    OR
    (company_id IN (
      SELECT company_id FROM members WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND is_active = true
    ))
  );

CREATE POLICY "Association managers can create templates"
  ON public.email_templates FOR INSERT
  WITH CHECK (
    created_by = auth.uid() AND
    (
      association_id IN (
        SELECT association_id FROM association_managers WHERE user_id = auth.uid() AND is_active = true
      )
      OR association_id IS NULL
    )
  );

CREATE POLICY "Company admins can create templates"
  ON public.email_templates FOR INSERT
  WITH CHECK (
    created_by = auth.uid() AND
    (
      company_id IN (
        SELECT company_id FROM members WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND is_active = true
      )
      OR company_id IS NULL
    )
  );

CREATE POLICY "Users can update their own templates"
  ON public.email_templates FOR UPDATE
  USING (created_by = auth.uid());

CREATE POLICY "Users can delete their own templates"
  ON public.email_templates FOR DELETE
  USING (created_by = auth.uid());

-- Create indexes for performance
CREATE INDEX idx_email_conversations_sender ON public.email_conversations(sender_type, sender_id);
CREATE INDEX idx_email_conversations_recipient ON public.email_conversations(recipient_type, recipient_id);
CREATE INDEX idx_email_conversations_last_message ON public.email_conversations(last_message_at DESC);
CREATE INDEX idx_email_messages_conversation ON public.email_messages(conversation_id, sent_at DESC);
CREATE INDEX idx_email_messages_external_id ON public.email_messages(external_message_id);
CREATE INDEX idx_email_templates_type ON public.email_templates(template_type, is_active);

-- Add trigger for updated_at
CREATE TRIGGER update_email_conversations_updated_at
  BEFORE UPDATE ON public.email_conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_email_templates_updated_at
  BEFORE UPDATE ON public.email_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();