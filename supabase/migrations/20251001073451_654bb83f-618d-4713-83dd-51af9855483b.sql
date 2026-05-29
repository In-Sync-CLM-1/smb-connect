-- Create association_requests table
CREATE TABLE association_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  contact_email TEXT NOT NULL,
  contact_phone TEXT,
  website TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  country TEXT DEFAULT 'India',
  postal_code TEXT,
  status TEXT DEFAULT 'pending',
  admin_notes TEXT,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE association_requests ENABLE ROW LEVEL SECURITY;

-- Users can view their own requests
CREATE POLICY "Users can view own requests"
  ON association_requests FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create requests
CREATE POLICY "Users can create requests"
  ON association_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Admins can view all requests
CREATE POLICY "Admins can view all requests"
  ON association_requests FOR SELECT
  USING (is_admin(auth.uid()));

-- Admins can update requests
CREATE POLICY "Admins can update requests"
  ON association_requests FOR UPDATE
  USING (is_admin(auth.uid()));

-- Add updated_at trigger
CREATE TRIGGER update_association_requests_updated_at
  BEFORE UPDATE ON association_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create index for better performance
CREATE INDEX idx_association_requests_user ON association_requests(user_id, status);
CREATE INDEX idx_association_requests_status ON association_requests(status, created_at DESC);