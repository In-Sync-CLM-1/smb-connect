-- Create member_invitations table
CREATE TABLE IF NOT EXISTS public.member_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  organization_type TEXT NOT NULL CHECK (organization_type IN ('association', 'company')),
  email TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  role TEXT NOT NULL,
  designation TEXT,
  department TEXT,
  token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')),
  invited_by UUID NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  accepted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create audit log table for invitation tracking
CREATE TABLE IF NOT EXISTS public.member_invitation_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invitation_id UUID NOT NULL REFERENCES public.member_invitations(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  performed_by UUID,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_member_invitations_token ON public.member_invitations(token);
CREATE INDEX IF NOT EXISTS idx_member_invitations_email ON public.member_invitations(email);
CREATE INDEX IF NOT EXISTS idx_member_invitations_status ON public.member_invitations(status);
CREATE INDEX IF NOT EXISTS idx_member_invitations_organization ON public.member_invitations(organization_id, organization_type);
CREATE INDEX IF NOT EXISTS idx_member_invitation_audit_invitation_id ON public.member_invitation_audit(invitation_id);

-- Enable RLS
ALTER TABLE public.member_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_invitation_audit ENABLE ROW LEVEL SECURITY;

-- RLS Policies for member_invitations

-- Admins can view all invitations
CREATE POLICY "Admins can view all invitations"
  ON public.member_invitations
  FOR SELECT
  USING (is_admin(auth.uid()));

-- Association managers can view their organization's invitations
CREATE POLICY "Association managers can view their invitations"
  ON public.member_invitations
  FOR SELECT
  USING (
    organization_type = 'association' AND
    organization_id IN (
      SELECT association_id FROM association_managers
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Company admins can view their organization's invitations
CREATE POLICY "Company admins can view their invitations"
  ON public.member_invitations
  FOR SELECT
  USING (
    organization_type = 'company' AND
    organization_id IN (
      SELECT company_id FROM members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND is_active = true
    )
  );

-- Association managers can create invitations
CREATE POLICY "Association managers can create invitations"
  ON public.member_invitations
  FOR INSERT
  WITH CHECK (
    organization_type = 'association' AND
    organization_id IN (
      SELECT association_id FROM association_managers
      WHERE user_id = auth.uid() AND is_active = true
    ) AND
    invited_by = auth.uid()
  );

-- Company admins can create invitations
CREATE POLICY "Company admins can create invitations"
  ON public.member_invitations
  FOR INSERT
  WITH CHECK (
    organization_type = 'company' AND
    organization_id IN (
      SELECT company_id FROM members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND is_active = true
    ) AND
    invited_by = auth.uid()
  );

-- Admins can update invitations
CREATE POLICY "Admins can update invitations"
  ON public.member_invitations
  FOR UPDATE
  USING (is_admin(auth.uid()));

-- Association managers can update their invitations
CREATE POLICY "Association managers can update their invitations"
  ON public.member_invitations
  FOR UPDATE
  USING (
    organization_type = 'association' AND
    organization_id IN (
      SELECT association_id FROM association_managers
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Company admins can update their invitations
CREATE POLICY "Company admins can update their invitations"
  ON public.member_invitations
  FOR UPDATE
  USING (
    organization_type = 'company' AND
    organization_id IN (
      SELECT company_id FROM members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND is_active = true
    )
  );

-- Super admins can delete invitations
CREATE POLICY "Super admins can delete invitations"
  ON public.member_invitations
  FOR DELETE
  USING (is_super_admin(auth.uid()));

-- RLS Policies for audit log
CREATE POLICY "Admins can view all audit logs"
  ON public.member_invitation_audit
  FOR SELECT
  USING (is_admin(auth.uid()));

-- System can insert audit logs
CREATE POLICY "System can insert audit logs"
  ON public.member_invitation_audit
  FOR INSERT
  WITH CHECK (true);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_member_invitations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_member_invitations_updated_at_trigger ON public.member_invitations;
CREATE TRIGGER update_member_invitations_updated_at_trigger
  BEFORE UPDATE ON public.member_invitations
  FOR EACH ROW
  EXECUTE FUNCTION update_member_invitations_updated_at();