-- Track every successful login so we can show a "Last Logged In" timestamp
-- per user and render a login-activity time graph in User Management.
--
-- Source of truth: auth.users.last_sign_in_at gets updated by GoTrue on each
-- successful sign-in. A trigger mirrors that change into public.login_events.

-- 1. Storage for each login event
CREATE TABLE IF NOT EXISTS public.login_events (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_login_events_occurred_at
  ON public.login_events(occurred_at);
CREATE INDEX IF NOT EXISTS idx_login_events_user_occurred
  ON public.login_events(user_id, occurred_at);

ALTER TABLE public.login_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read login events" ON public.login_events;
CREATE POLICY "Admins can read login events"
  ON public.login_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- 2. Backfill from the most recent sign-in we already know about
--    (one row per ever-logged-in user). Skip if a matching row already exists.
INSERT INTO public.login_events (user_id, occurred_at)
SELECT u.id, u.last_sign_in_at
FROM auth.users u
WHERE u.last_sign_in_at IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.login_events e
    WHERE e.user_id = u.id AND e.occurred_at = u.last_sign_in_at
  );

-- 3. Trigger: record each new sign-in as last_sign_in_at advances
CREATE OR REPLACE FUNCTION public.record_login_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.last_sign_in_at IS DISTINCT FROM OLD.last_sign_in_at
     AND NEW.last_sign_in_at IS NOT NULL THEN
    INSERT INTO public.login_events (user_id, occurred_at)
    VALUES (NEW.id, NEW.last_sign_in_at);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_record_login_event ON auth.users;
CREATE TRIGGER trg_record_login_event
AFTER UPDATE OF last_sign_in_at ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.record_login_event();

-- 4. RPC: last sign-in per user (admin-only). Bulk-friendly: pass an array of
-- user IDs and get back their last_sign_in_at values.
CREATE OR REPLACE FUNCTION public.get_users_last_login(p_user_ids uuid[])
RETURNS TABLE (user_id uuid, last_sign_in_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = auth.uid() AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Forbidden: admin access required';
  END IF;

  RETURN QUERY
  SELECT u.id, u.last_sign_in_at
  FROM auth.users u
  WHERE u.id = ANY(p_user_ids);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_users_last_login(uuid[]) TO authenticated;

-- 5. RPC: daily login activity since p_start_date (admin-only). Returns one
-- row per day with total login events and distinct active users for the day.
CREATE OR REPLACE FUNCTION public.get_login_activity(p_start_date timestamptz)
RETURNS TABLE (day date, login_count bigint, unique_users bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = auth.uid() AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Forbidden: admin access required';
  END IF;

  RETURN QUERY
  SELECT
    date_trunc('day', e.occurred_at)::date AS day,
    count(*)::bigint AS login_count,
    count(DISTINCT e.user_id)::bigint AS unique_users
  FROM public.login_events e
  WHERE e.occurred_at >= p_start_date
  GROUP BY 1
  ORDER BY 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_login_activity(timestamptz) TO authenticated;
