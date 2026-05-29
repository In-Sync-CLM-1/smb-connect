-- Backfill: Add members records for all past event registrations
-- that don't already have a membership in the event's association

-- Step 1: Create default companies for associations that have event registrations but no companies
INSERT INTO public.companies (association_id, name, email, is_default, is_active, description)
SELECT DISTINCT
  elp.association_id,
  CONCAT(a.name, ' - General'),
  CONCAT('general@', LOWER(REGEXP_REPLACE(a.name, '[^a-zA-Z0-9]', '', 'g')), '.org'),
  true,
  true,
  'Default company for association members'
FROM public.event_registrations er
JOIN public.event_landing_pages elp ON elp.id = er.landing_page_id
JOIN public.associations a ON a.id = elp.association_id
WHERE er.user_id IS NOT NULL
  AND er.status = 'completed'
  AND elp.association_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.companies c
    WHERE c.association_id = elp.association_id
      AND c.is_active = true
  );

-- Step 2: Create member records for registered users who are not yet members of the association
INSERT INTO public.members (user_id, company_id, role, designation, is_active)
SELECT DISTINCT ON (er.user_id, target_company.id)
  er.user_id,
  target_company.id,
  'member',
  'Event Registrant',
  true
FROM public.event_registrations er
JOIN public.event_landing_pages elp ON elp.id = er.landing_page_id
JOIN LATERAL (
  -- Pick the default company first, otherwise the first active company
  SELECT c.id
  FROM public.companies c
  WHERE c.association_id = elp.association_id
    AND c.is_active = true
  ORDER BY c.is_default DESC NULLS LAST, c.created_at ASC
  LIMIT 1
) target_company ON true
WHERE er.user_id IS NOT NULL
  AND er.status = 'completed'
  AND elp.association_id IS NOT NULL
  -- Skip users who already have an active membership in any company under this association
  AND NOT EXISTS (
    SELECT 1 FROM public.members m
    JOIN public.companies mc ON mc.id = m.company_id
    WHERE m.user_id = er.user_id
      AND m.is_active = true
      AND mc.association_id = elp.association_id
  );
