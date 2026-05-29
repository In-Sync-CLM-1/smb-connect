-- Add token_hash column to member_invitations table
-- This stores the hashed version of the invitation token for security
ALTER TABLE member_invitations ADD COLUMN IF NOT EXISTS token_hash TEXT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_member_invitations_token_hash ON member_invitations(token_hash);

-- Update existing records to set token_hash equal to token (if any exist)
UPDATE member_invitations SET token_hash = token WHERE token_hash IS NULL;

-- Make token_hash required
ALTER TABLE member_invitations ALTER COLUMN token_hash SET NOT NULL;