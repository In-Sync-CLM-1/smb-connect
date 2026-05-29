-- Create a new public bucket for email images used in bulk campaigns
-- This bucket will have no RLS policies, allowing all authenticated users to upload
INSERT INTO storage.buckets (id, name, public)
VALUES ('email-images', 'email-images', true);