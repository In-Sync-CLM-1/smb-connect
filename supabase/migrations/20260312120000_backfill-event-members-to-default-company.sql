-- Backfill: Assign event-registered members with NULL company_id to their association's default company
--
-- Problem: The handle_new_user trigger creates member records with company_id = NULL.
-- The process-event-registration edge function did not assign them to the default company.
-- This migration retroactively fixes all existing orphaned event registrants.

-- For each event registration that has a user_id, find the association's default company
-- and update the member record if company_id is still NULL.
UPDATE public.members m
SET company_id = dc.id
FROM public.event_registrations er
JOIN public.event_landing_pages elp ON elp.id = er.landing_page_id
JOIN public.companies dc ON dc.association_id = elp.association_id
  AND dc.is_default = true
  AND dc.is_active = true
WHERE er.user_id = m.user_id
  AND m.company_id IS NULL
  AND m.is_active = true;
