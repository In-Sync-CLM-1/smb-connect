-- Create storage bucket for association logos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'association-logos',
  'association-logos',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/jpg']
);

-- RLS policies for association logos
CREATE POLICY "Anyone can view association logos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'association-logos');

CREATE POLICY "Association managers can upload logos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'association-logos' AND
    EXISTS (
      SELECT 1 FROM association_managers am
      WHERE am.user_id = auth.uid()
      AND am.is_active = true
    )
  );

CREATE POLICY "Association managers can update logos"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'association-logos' AND
    EXISTS (
      SELECT 1 FROM association_managers am
      WHERE am.user_id = auth.uid()
      AND am.is_active = true
    )
  );

CREATE POLICY "Association managers can delete logos"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'association-logos' AND
    EXISTS (
      SELECT 1 FROM association_managers am
      WHERE am.user_id = auth.uid()
      AND am.is_active = true
    )
  );

-- Add keywords and social links to associations table
ALTER TABLE associations
ADD COLUMN IF NOT EXISTS keywords TEXT[],
ADD COLUMN IF NOT EXISTS social_links JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS founded_year INTEGER;

-- Create key_functionaries table
CREATE TABLE key_functionaries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  association_id UUID NOT NULL REFERENCES associations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  designation TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  photo TEXT,
  bio TEXT,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on key_functionaries
ALTER TABLE key_functionaries ENABLE ROW LEVEL SECURITY;

-- Anyone can view active functionaries
CREATE POLICY "Anyone can view active functionaries"
  ON key_functionaries FOR SELECT
  USING (is_active = true);

-- Association managers can manage their functionaries
CREATE POLICY "Association managers can manage functionaries"
  ON key_functionaries FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM association_managers am
      WHERE am.association_id = key_functionaries.association_id
      AND am.user_id = auth.uid()
      AND am.is_active = true
    )
  );

-- Admins can manage all functionaries
CREATE POLICY "Admins can manage all functionaries"
  ON key_functionaries FOR ALL
  USING (is_admin(auth.uid()));

-- Add updated_at trigger
CREATE TRIGGER update_key_functionaries_updated_at
  BEFORE UPDATE ON key_functionaries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create indexes
CREATE INDEX idx_key_functionaries_association ON key_functionaries(association_id, display_order);
CREATE INDEX idx_associations_keywords ON associations USING GIN(keywords);