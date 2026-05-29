-- Add repost support to posts table
ALTER TABLE public.posts 
ADD COLUMN original_post_id uuid REFERENCES public.posts(id) ON DELETE CASCADE,
ADD COLUMN original_author_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Add index for better query performance
CREATE INDEX idx_posts_original_post_id ON public.posts(original_post_id);

-- Add check to prevent reposting your own posts
ALTER TABLE public.posts 
ADD CONSTRAINT no_self_repost 
CHECK (original_post_id IS NULL OR user_id != original_author_id);