-- RPC: get_connect_requests_report
-- Returns top 20 members by connections sent since p_start_date.
-- Runs as SECURITY DEFINER so it bypasses RLS on the connections table,
-- returning aggregate data for all members regardless of who calls it.
-- Only aggregate counts are returned (no raw connection rows), preserving privacy.

CREATE OR REPLACE FUNCTION public.get_connect_requests_report(p_start_date timestamptz)
RETURNS TABLE (
  member_id   uuid,
  full_name   text,
  total_sent  bigint,
  accepted    bigint,
  pending     bigint,
  rejected    bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.sender_id                                          AS member_id,
    TRIM(COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, '')) AS full_name,
    COUNT(*)                                             AS total_sent,
    COUNT(*) FILTER (WHERE c.status = 'accepted')        AS accepted,
    COUNT(*) FILTER (WHERE c.status = 'pending')         AS pending,
    COUNT(*) FILTER (WHERE c.status = 'rejected')        AS rejected
  FROM connections c
  JOIN members m ON m.id = c.sender_id
  JOIN profiles p ON p.id = m.user_id
  WHERE c.created_at >= p_start_date
  GROUP BY c.sender_id, p.first_name, p.last_name
  ORDER BY total_sent DESC
  LIMIT 20;
$$;

GRANT EXECUTE ON FUNCTION public.get_connect_requests_report(timestamptz) TO authenticated;
