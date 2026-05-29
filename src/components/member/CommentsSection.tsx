import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { Send, Trash2 } from 'lucide-react';

interface Comment {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  profile: {
    first_name: string;
    last_name: string;
    avatar: string | null;
  };
}

interface CommentsSectionProps {
  postId: string;
  currentUserId: string | null;
  onCommentAdded: () => void;
}

export function CommentsSection({ postId, currentUserId, onCommentAdded }: CommentsSectionProps) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    loadComments();
  }, [postId]);

  const loadComments = async () => {
    try {
      setLoading(true);
      const { data: commentsData, error } = await supabase
        .from('post_comments')
        .select('*')
        .eq('post_id', postId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      if (!commentsData) {
        setComments([]);
        return;
      }

      // Batch fetch all profiles for commenters
      const userIds = Array.from(new Set(commentsData.map(c => c.user_id)));
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, avatar')
        .in('id', userIds);

      const profilesById = (profilesData || []).reduce((acc: Record<string, any>, p: any) => {
        acc[p.id] = p;
        return acc;
      }, {} as Record<string, any>);

      const commentsWithProfiles = commentsData.map(comment => ({
        ...comment,
        profile: profilesById[comment.user_id] || { first_name: '', last_name: '', avatar: null },
      }));

      setComments(commentsWithProfiles);
    } catch (error: any) {
      console.error('Error loading comments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !currentUserId) return;

    setPosting(true);
    try {
      const { error: insertError } = await supabase
        .from('post_comments')
        .insert({
          post_id: postId,
          user_id: currentUserId,
          content: newComment.trim(),
        });

      if (insertError) throw insertError;

      // Update comment count on post
      const { data: post } = await supabase
        .from('posts')
        .select('comments_count')
        .eq('id', postId)
        .single();

      if (post) {
        await supabase
          .from('posts')
          .update({ comments_count: post.comments_count + 1 })
          .eq('id', postId);
      }

      setNewComment('');
      loadComments();
      onCommentAdded();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to add comment',
        variant: 'destructive',
      });
    } finally {
      setPosting(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      const { error } = await supabase
        .from('post_comments')
        .delete()
        .eq('id', commentId);

      if (error) throw error;

      // Update comment count on post
      const { data: post } = await supabase
        .from('posts')
        .select('comments_count')
        .eq('id', postId)
        .single();

      if (post && post.comments_count > 0) {
        await supabase
          .from('posts')
          .update({ comments_count: post.comments_count - 1 })
          .eq('id', postId);
      }

      loadComments();
      onCommentAdded();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to delete comment',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="mt-4 space-y-4">
      {/* Add Comment */}
      {currentUserId && (
        <div className="flex gap-3">
          <Textarea
            placeholder="Write a comment..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            rows={2}
            className="resize-none"
          />
          <Button
            onClick={handleAddComment}
            disabled={!newComment.trim() || posting}
            size="icon"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Comments List */}
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading comments...</p>
      ) : comments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No comments yet</p>
      ) : (
        <div className="space-y-4">
          {comments.map((comment) => {
            const fullName = `${comment.profile.first_name} ${comment.profile.last_name}`;
            const initials = `${comment.profile.first_name[0] || ''}${comment.profile.last_name[0] || ''}`;
            const isOwnComment = comment.user_id === currentUserId;

            return (
              <div key={comment.id} className="flex gap-3">
                <Avatar 
                  className="w-8 h-8 cursor-pointer"
                  onClick={() => navigate(`/profile/${comment.user_id}`)}
                >
                  <AvatarImage src={comment.profile.avatar || undefined} />
                  <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="bg-muted rounded-lg p-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p 
                          className="font-semibold text-sm hover:underline cursor-pointer"
                          onClick={() => navigate(`/profile/${comment.user_id}`)}
                        >
                          {fullName}
                        </p>
                        <p className="text-sm mt-1">{comment.content}</p>
                      </div>
                      {isOwnComment && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteComment(comment.id)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 ml-3">
                    {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}