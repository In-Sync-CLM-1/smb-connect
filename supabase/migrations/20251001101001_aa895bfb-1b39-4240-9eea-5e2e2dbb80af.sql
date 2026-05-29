-- Step 1: Create a temporary table to identify duplicates and which ones to keep
CREATE TEMP TABLE companies_to_keep AS
SELECT DISTINCT ON (name, association_id)
  id as keep_id,
  name,
  association_id
FROM companies
ORDER BY name, association_id, created_at ASC; -- Keep the oldest one

-- Step 2: Delete duplicate companies (keep only the oldest for each name+association)
DELETE FROM companies
WHERE id NOT IN (SELECT keep_id FROM companies_to_keep);

-- Step 3: Add unique constraint to prevent future duplicates
ALTER TABLE companies 
ADD CONSTRAINT unique_company_name_per_association 
UNIQUE (name, association_id);

-- Step 4: Create a view to monitor for any future duplicate attempts
CREATE OR REPLACE VIEW duplicate_companies_monitor AS
SELECT 
  name,
  association_id,
  COUNT(*) as duplicate_count,
  ARRAY_AGG(id ORDER BY created_at) as company_ids,
  MIN(created_at) as first_created,
  MAX(created_at) as last_created
FROM companies
GROUP BY name, association_id
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC, name;