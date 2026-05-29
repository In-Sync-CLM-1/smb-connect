
CREATE OR REPLACE FUNCTION public.notify_association_post()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  assoc_name text;
BEGIN
  IF NEW.post_context != 'association' OR NEW.organization_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT name INTO assoc_name
  FROM associations
  WHERE id = NEW.organization_id;

  INSERT INTO notifications (user_id, type, category, title, message, link, data)
  SELECT DISTINCT
    m.user_id,
    'association_post',
    'updates',
    'New Association Update',
    CONCAT(COALESCE(assoc_name, 'An association'), ' shared a new post'),
    '/feed',
    jsonb_build_object(
      'post_id', NEW.id,
      'association_id', NEW.organization_id,
      'association_name', assoc_name
    )
  FROM members m
  WHERE m.is_active = true
    AND m.user_id != NEW.user_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_association_post
  AFTER INSERT ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_association_post();
