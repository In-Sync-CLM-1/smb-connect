-- Create WhatsApp Lists table
CREATE TABLE public.whatsapp_lists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  total_recipients INTEGER NOT NULL DEFAULT 0,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create WhatsApp List Recipients table
CREATE TABLE public.whatsapp_list_recipients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  list_id UUID NOT NULL REFERENCES public.whatsapp_lists(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  name TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create WhatsApp Templates table
CREATE TABLE public.whatsapp_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  template_type TEXT NOT NULL,
  body_text TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  association_id UUID REFERENCES public.associations(id),
  company_id UUID REFERENCES public.companies(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create WhatsApp Conversations table
CREATE TABLE public.whatsapp_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID NOT NULL,
  sender_type TEXT NOT NULL,
  recipient_id UUID NOT NULL,
  recipient_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  last_message_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create WhatsApp Messages table
CREATE TABLE public.whatsapp_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  sender_phone TEXT NOT NULL,
  sender_name TEXT,
  recipient_phone TEXT NOT NULL,
  body_text TEXT NOT NULL,
  direction TEXT NOT NULL,
  external_message_id TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.whatsapp_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_list_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for whatsapp_lists
CREATE POLICY "Super admins can view all whatsapp lists"
  ON public.whatsapp_lists FOR SELECT
  USING (is_super_admin(auth.uid()));

CREATE POLICY "Super admins can create whatsapp lists"
  ON public.whatsapp_lists FOR INSERT
  WITH CHECK (is_super_admin(auth.uid()) AND created_by = auth.uid());

CREATE POLICY "Super admins can update whatsapp lists"
  ON public.whatsapp_lists FOR UPDATE
  USING (is_super_admin(auth.uid()));

CREATE POLICY "Super admins can delete whatsapp lists"
  ON public.whatsapp_lists FOR DELETE
  USING (is_super_admin(auth.uid()));

-- RLS Policies for whatsapp_list_recipients
CREATE POLICY "Super admins can view all recipients"
  ON public.whatsapp_list_recipients FOR SELECT
  USING (is_super_admin(auth.uid()));

CREATE POLICY "Super admins can add recipients"
  ON public.whatsapp_list_recipients FOR INSERT
  WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "Super admins can update recipients"
  ON public.whatsapp_list_recipients FOR UPDATE
  USING (is_super_admin(auth.uid()));

CREATE POLICY "Super admins can delete recipients"
  ON public.whatsapp_list_recipients FOR DELETE
  USING (is_super_admin(auth.uid()));

-- RLS Policies for whatsapp_templates
CREATE POLICY "Users can view their templates"
  ON public.whatsapp_templates FOR SELECT
  USING (
    created_by = auth.uid() OR
    association_id IN (
      SELECT association_id FROM association_managers
      WHERE user_id = auth.uid() AND is_active = true
    ) OR
    company_id IN (
      SELECT company_id FROM members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND is_active = true
    )
  );

CREATE POLICY "Association managers can create templates"
  ON public.whatsapp_templates FOR INSERT
  WITH CHECK (
    created_by = auth.uid() AND (
      association_id IN (
        SELECT association_id FROM association_managers
        WHERE user_id = auth.uid() AND is_active = true
      ) OR association_id IS NULL
    )
  );

CREATE POLICY "Company admins can create templates"
  ON public.whatsapp_templates FOR INSERT
  WITH CHECK (
    created_by = auth.uid() AND (
      company_id IN (
        SELECT company_id FROM members
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND is_active = true
      ) OR company_id IS NULL
    )
  );

CREATE POLICY "Users can update their own templates"
  ON public.whatsapp_templates FOR UPDATE
  USING (created_by = auth.uid());

CREATE POLICY "Users can delete their own templates"
  ON public.whatsapp_templates FOR DELETE
  USING (created_by = auth.uid());

-- RLS Policies for whatsapp_conversations
CREATE POLICY "Users can view their own conversations"
  ON public.whatsapp_conversations FOR SELECT
  USING (
    (sender_type = 'association' AND sender_id IN (
      SELECT association_id FROM association_managers
      WHERE user_id = auth.uid() AND is_active = true
    )) OR
    (sender_type = 'company' AND sender_id IN (
      SELECT company_id FROM members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND is_active = true
    )) OR
    (recipient_type = 'company' AND recipient_id IN (
      SELECT company_id FROM members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND is_active = true
    )) OR
    (recipient_type = 'member' AND recipient_id = auth.uid())
  );

CREATE POLICY "Association managers can create conversations"
  ON public.whatsapp_conversations FOR INSERT
  WITH CHECK (
    sender_type = 'association' AND sender_id IN (
      SELECT association_id FROM association_managers
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Company admins can create conversations"
  ON public.whatsapp_conversations FOR INSERT
  WITH CHECK (
    sender_type = 'company' AND sender_id IN (
      SELECT company_id FROM members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND is_active = true
    )
  );

-- RLS Policies for whatsapp_messages
CREATE POLICY "Users can view messages in their conversations"
  ON public.whatsapp_messages FOR SELECT
  USING (
    conversation_id IN (
      SELECT id FROM whatsapp_conversations
      WHERE (
        (sender_type = 'association' AND sender_id IN (
          SELECT association_id FROM association_managers
          WHERE user_id = auth.uid() AND is_active = true
        )) OR
        (sender_type = 'company' AND sender_id IN (
          SELECT company_id FROM members
          WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND is_active = true
        )) OR
        (recipient_type = 'company' AND recipient_id IN (
          SELECT company_id FROM members
          WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND is_active = true
        )) OR
        (recipient_type = 'member' AND recipient_id = auth.uid())
      )
    )
  );

CREATE POLICY "System can insert messages"
  ON public.whatsapp_messages FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can mark messages as read"
  ON public.whatsapp_messages FOR UPDATE
  USING (
    conversation_id IN (
      SELECT id FROM whatsapp_conversations
      WHERE (
        (recipient_type = 'company' AND recipient_id IN (
          SELECT company_id FROM members
          WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND is_active = true
        )) OR
        (recipient_type = 'member' AND recipient_id = auth.uid())
      )
    )
  );

-- Create function to update whatsapp list count
CREATE OR REPLACE FUNCTION public.update_whatsapp_list_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  UPDATE whatsapp_lists
  SET total_recipients = (
    SELECT COUNT(*) FROM whatsapp_list_recipients WHERE list_id = COALESCE(NEW.list_id, OLD.list_id)
  )
  WHERE id = COALESCE(NEW.list_id, OLD.list_id);
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create trigger for whatsapp list count
CREATE TRIGGER update_whatsapp_list_count_trigger
AFTER INSERT OR DELETE ON public.whatsapp_list_recipients
FOR EACH ROW
EXECUTE FUNCTION public.update_whatsapp_list_count();

-- Create indexes for better performance
CREATE INDEX idx_whatsapp_list_recipients_list_id ON public.whatsapp_list_recipients(list_id);
CREATE INDEX idx_whatsapp_messages_conversation_id ON public.whatsapp_messages(conversation_id);
CREATE INDEX idx_whatsapp_conversations_sender ON public.whatsapp_conversations(sender_id, sender_type);
CREATE INDEX idx_whatsapp_conversations_recipient ON public.whatsapp_conversations(recipient_id, recipient_type);