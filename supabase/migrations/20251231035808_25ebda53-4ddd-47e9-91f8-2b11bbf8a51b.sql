-- Create post_bookmarks table
CREATE TABLE public.post_bookmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, post_id)
);

-- Enable RLS
ALTER TABLE public.post_bookmarks ENABLE ROW LEVEL SECURITY;

-- Policies: Users can manage their own bookmarks
CREATE POLICY "Users can view own bookmarks" ON public.post_bookmarks
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own bookmarks" ON public.post_bookmarks
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own bookmarks" ON public.post_bookmarks
  FOR DELETE USING (auth.uid() = user_id);

-- Add shares_count to posts table
ALTER TABLE public.posts ADD COLUMN shares_count integer DEFAULT 0;

-- Create post_shares table for analytics
CREATE TABLE public.post_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid,
  platform text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.post_shares ENABLE ROW LEVEL SECURITY;

-- Policies for post_shares
CREATE POLICY "Authenticated users can log shares" ON public.post_shares
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users can view share analytics" ON public.post_shares
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Create function to increment shares_count
CREATE OR REPLACE FUNCTION public.increment_shares_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.posts SET shares_count = COALESCE(shares_count, 0) + 1 WHERE id = NEW.post_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger
CREATE TRIGGER increment_post_shares_count
  AFTER INSERT ON public.post_shares
  FOR EACH ROW
  EXECUTE FUNCTION public.increment_shares_count();