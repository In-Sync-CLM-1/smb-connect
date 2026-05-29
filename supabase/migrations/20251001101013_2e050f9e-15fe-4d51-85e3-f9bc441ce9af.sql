-- Fix the security definer view issue by recreating it with SECURITY INVOKER
DROP VIEW IF EXISTS duplicate_companies_monitor;

CREATE OR REPLACE VIEW duplicate_companies_monitor 
WITH (security_invoker = true) AS
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