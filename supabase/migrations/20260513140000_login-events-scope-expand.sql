-- Expand login-event RPCs so association managers and company owners/admins
-- can use them too, scoped to their own members.
--
-- - Super admin   -> all login data
-- - Association   -> members of companies in any association they manage
-- - Company owner -> members of their company only

CREATE OR REPLACE FUNCTION public.get_users_last_login(p_user_ids uuid[])
RETURNS TABLE (user_id uuid, last_sign_in_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  v_is_admin := EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = auth.uid() AND is_active = true
  );

  IF v_is_admin THEN
    RETURN QUERY
    SELECT u.id, u.last_sign_in_at
    FROM auth.users u
    WHERE u.id = ANY(p_user_ids);
    RETURN;
  END IF;

  RETURN QUERY
  SELECT u.id, u.last_sign_in_at
  FROM auth.users u
  WHERE u.id = ANY(p_user_ids)
    AND (
      EXISTS (
        SELECT 1
        FROM public.association_managers am
        JOIN public.companies c ON c.association_id = am.association_id
        JOIN public.members m ON m.company_id = c.id
        WHERE am.user_id = auth.uid()
          AND am.is_active = true
          AND m.user_id = u.id
          AND m.is_active = true
      )
      OR EXISTS (
        SELECT 1
        FROM public.members caller
        JOIN public.members target ON target.company_id = caller.company_id
        WHERE caller.user_id = auth.uid()
          AND caller.role IN ('owner', 'admin')
          AND caller.is_active = true
          AND target.user_id = u.id
          AND target.is_active = true
      )
    );
END;
$$;


CREATE OR REPLACE FUNCTION public.get_login_activity(p_start_date timestamptz)
RETURNS TABLE (day date, login_count bigint, unique_users bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  v_is_admin := EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = auth.uid() AND is_active = true
  );

  IF v_is_admin THEN
    RETURN QUERY
    SELECT
      date_trunc('day', e.occurred_at)::date AS day,
      count(*)::bigint AS login_count,
      count(DISTINCT e.user_id)::bigint AS unique_users
    FROM public.login_events e
    WHERE e.occurred_at >= p_start_date
    GROUP BY 1
    ORDER BY 1;
    RETURN;
  END IF;

  RETURN QUERY
  WITH visible_users AS (
    SELECT m.user_id
    FROM public.association_managers am
    JOIN public.companies c ON c.association_id = am.association_id
    JOIN public.members m ON m.company_id = c.id
    WHERE am.user_id = auth.uid()
      AND am.is_active = true
      AND m.is_active = true
    UNION
    SELECT target.user_id
    FROM public.members caller
    JOIN public.members target ON target.company_id = caller.company_id
    WHERE caller.user_id = auth.uid()
      AND caller.role IN ('owner', 'admin')
      AND caller.is_active = true
      AND target.is_active = true
  )
  SELECT
    date_trunc('day', e.occurred_at)::date AS day,
    count(*)::bigint AS login_count,
    count(DISTINCT e.user_id)::bigint AS unique_users
  FROM public.login_events e
  JOIN visible_users v ON v.user_id = e.user_id
  WHERE e.occurred_at >= p_start_date
  GROUP BY 1
  ORDER BY 1;
END;
$$;
