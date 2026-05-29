-- Enable realtime for notifications table
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Function to notify on connection request
CREATE OR REPLACE FUNCTION public.notify_connection_request()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, category, title, message, link, data)
  SELECT 
    m_receiver.user_id,
    'connection_request',
    'connections',
    'New Connection Request',
    CONCAT(p_sender.first_name, ' ', p_sender.last_name, ' wants to connect with you'),
    '/connections',
    jsonb_build_object('connection_id', NEW.id, 'sender_member_id', NEW.sender_id)
  FROM members m_receiver
  JOIN members m_sender ON m_sender.id = NEW.sender_id
  JOIN profiles p_sender ON p_sender.id = m_sender.user_id
  WHERE m_receiver.id = NEW.receiver_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger for connection requests
DROP TRIGGER IF EXISTS on_connection_request ON public.connections;
CREATE TRIGGER on_connection_request
AFTER INSERT ON public.connections
FOR EACH ROW
WHEN (NEW.status = 'pending')
EXECUTE FUNCTION public.notify_connection_request();

-- Function to notify on connection accepted
CREATE OR REPLACE FUNCTION public.notify_connection_accepted()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'pending' AND NEW.status = 'accepted' THEN
    INSERT INTO public.notifications (user_id, type, category, title, message, link, data)
    SELECT 
      m_sender.user_id,
      'connection_accepted',
      'connections',
      'Connection Accepted',
      CONCAT(p_receiver.first_name, ' ', p_receiver.last_name, ' accepted your connection request'),
      '/connections',
      jsonb_build_object('connection_id', NEW.id, 'receiver_member_id', NEW.receiver_id)
    FROM members m_sender
    JOIN members m_receiver ON m_receiver.id = NEW.receiver_id
    JOIN profiles p_receiver ON p_receiver.id = m_receiver.user_id
    WHERE m_sender.id = NEW.sender_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger for connection accepted
DROP TRIGGER IF EXISTS on_connection_accepted ON public.connections;
CREATE TRIGGER on_connection_accepted
AFTER UPDATE ON public.connections
FOR EACH ROW
EXECUTE FUNCTION public.notify_connection_accepted();

-- Function to notify on post like
CREATE OR REPLACE FUNCTION public.notify_post_like()
RETURNS TRIGGER AS $$
DECLARE
  post_owner_id uuid;
  liker_name text;
  post_content_preview text;
BEGIN
  -- Get post owner
  SELECT user_id INTO post_owner_id FROM public.posts WHERE id = NEW.post_id;
  
  -- Don't notify if liking own post
  IF post_owner_id = NEW.user_id THEN
    RETURN NEW;
  END IF;
  
  -- Get liker name
  SELECT CONCAT(first_name, ' ', last_name) INTO liker_name FROM public.profiles WHERE id = NEW.user_id;
  
  -- Get post preview
  SELECT LEFT(content, 50) INTO post_content_preview FROM public.posts WHERE id = NEW.post_id;
  
  INSERT INTO public.notifications (user_id, type, category, title, message, link, data)
  VALUES (
    post_owner_id,
    'post_like',
    'engagement',
    'New Like',
    CONCAT(liker_name, ' liked your post'),
    '/feed',
    jsonb_build_object('post_id', NEW.post_id, 'liker_id', NEW.user_id, 'preview', post_content_preview)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger for post likes
DROP TRIGGER IF EXISTS on_post_like ON public.post_likes;
CREATE TRIGGER on_post_like
AFTER INSERT ON public.post_likes
FOR EACH ROW
EXECUTE FUNCTION public.notify_post_like();

-- Function to notify on post comment
CREATE OR REPLACE FUNCTION public.notify_post_comment()
RETURNS TRIGGER AS $$
DECLARE
  post_owner_id uuid;
  commenter_name text;
  comment_preview text;
BEGIN
  -- Get post owner
  SELECT user_id INTO post_owner_id FROM public.posts WHERE id = NEW.post_id;
  
  -- Don't notify if commenting on own post
  IF post_owner_id = NEW.user_id THEN
    RETURN NEW;
  END IF;
  
  -- Get commenter name
  SELECT CONCAT(first_name, ' ', last_name) INTO commenter_name FROM public.profiles WHERE id = NEW.user_id;
  
  -- Get comment preview
  comment_preview := LEFT(NEW.content, 50);
  
  INSERT INTO public.notifications (user_id, type, category, title, message, link, data)
  VALUES (
    post_owner_id,
    'post_comment',
    'engagement',
    'New Comment',
    CONCAT(commenter_name, ' commented on your post'),
    '/feed',
    jsonb_build_object('post_id', NEW.post_id, 'commenter_id', NEW.user_id, 'comment_preview', comment_preview)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;