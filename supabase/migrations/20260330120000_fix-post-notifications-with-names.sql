-- Replace generic notify_association_post with a unified notify_new_post
-- that handles association, company, and member posts with proper names.

-- Drop old trigger and function
DROP TRIGGER IF EXISTS on_association_post ON public.posts;
DROP FUNCTION IF EXISTS public.notify_association_post();

-- Unified notification function for all post types
CREATE OR REPLACE FUNCTION public.notify_new_post()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  poster_name text;
  notif_type text;
  notif_title text;
  notif_message text;
  notif_link text;
  notif_data jsonb;
BEGIN

  -- ── Association post ──────────────────────────────────────────────
  IF NEW.post_context = 'association' AND NEW.organization_id IS NOT NULL THEN

    SELECT name INTO poster_name
    FROM associations WHERE id = NEW.organization_id;

    IF poster_name IS NULL THEN RETURN NEW; END IF;

    notif_type    := 'association_post';
    notif_title   := 'Update from ' || poster_name;
    notif_message := poster_name || ' shared a new post';
    notif_link    := '/feed';
    notif_data    := jsonb_build_object(
      'post_id', NEW.id,
      'association_id', NEW.organization_id,
      'association_name', poster_name
    );

    INSERT INTO notifications (user_id, type, category, title, message, link, data)
    SELECT DISTINCT
      m.user_id,
      notif_type, 'updates', notif_title, notif_message, notif_link, notif_data
    FROM members m
    WHERE m.is_active = true
      AND m.user_id != NEW.user_id;

  -- ── Company post ──────────────────────────────────────────────────
  ELSIF NEW.post_context = 'company' AND NEW.organization_id IS NOT NULL THEN

    SELECT name INTO poster_name
    FROM companies WHERE id = NEW.organization_id;

    IF poster_name IS NULL THEN RETURN NEW; END IF;

    notif_type    := 'company_post';
    notif_title   := 'Update from ' || poster_name;
    notif_message := poster_name || ' shared a new post';
    notif_link    := '/company/feed';
    notif_data    := jsonb_build_object(
      'post_id', NEW.id,
      'company_id', NEW.organization_id,
      'company_name', poster_name
    );

    INSERT INTO notifications (user_id, type, category, title, message, link, data)
    SELECT DISTINCT
      m.user_id,
      notif_type, 'updates', notif_title, notif_message, notif_link, notif_data
    FROM members m
    WHERE m.company_id = NEW.organization_id
      AND m.is_active = true
      AND m.user_id != NEW.user_id;

  -- ── Member post ───────────────────────────────────────────────────
  ELSE

    SELECT CONCAT(p.first_name, ' ', p.last_name) INTO poster_name
    FROM profiles p WHERE p.id = NEW.user_id;

    IF poster_name IS NULL OR TRIM(poster_name) = '' THEN RETURN NEW; END IF;

    notif_type    := 'member_post';
    notif_title   := 'New post from ' || poster_name;
    notif_message := poster_name || ' shared a new post';
    notif_link    := '/feed';
    notif_data    := jsonb_build_object(
      'post_id', NEW.id,
      'poster_name', poster_name
    );

    -- Notify accepted connections (both directions)
    INSERT INTO notifications (user_id, type, category, title, message, link, data)
    SELECT DISTINCT
      m_conn.user_id,
      notif_type, 'updates', notif_title, notif_message, notif_link, notif_data
    FROM members m_poster
    JOIN connections c ON (
      (c.sender_id = m_poster.id OR c.receiver_id = m_poster.id)
      AND c.status = 'accepted'
    )
    JOIN members m_conn ON m_conn.id = CASE
      WHEN c.sender_id = m_poster.id THEN c.receiver_id
      ELSE c.sender_id
    END
    WHERE m_poster.user_id = NEW.user_id
      AND m_conn.is_active = true
      AND m_conn.user_id != NEW.user_id;

  END IF;

  RETURN NEW;
END;
$$;

-- Create the trigger
CREATE TRIGGER on_new_post
  AFTER INSERT ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_post();
