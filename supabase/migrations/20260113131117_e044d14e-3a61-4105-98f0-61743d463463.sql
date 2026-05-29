-- Add context columns to posts table to distinguish between member, association, and company posts
ALTER TABLE public.posts 
ADD COLUMN IF NOT EXISTS post_context text DEFAULT 'member',
ADD COLUMN IF NOT EXISTS organization_id uuid DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.posts.post_context IS 'Context where post was created: member, association, or company';
COMMENT ON COLUMN public.posts.organization_id IS 'ID of the association or company if post_context is not member';

-- Create index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_posts_post_context ON public.posts(post_context);
CREATE INDEX IF NOT EXISTS idx_posts_organization_id ON public.posts(organization_id);