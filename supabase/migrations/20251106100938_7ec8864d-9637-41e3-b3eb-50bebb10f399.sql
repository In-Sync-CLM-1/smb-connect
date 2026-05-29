-- Drop the problematic constraint that prevents users from having multiple member records
ALTER TABLE members DROP CONSTRAINT IF EXISTS members_user_id_unique;

-- Add composite unique constraint to prevent duplicate company memberships
-- This allows users to be members of multiple companies
ALTER TABLE members ADD CONSTRAINT members_user_company_unique 
  UNIQUE (user_id, company_id);

-- Add partial unique index for orphaned members
-- This allows only one NULL company per user (independent members)
CREATE UNIQUE INDEX members_user_orphaned_unique 
  ON members (user_id) 
  WHERE company_id IS NULL;