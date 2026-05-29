-- Create trigger to generate notifications when comments are added to posts
CREATE TRIGGER on_post_comment
AFTER INSERT ON public.post_comments
FOR EACH ROW
EXECUTE FUNCTION public.notify_post_comment();