-- Add reposts_count column to posts table
ALTER TABLE public.posts ADD COLUMN reposts_count integer DEFAULT 0;

-- Create trigger function to update repost count
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
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER trigger_update_reposts_count
AFTER INSERT OR DELETE ON public.posts
FOR EACH ROW EXECUTE FUNCTION update_reposts_count();

-- Backfill existing repost counts
UPDATE public.posts p
SET reposts_count = (
  SELECT COUNT(*) FROM public.posts rp WHERE rp.original_post_id = p.id
);