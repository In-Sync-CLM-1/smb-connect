-- RPC: get_event_onboarding_report
-- Returns all registrants for a given event landing page, along with
-- their onboarding completion status. Runs as SECURITY DEFINER to bypass
-- RLS on user_onboarding (which is otherwise restricted to own rows).

CREATE OR REPLACE FUNCTION public.get_event_onboarding_report(p_landing_page_id uuid)
RETURNS TABLE (
  registration_id     uuid,
  first_name          text,
  last_name           text,
  email               text,
  phone               text,
  registered_at       timestamptz,
  onboarding_completed  boolean,
  onboarding_completed_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    er.id                     AS registration_id,
    er.first_name,
    er.last_name,
    er.email,
    er.phone,
    er.created_at             AS registered_at,
    COALESCE(uo.is_completed, false) AS onboarding_completed,
    CASE WHEN uo.is_completed THEN uo.updated_at ELSE NULL END AS onboarding_completed_at
  FROM event_registrations er
  LEFT JOIN user_onboarding uo ON uo.user_id = er.user_id
  WHERE er.landing_page_id = p_landing_page_id
    AND er.status = 'completed'
  ORDER BY er.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_event_onboarding_report(uuid) TO authenticated;
