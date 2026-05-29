import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { Heart, MessageCircle, ArrowLeft, Bookmark } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { MentionText } from '@/components/post/MentionText';
import { CommentsSection } from '@/components/member/CommentsSection';
import { SharePostDropdown } from '@/components/post/SharePostDropdown';
import { BookmarkButton } from '@/components/post/BookmarkButton';
import { MobileNavigation } from '@/components/layout/MobileNavigation';

interface SavedPost {
  id: string;
  post_id: string;
  created_at: string;
  post: {
    id: string;
    content: string;
    image_url: string | null;
    video_url: string | null;
    likes_count: number;
    comments_count: number;
    shares_count: number;
    created_at: string;
    user_id: string;
  };
  profile: {
    first_name: string;
    last_name: string;
    avatar: string | null;
    headline: string | null;
  };
  liked_by_user: boolean;
}

export default function SavedPosts() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [savedPosts, setSavedPosts] = useState<SavedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [showComments, setShowComments] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadSavedPosts();
  }, []);

  const loadSavedPosts = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) {
        navigate('/auth/login');
        return;
      }

      setCurrentUserId(user.id);

      // Get bookmarked posts
      const { data: bookmarks, error: bookmarksError } = await supabase
        .from('post_bookmarks')
        .select('id, post_id, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (bookmarksError) throw bookmarksError;

      if (!bookmarks || bookmarks.length === 0) {
        setSavedPosts([]);
        return;
      }

      // Get post details
      const postIds = bookmarks.map(b => b.post_id);
      const { data: postsData, error: postsError } = await supabase
        .from('posts')
        .select('*')
        .in('id', postIds);

      if (postsError) throw postsError;

      // Get user likes
      const { data: likesData } = await supabase
        .from('post_likes')
        .select('post_id')
        .eq('user_id', user.id)
        .in('post_id', postIds);

      const likedPostIds = new Set(likesData?.map(l => l.post_id) || []);

      // Batch fetch all profiles for post authors
      const authorIds = Array.from(new Set((postsData || []).map(p => p.user_id)));
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, avatar, headline')
        .in('id', authorIds);

      const profilesById = (profilesData || []).reduce((acc: Record<string, any>, p: any) => {
        acc[p.id] = p;
        return acc;
      }, {} as Record<string, any>);

      // Combine data (no per-bookmark queries)
      const savedPostsWithDetails = bookmarks.map(bookmark => {
        const post = postsData?.find(p => p.id === bookmark.post_id);
        if (!post) return null;

        return {
          id: bookmark.id,
          post_id: bookmark.post_id,
          created_at: bookmark.created_at,
          post,
          profile: profilesById[post.user_id] || { first_name: '', last_name: '', avatar: null, headline: null },
          liked_by_user: likedPostIds.has(post.id),
        };
      });

      setSavedPosts(savedPostsWithDetails.filter(Boolean) as SavedPost[]);
    } catch (error: any) {
      console.error('Error loading saved posts:', error);
      toast({
        title: 'Error',
        description: 'Failed to load saved posts',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLikePost = async (postId: string, currentlyLiked: boolean) => {
    if (!currentUserId) return;

    try {
      if (currentlyLiked) {
        await supabase
          .from('post_likes')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', currentUserId);
      } else {
        await supabase
          .from('post_likes')
          .insert({ post_id: postId, user_id: currentUserId });
      }
      loadSavedPosts();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update like',
        variant: 'destructive',
      });
    }
  };

  const toggleComments = (postId: string) => {
    const newShowComments = new Set(showComments);
    if (newShowComments.has(postId)) {
      newShowComments.delete(postId);
    } else {
      newShowComments.add(postId);
    }
    setShowComments(newShowComments);
  };

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <header className="border-b bg-card sticky top-0 z-10 shadow-sm">
        <div className="container mx-auto">
          <div className="flex items-center h-14 gap-3 md:gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2">
              <Bookmark className="w-5 h-5 text-primary" />
              <h1 className="text-lg md:text-xl font-bold">Saved Posts</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto py-4 md:py-6 md:pl-20 max-w-3xl">
        {loading ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">Loading saved posts...</p>
          </div>
        ) : savedPosts.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Bookmark className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground text-lg mb-2">No saved posts yet</p>
              <p className="text-sm text-muted-foreground">
                Posts you save will appear here
              </p>
              <Button className="mt-4" onClick={() => navigate('/feed')}>
                Browse Feed
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {savedPosts.map((savedPost) => {
              const { post, profile } = savedPost;
              const fullName = `${profile.first_name} ${profile.last_name}`;
              const initials = `${profile.first_name[0] || '?'}${profile.last_name[0] || '?'}`;

              return (
                <Card key={savedPost.id}>
                  <CardContent className="pt-6">
                    <div className="flex gap-4">
                      <Avatar 
                        className="cursor-pointer"
                        onClick={() => navigate(`/profile/${post.user_id}`)}
                      >
                        <AvatarImage src={profile.avatar || undefined} />
                        <AvatarFallback>{initials}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 
                              className="font-semibold hover:underline cursor-pointer"
                              onClick={() => navigate(`/profile/${post.user_id}`)}
                            >
                              {fullName}
                            </h3>
                            {profile.headline && (
                              <p className="text-sm text-muted-foreground">
                                {profile.headline}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground mt-1">
                              {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                            </p>
                          </div>
                        </div>

                        <MentionText text={post.content} className="mt-4" />

                        {post.image_url && (
                          <div className="mt-4 overflow-hidden rounded-lg bg-black/5">
                            <img
                              src={post.image_url}
                              alt="Post"
                              className="w-full object-cover"
                              style={{ maxHeight: '516px' }}
                            />
                          </div>
                        )}

                        {post.video_url && (
                          <video
                            src={post.video_url}
                            controls
                            className="mt-4 rounded-lg max-h-96 w-full"
                          />
                        )}

                        <div className="flex items-center gap-4 mt-4 pt-4 border-t">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleLikePost(post.id, savedPost.liked_by_user)}
                            className={savedPost.liked_by_user ? 'text-red-500' : ''}
                          >
                            <Heart className={`w-4 h-4 mr-2 ${savedPost.liked_by_user ? 'fill-current' : ''}`} />
                            {post.likes_count > 0 && post.likes_count}
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => toggleComments(post.id)}
                          >
                            <MessageCircle className="w-4 h-4 mr-2" />
                            {post.comments_count > 0 && post.comments_count}
                          </Button>
                          <SharePostDropdown
                            postId={post.id}
                            postContent={post.content}
                            sharesCount={post.shares_count || 0}
                            onShareComplete={loadSavedPosts}
                          />
                          <BookmarkButton postId={post.id} userId={currentUserId} />
                        </div>

                        {showComments.has(post.id) && (
                          <CommentsSection
                            postId={post.id}
                            currentUserId={currentUserId}
                            onCommentAdded={loadSavedPosts}
                          />
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
      
      <MobileNavigation />
    </div>
  );
}