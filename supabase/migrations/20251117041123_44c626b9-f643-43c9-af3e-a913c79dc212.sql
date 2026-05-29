-- Phase 1: Email Campaign Analytics Tables

-- 1.1 Create email_campaigns table
CREATE TABLE email_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Organization context
  association_id UUID REFERENCES associations(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  
  -- Campaign details
  list_id UUID NOT NULL REFERENCES email_lists(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  sender_email TEXT NOT NULL,
  
  -- Metadata
  created_by UUID NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Statistics (aggregated from events)
  total_recipients INTEGER NOT NULL DEFAULT 0,
  total_sent INTEGER NOT NULL DEFAULT 0,
  total_delivered INTEGER NOT NULL DEFAULT 0,
  total_opened INTEGER NOT NULL DEFAULT 0,
  total_clicked INTEGER NOT NULL DEFAULT 0,
  total_bounced INTEGER NOT NULL DEFAULT 0,
  total_complained INTEGER NOT NULL DEFAULT 0,
  total_unsubscribed INTEGER NOT NULL DEFAULT 0,
  
  -- Calculated metrics
  open_rate DECIMAL(5,2) DEFAULT 0.00,
  click_rate DECIMAL(5,2) DEFAULT 0.00,
  bounce_rate DECIMAL(5,2) DEFAULT 0.00,
  
  -- Sender.net tracking
  external_campaign_id TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  -- Constraint: campaign belongs to association OR company
  CONSTRAINT email_campaigns_org_check 
  CHECK (
    (association_id IS NOT NULL AND company_id IS NULL) OR 
    (association_id IS NULL AND company_id IS NOT NULL)
  )
);

CREATE INDEX idx_email_campaigns_association ON email_campaigns(association_id);
CREATE INDEX idx_email_campaigns_company ON email_campaigns(company_id);
CREATE INDEX idx_email_campaigns_list ON email_campaigns(list_id);
CREATE INDEX idx_email_campaigns_sent_at ON email_campaigns(sent_at);

-- 1.2 Create email_campaign_recipients table
CREATE TABLE email_campaign_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES email_campaigns(id) ON DELETE CASCADE,
  
  email TEXT NOT NULL,
  name TEXT,
  
  -- Tracking status
  sent BOOLEAN DEFAULT false,
  delivered BOOLEAN DEFAULT false,
  opened BOOLEAN DEFAULT false,
  clicked BOOLEAN DEFAULT false,
  bounced BOOLEAN DEFAULT false,
  complained BOOLEAN DEFAULT false,
  unsubscribed BOOLEAN DEFAULT false,
  
  -- Event timestamps
  sent_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  first_opened_at TIMESTAMP WITH TIME ZONE,
  last_opened_at TIMESTAMP WITH TIME ZONE,
  first_clicked_at TIMESTAMP WITH TIME ZONE,
  last_clicked_at TIMESTAMP WITH TIME ZONE,
  bounced_at TIMESTAMP WITH TIME ZONE,
  
  -- Engagement metrics
  open_count INTEGER DEFAULT 0,
  click_count INTEGER DEFAULT 0,
  
  -- External tracking
  external_message_id TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_campaign_recipients_campaign ON email_campaign_recipients(campaign_id);
CREATE INDEX idx_campaign_recipients_email ON email_campaign_recipients(email);
CREATE INDEX idx_campaign_recipients_opened ON email_campaign_recipients(opened);
CREATE INDEX idx_campaign_recipients_clicked ON email_campaign_recipients(clicked);

-- 1.3 Create email_campaign_events table
CREATE TABLE email_campaign_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES email_campaigns(id) ON DELETE CASCADE,
  recipient_id UUID REFERENCES email_campaign_recipients(id) ON DELETE CASCADE,
  
  event_type TEXT NOT NULL,
  event_data JSONB,
  
  recipient_email TEXT NOT NULL,
  external_message_id TEXT,
  
  ip_address TEXT,
  user_agent TEXT,
  
  occurred_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_campaign_events_campaign ON email_campaign_events(campaign_id);
CREATE INDEX idx_campaign_events_recipient ON email_campaign_events(recipient_id);
CREATE INDEX idx_campaign_events_type ON email_campaign_events(event_type);
CREATE INDEX idx_campaign_events_occurred ON email_campaign_events(occurred_at);

-- 1.4 Create function to update campaign statistics
CREATE OR REPLACE FUNCTION update_campaign_statistics()
RETURNS TRIGGER AS $$
DECLARE
  v_total_sent INTEGER;
  v_total_delivered INTEGER;
  v_total_opened INTEGER;
  v_total_clicked INTEGER;
  v_total_bounced INTEGER;
  v_total_complained INTEGER;
  v_total_unsubscribed INTEGER;
BEGIN
  SELECT 
    COUNT(*) FILTER (WHERE sent = true),
    COUNT(*) FILTER (WHERE delivered = true),
    COUNT(*) FILTER (WHERE opened = true),
    COUNT(*) FILTER (WHERE clicked = true),
    COUNT(*) FILTER (WHERE bounced = true),
    COUNT(*) FILTER (WHERE complained = true),
    COUNT(*) FILTER (WHERE unsubscribed = true)
  INTO 
    v_total_sent,
    v_total_delivered,
    v_total_opened,
    v_total_clicked,
    v_total_bounced,
    v_total_complained,
    v_total_unsubscribed
  FROM email_campaign_recipients 
  WHERE campaign_id = NEW.campaign_id;
  
  UPDATE email_campaigns
  SET 
    total_sent = v_total_sent,
    total_delivered = v_total_delivered,
    total_opened = v_total_opened,
    total_clicked = v_total_clicked,
    total_bounced = v_total_bounced,
    total_complained = v_total_complained,
    total_unsubscribed = v_total_unsubscribed,
    open_rate = CASE WHEN v_total_delivered > 0 THEN ROUND((v_total_opened::DECIMAL / v_total_delivered * 100)::NUMERIC, 2) ELSE 0 END,
    click_rate = CASE WHEN v_total_delivered > 0 THEN ROUND((v_total_clicked::DECIMAL / v_total_delivered * 100)::NUMERIC, 2) ELSE 0 END,
    bounce_rate = CASE WHEN v_total_sent > 0 THEN ROUND((v_total_bounced::DECIMAL / v_total_sent * 100)::NUMERIC, 2) ELSE 0 END,
    updated_at = now()
  WHERE id = NEW.campaign_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_campaign_statistics
AFTER INSERT OR UPDATE ON email_campaign_recipients
FOR EACH ROW
EXECUTE FUNCTION update_campaign_statistics();

-- 1.5 RLS Policies for Campaign Tables

-- email_campaigns policies
ALTER TABLE email_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins view all campaigns"
ON email_campaigns FOR SELECT
TO authenticated
USING (is_super_admin(auth.uid()));

CREATE POLICY "Association managers view campaigns"
ON email_campaigns FOR SELECT
TO authenticated
USING (
  association_id IN (
    SELECT association_id FROM association_managers
    WHERE user_id = auth.uid() AND is_active = true
  )
);

CREATE POLICY "Company admins view campaigns"
ON email_campaigns FOR SELECT
TO authenticated
USING (
  company_id IN (
    SELECT company_id FROM members
    WHERE user_id = auth.uid() 
    AND role IN ('owner', 'admin')
    AND is_active = true
  )
);

CREATE POLICY "System can create campaigns"
ON email_campaigns FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "System can update campaigns"
ON email_campaigns FOR UPDATE
TO authenticated
USING (true);

-- email_campaign_recipients policies
ALTER TABLE email_campaign_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view recipients of their campaigns"
ON email_campaign_recipients FOR SELECT
TO authenticated
USING (
  campaign_id IN (SELECT id FROM email_campaigns)
);

CREATE POLICY "System can manage campaign recipients"
ON email_campaign_recipients FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- email_campaign_events policies
ALTER TABLE email_campaign_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view events of their campaigns"
ON email_campaign_events FOR SELECT
TO authenticated
USING (
  campaign_id IN (SELECT id FROM email_campaigns)
);

CREATE POLICY "System can create campaign events"
ON email_campaign_events FOR INSERT
TO authenticated
WITH CHECK (true);