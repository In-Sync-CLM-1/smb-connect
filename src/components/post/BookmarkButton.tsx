import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Bookmark } from 'lucide-react';

interface BookmarkButtonProps {
  postId: string;
  userId: string | null;
}

export function BookmarkButton({ postId, userId }: BookmarkButtonProps) {
  const { toast } = useToast();
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [loading, setLoading] = useState(false);
  const inFlight = useRef(false);

  useEffect(() => {
    if (userId) {
      checkBookmarkStatus();
    }
  }, [postId, userId]);

  const checkBookmarkStatus = async () => {
    if (!userId) return;
    
    try {
      const { data } = await supabase
        .from('post_bookmarks')
        .select('id')
        .eq('post_id', postId)
        .eq('user_id', userId)
        .maybeSingle();
      
      setIsBookmarked(!!data);
    } catch (error) {
      console.error('Error checking bookmark status:', error);
    }
  };

  const handleToggleBookmark = async () => {
    if (!userId) {
      toast({
        title: 'Login required',
        description: 'Please log in to save posts',
        variant: 'destructive',
      });
      return;
    }

    if (inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    try {
      if (isBookmarked) {
        // Remove bookmark
        const { error } = await supabase
          .from('post_bookmarks')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', userId);

        if (error) throw error;

        setIsBookmarked(false);
        toast({
          title: 'Removed from saved',
          description: 'Post removed from your saved posts',
        });
      } else {
        // Add bookmark
        const { error } = await supabase
          .from('post_bookmarks')
          .insert({
            post_id: postId,
            user_id: userId,
          });

        if (error) throw error;

        setIsBookmarked(true);
        toast({
          title: 'Post saved',
          description: 'Post added to your saved posts',
        });
      }
    } catch (error: any) {
      console.error('Error toggling bookmark:', error);
      toast({
        title: 'Error',
        description: 'Failed to update saved posts',
        variant: 'destructive',
      });
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleToggleBookmark}
      disabled={loading}
      className={`px-2 sm:px-3 ${isBookmarked ? 'text-primary' : ''}`}
    >
      <Bookmark className={`w-4 h-4 ${isBookmarked ? 'fill-current' : ''}`} />
    </Button>
  );
}