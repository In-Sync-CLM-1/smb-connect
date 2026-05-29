-- Delete all orphaned member records (ones without company_id) for users who have a company-affiliated record
DELETE FROM members m1
WHERE m1.company_id IS NULL
AND EXISTS (
  SELECT 1 FROM members m2 
  WHERE m2.user_id = m1.user_id 
  AND m2.company_id IS NOT NULL
  AND m2.is_active = true
);

-- Now add the unique constraint
ALTER TABLE members DROP CONSTRAINT IF EXISTS members_user_id_unique;
ALTER TABLE members ADD CONSTRAINT members_user_id_unique UNIQUE (user_id);