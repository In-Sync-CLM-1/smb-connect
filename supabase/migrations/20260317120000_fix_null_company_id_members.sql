-- Fix members with null company_id by assigning them to the default company of their association
-- This handles members created by event registration that were missing company_id

-- Update members with null company_id: find the association via event_registrations -> landing_pages
UPDATE members m
SET company_id = c.id
FROM event_registrations er
JOIN event_landing_pages elp ON er.landing_page_id = elp.id
JOIN companies c ON c.association_id = elp.association_id AND c.is_default = true AND c.is_active = true
WHERE m.user_id = er.user_id
  AND m.company_id IS NULL
  AND m.is_active = true;

-- For any remaining members with null company_id, try to assign them to any default company
-- based on the first event registration they have
UPDATE members m
SET company_id = sub.company_id
FROM (
  SELECT DISTINCT ON (er.user_id) er.user_id, c.id as company_id
  FROM event_registrations er
  JOIN event_landing_pages elp ON er.landing_page_id = elp.id
  JOIN companies c ON c.association_id = elp.association_id AND c.is_active = true
  WHERE c.is_default = true OR c.id = (
    SELECT id FROM companies
    WHERE association_id = elp.association_id AND is_active = true
    ORDER BY created_at ASC LIMIT 1
  )
  ORDER BY er.user_id, er.created_at ASC
) sub
WHERE m.user_id = sub.user_id
  AND m.company_id IS NULL
  AND m.is_active = true;
