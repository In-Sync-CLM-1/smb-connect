-- Fix function search path for update_reposts_count
CREATE OR REPLACE FUNCTION update_reposts_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.original_post_id IS NOT NULL THEN
    UPDATE public.posts 
    SET reposts_count = reposts_count + 1 
    WHERE id = NEW.original_post_id;
  ELSIF TG_OP = 'DELETE' AND OLD.original_post_id IS NOT NULL THEN
    UPDATE public.posts 
    SET reposts_count = reposts_count - 1 
    WHERE id = OLD.original_post_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SET search_path = public;