import { useEffect, useState, useRef, useCallback } from 'react';
import { MentionText } from '@/components/post/MentionText';
import { MentionInput, parseMentions } from '@/components/post/MentionInput';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { useUserRole } from '@/hooks/useUserRole';
import { CommentsSection } from '@/components/member/CommentsSection';
import { EditPostDialog } from '@/components/member/EditPostDialog';
import { FloatingChat } from '@/components/messages/FloatingChat';
import { MemberOnboarding } from '@/components/onboarding/MemberOnboarding';
import { RoleNavigation } from '@/components/RoleNavigation';
import { MobileNavigation } from '@/components/layout/MobileNavigation';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { PullToRefreshIndicator } from '@/components/PullToRefresh';
import { UniversalSearch } from '@/components/UniversalSearch';
import { useUnreadMessageCount } from '@/hooks/useUnreadMessageCount';

import { 
  ArrowLeft, 
  Heart, 
  MessageCircle, 
  Send,
  Trash2,
  Building2,
  LogOut,
  Settings,
  Image as ImageIcon,
  Video,
  X,
  Search,
  MessageSquare,
  Users,
  Calendar,
  UserPlus,
  Repeat2,
  Bookmark,
  Bell,
  FileText
} from 'lucide-react';
import { NotificationsDropdown } from '@/components/notifications/NotificationsDropdown';
import { Badge } from '@/components/ui/badge';
import { BackButton } from '@/components/BackButton';
import { SharePostDropdown } from '@/components/post/SharePostDropdown';
import { BookmarkButton } from '@/components/post/BookmarkButton';
import { PostEngagementBadge } from '@/components/post/PostEngagementBadge';
import { formatDistanceToNow } from 'date-fns';

interface Post {
  id: string;
  content: string;
  image_url: string | null;
  video_url: string | null;
  document_url: string | null;
  likes_count: number;
  comments_count: number;
  shares_count: number;
  reposts_count: number;
  created_at: string;
  user_id: string;
  original_post_id: string | null;
  original_author_id: string | null;
  post_context: string | null;
  organization_id: string | null;
  profile: {
    first_name: string;
    last_name: string;
    avatar: string | null;
    headline: string | null;
  };
  original_author?: {
    first_name: string;
    last_name: string;
    avatar: string | null;
  } | null;
  member: {
    company: {
      name: string;
    } | null;
  } | null;
  user_liked: boolean;
  association?: Association | null;
}

interface Association {
  id: string;
  name: string;
  logo: string | null;
}

export default function MemberFeed() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { userData } = useUserRole();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [newPostContent, setNewPostContent] = useState('');
  const [posting, setPosting] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showComments, setShowComments] = useState<Set<string>>(new Set());
  const [associations, setAssociations] = useState<Association[]>([]);
  const [pendingConnectionsCount, setPendingConnectionsCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  
  // Unread message count for desktop header badge
  const { unreadCount: unreadMessageCount } = useUnreadMessageCount(currentUserId);
  const userIdRef = useRef<string | null>(null);

  // Single initialization: get session once, run all loads in parallel
  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) { setLoading(false); return; }

      userIdRef.current = user.id;
      setCurrentUserId(user.id);

      // All three are independent — run in parallel
      loadProfile(user.id);
      loadPosts(user.id);
      loadPendingConnectionsCount(user.id);
    };

    init();

    const channel = supabase
      .channel('posts-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'posts' },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            setPosts(prev => prev.map(post =>
              post.id === payload.new.id
                ? {
                    ...post,
                    likes_count: payload.new.likes_count ?? post.likes_count,
                    comments_count: payload.new.comments_count ?? post.comments_count,
                    shares_count: payload.new.shares_count ?? post.shares_count,
                    reposts_count: payload.new.reposts_count ?? post.reposts_count
                  }
                : post
            ));
          } else {
            loadPosts();
          }
        }
      )
      .subscribe();

    const connectionsChannel = supabase
      .channel('connections-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'connections' },
        () => {
          loadPendingConnectionsCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(connectionsChannel);
    };
  }, []);

  const loadPendingConnectionsCount = async (userId?: string) => {
    try {
      const uid = userId || userIdRef.current;
      if (!uid) return;

      const { data: memberDataArr } = await supabase
        .from('members')
        .select('id')
        .eq('user_id', uid)
        .eq('is_active', true)
        .limit(1);
      const memberData = memberDataArr?.[0] || null;

      if (!memberData) return;

      const { count } = await supabase
        .from('connections')
        .select('*', { count: 'exact', head: true })
        .eq('receiver_id', memberData.id)
        .eq('status', 'pending');

      setPendingConnectionsCount(count || 0);
    } catch (error) {
      console.error('Error loading pending connections count:', error);
    }
  };

  const loadProfile = async (userId?: string) => {
    try {
      const uid = userId || userIdRef.current;
      if (!uid) return;

      // Fetch profile + both association lookups in parallel
      const [profileRes, managerRes, memberRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', uid).maybeSingle(),
        supabase.from('association_managers').select('association_id').eq('user_id', uid).eq('is_active', true),
        supabase.from('members').select('company_id, companies!inner(association_id)').eq('user_id', uid).eq('is_active', true),
      ]);

      if (profileRes.data) setProfile(profileRes.data);

      // Collect association IDs from both sources
      const associationIds = new Set<string>();
      managerRes.data?.forEach(m => associationIds.add(m.association_id));
      memberRes.data?.forEach(m => {
        const company = m.companies as any;
        if (company?.association_id) associationIds.add(company.association_id);
      });

      if (associationIds.size > 0) {
        const { data: associationsData } = await supabase
          .from('associations')
          .select('id, name, logo')
          .in('id', Array.from(associationIds))
          .eq('is_active', true)
          .order('name');
        setAssociations(associationsData || []);
      }
    } catch (error: any) {
      console.error('Error loading profile:', error);
    }
  };

  const loadPosts = async (userId?: string) => {
    try {
      setLoading(true);
      const uid = userId || userIdRef.current;
      if (!uid) return;

      // Load member + association posts
      const { data: postsData, error } = await supabase
        .from('posts')
        .select('*')
        .or('post_context.is.null,post_context.eq.member,post_context.eq.association')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      if (!postsData) {
        setPosts([]);
        return;
      }

      // Get unique user IDs including original authors
      const userIds = Array.from(new Set(postsData.map((post: any) => post.user_id)));
      const originalAuthorIds = Array.from(new Set(postsData.map((post: any) => post.original_author_id).filter(Boolean)));
      const allUserIds = Array.from(new Set([...userIds, ...originalAuthorIds]));
      const postIds = postsData.map(p => p.id);

      // Collect organization IDs for association posts
      const orgIds = Array.from(new Set(
        postsData.filter(p => p.post_context === 'association' && p.organization_id)
          .map(p => p.organization_id!)
      ));

      // Parallel fetch: profiles, associations, members, likes (4 independent queries)
      const [profilesRes, assocRes, membersRes, likesRes] = await Promise.all([
        supabase.from('profiles').select('id, first_name, last_name, avatar, headline').in('id', allUserIds),
        orgIds.length > 0
          ? supabase.from('associations').select('id, name, logo').in('id', orgIds)
          : Promise.resolve({ data: [] as any[] }),
        supabase.from('members').select('user_id, company:companies(name)').in('user_id', userIds).eq('is_active', true),
        supabase.from('post_likes').select('post_id').eq('user_id', uid).in('post_id', postIds),
      ]);

      const profilesById = (profilesRes.data || []).reduce((acc: Record<string, any>, profile: any) => {
        acc[profile.id] = profile;
        return acc;
      }, {} as Record<string, any>);

      const associationsById: Record<string, Association> = (assocRes.data || []).reduce((acc: Record<string, Association>, a: any) => {
        acc[a.id] = a;
        return acc;
      }, {} as Record<string, Association>);

      const membersByUserId = (membersRes.data || []).reduce((acc: Record<string, any>, m: any) => {
        if (!acc[m.user_id]) acc[m.user_id] = m;
        return acc;
      }, {} as Record<string, any>);

      const likedPostIds = new Set<string>(likesRes.data?.map((l: any) => l.post_id) || []);

      // Assemble posts with all data (no per-post queries)
      const postsWithProfiles = postsData.map(post => {
        const profileData = profilesById[post.user_id] || { first_name: '', last_name: '', avatar: null, headline: null };
        return {
          ...post,
          profile: profileData,
          original_author: post.original_author_id ? profilesById[post.original_author_id] : null,
          member: membersByUserId[post.user_id] || null,
          association: post.post_context === 'association' && post.organization_id
            ? associationsById[post.organization_id] || null
            : null,
          user_liked: likedPostIds.has(post.id),
        };
      });

      setPosts(postsWithProfiles);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to load posts',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePost = async () => {
    if (!newPostContent.trim() && !imageFile && !videoFile && !documentFile) return;

    setPosting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) throw new Error('Not authenticated');

      let imageUrl = null;
      let videoUrl = null;
      let documentUrl = null;

      // Upload image if present
      if (imageFile) {
        const fileExt = imageFile.name.split('.').pop();
        const fileName = `${user.id}/post-${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('profile-images')
          .upload(fileName, imageFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('profile-images')
          .getPublicUrl(fileName);

        imageUrl = publicUrl;
      }

      // Upload video if present
      if (videoFile) {
        const fileExt = videoFile.name.split('.').pop();
        const fileName = `${user.id}/video-${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('profile-images')
          .upload(fileName, videoFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('profile-images')
          .getPublicUrl(fileName);

        videoUrl = publicUrl;
      }

      // Upload document if present
      if (documentFile) {
        const fileExt = documentFile.name.split('.').pop();
        const fileName = `${user.id}/doc-${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('profile-images')
          .upload(fileName, documentFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('profile-images')
          .getPublicUrl(fileName);

        documentUrl = publicUrl;
      }

      const contentToSave = newPostContent.trim() || ' ';
      const { data: postData, error } = await supabase.from('posts').insert({
        user_id: user.id,
        content: contentToSave,
        image_url: imageUrl,
        video_url: videoUrl,
        document_url: documentUrl,
      }).select('id').single();

      if (error) throw error;

      // Insert mentions into post_mentions table
      if (postData) {
        const mentions = parseMentions(contentToSave);
        if (mentions.length > 0) {
          await supabase.from('post_mentions').insert(
            mentions.map(m => ({
              post_id: postData.id,
              mentioned_user_id: m.userId || null,
              mentioned_association_id: m.associationId || null,
            }))
          );
        }
      }

      toast({
        title: 'Success',
        description: 'Post created',
      });
      setNewPostContent('');
      setImagePreview(null);
      setImageFile(null);
      setVideoPreview(null);
      setVideoFile(null);
      setDocumentFile(null);
      loadPosts();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to create post',
        variant: 'destructive',
      });
    } finally {
      setPosting(false);
    }
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate post image upload (8MB limit)
    const { validatePostImageUpload, resizeImageForUpload } = await import('@/lib/uploadValidation');
    const validation = await validatePostImageUpload(file);

    if (!validation.valid) {
      toast({
        title: 'Validation Error',
        description: validation.error,
        variant: 'destructive',
      });
      return;
    }

    // Resize to LinkedIn-standard max 1200px before upload
    const resizedFile = await resizeImageForUpload(file);

    // Clear video if selecting image
    setVideoFile(null);
    setVideoPreview(null);
    if (videoInputRef.current) {
      videoInputRef.current.value = '';
    }

    setImageFile(resizedFile);
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleVideoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate video upload (50MB limit)
    const { validateVideoUpload } = await import('@/lib/uploadValidation');
    const validation = validateVideoUpload(file);
    
    if (!validation.valid) {
      toast({
        title: 'Validation Error',
        description: validation.error,
        variant: 'destructive',
      });
      return;
    }

    // Clear image if selecting video
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    setVideoFile(file);
    const url = URL.createObjectURL(file);
    setVideoPreview(url);
  };

  const removeImage = () => {
    setImagePreview(null);
    setImageFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeVideo = () => {
    if (videoPreview) {
      URL.revokeObjectURL(videoPreview);
    }
    setVideoPreview(null);
    setVideoFile(null);
    if (videoInputRef.current) {
      videoInputRef.current.value = '';
    }
  };

  const handleDocumentSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const { validatePostDocumentUpload } = await import('@/lib/uploadValidation');
    const validation = validatePostDocumentUpload(file);
    
    if (!validation.valid) {
      toast({
        title: 'Validation Error',
        description: validation.error,
        variant: 'destructive',
      });
      return;
    }

    setDocumentFile(file);
  };

  const removeDocument = () => {
    setDocumentFile(null);
    if (documentInputRef.current) {
      documentInputRef.current.value = '';
    }
  };

  const clearPostComposer = () => {
    setNewPostContent('');
    setImageFile(null);
    setImagePreview(null);
    setVideoFile(null);
    setVideoPreview(null);
    setDocumentFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (videoInputRef.current) videoInputRef.current.value = '';
    if (documentInputRef.current) documentInputRef.current.value = '';
  };

  const hasAnyContent = newPostContent.trim() || imageFile || videoFile || documentFile;

  const getDocumentName = (url: string) => {
    const parts = url.split('/');
    const fileName = parts[parts.length - 1];
    // Remove the timestamp prefix if present
    const match = fileName.match(/doc-\d+\.(.+)/);
    if (match) {
      return `Document.${match[1]}`;
    }
    return fileName;
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

  const handleLikePost = async (postId: string, currentlyLiked: boolean) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) throw new Error('Not authenticated');

      // Optimistic update — instant UI feedback
      setPosts(prev => prev.map(p => p.id === postId
        ? { ...p, user_liked: !currentlyLiked, likes_count: currentlyLiked ? Math.max(0, p.likes_count - 1) : p.likes_count + 1 }
        : p
      ));

      if (currentlyLiked) {
        await supabase.from('post_likes').delete().eq('post_id', postId).eq('user_id', user.id);
        const post = posts.find(p => p.id === postId);
        if (post && post.likes_count > 0) {
          await supabase.from('posts').update({ likes_count: post.likes_count - 1 }).eq('id', postId);
        }
      } else {
        await supabase.from('post_likes').insert({ post_id: postId, user_id: user.id });
        const post = posts.find(p => p.id === postId);
        if (post) {
          await supabase.from('posts').update({ likes_count: post.likes_count + 1 }).eq('id', postId);
        }
      }
      // No loadPosts() — realtime subscription pushes count updates
    } catch (error: any) {
      // Revert optimistic update on failure
      setPosts(prev => prev.map(p => p.id === postId
        ? { ...p, user_liked: currentlyLiked, likes_count: currentlyLiked ? p.likes_count + 1 : Math.max(0, p.likes_count - 1) }
        : p
      ));
      toast({
        title: 'Error',
        description: 'Failed to update like',
        variant: 'destructive',
      });
    }
  };

  const handleDeletePost = async (postId: string) => {
    try {
      // Optimistic removal
      setPosts(prev => prev.filter(p => p.id !== postId));

      const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', postId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Post deleted',
      });
    } catch (error: any) {
      // Revert on failure
      loadPosts();
      toast({
        title: 'Error',
        description: 'Failed to delete post',
        variant: 'destructive',
      });
    }
  };

  const handleRepost = async (post: Post) => {
    if (post.user_id === currentUserId) {
      toast({
        title: 'Cannot repost',
        description: 'You cannot repost your own post',
        variant: 'destructive',
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('posts')
        .insert([{
          content: post.content,
          image_url: post.image_url,
          video_url: post.video_url,
          user_id: currentUserId,
          original_post_id: post.original_post_id || post.id,
          original_author_id: post.original_author_id || post.user_id,
        }]);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Post reposted successfully',
      });
      // No loadPosts() — realtime INSERT event triggers reload
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to repost',
        variant: 'destructive',
      });
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      toast({
        title: 'Success',
        description: 'You have been logged out',
      });
      navigate('/auth/login');
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to logout',
        variant: 'destructive',
      });
    }
  };

  return (
    <>
      <MemberOnboarding />
      <div className="min-h-screen bg-background pb-20 md:pb-0 scrollbar-hide">
      {/* Header - Mobile-first design */}
      <header className="border-b bg-card sticky top-0 z-10 shadow-sm">
        <div className="container mx-auto pl-14 md:pl-20 lg:pl-24">
          <div className="flex items-center justify-between h-14 gap-3">
            {/* Left - Back Button (desktop only, logo handles home on all views) */}
            <div className="flex items-center gap-3 flex-shrink-0">
              <BackButton fallbackPath="/dashboard" variant="ghost" size="icon" label="" className="hidden md:flex" />
            </div>

            {/* Center - Universal Member Search */}
            <div className="flex-1 max-w-md">
              <UniversalSearch />
            </div>

            {/* Right - Mobile: Settings only, Desktop: Full nav */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Mobile icons */}
              <div className="flex md:hidden items-center gap-1">
                <Button variant="ghost" size="icon" onClick={() => navigate('/account-settings')} className="h-9 w-9">
                  <Settings className="w-4 h-4" />
                </Button>
              </div>

              {/* Desktop Navigation */}
              <div className="hidden md:flex items-center gap-6">
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="flex flex-col items-center gap-0.5 h-auto py-2 px-3"
                  onClick={() => navigate('/feed')}
                  data-tour="feed"
                >
                  <MessageSquare className="w-5 h-5" />
                  <span className="text-xs">Feed</span>
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="flex flex-col items-center gap-0.5 h-auto py-2 px-3"
                  onClick={() => navigate('/members')}
                  data-tour="browse-members"
                >
                  <Users className="w-5 h-5" />
                  <span className="text-xs">Members</span>
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="flex flex-col items-center gap-0.5 h-auto py-2 px-3 relative"
                  onClick={() => navigate('/connections')}
                  data-tour="connections"
                >
                  <div className="relative">
                    <UserPlus className="w-5 h-5" />
                    {pendingConnectionsCount > 0 && (
                      <Badge 
                        variant="destructive" 
                        className="absolute -top-2 -right-2 h-4 min-w-4 px-1 text-[10px] flex items-center justify-center"
                      >
                        {pendingConnectionsCount}
                      </Badge>
                    )}
                  </div>
                  <span className="text-xs">Connections</span>
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="flex flex-col items-center gap-0.5 h-auto py-2 px-3 relative"
                  onClick={() => navigate('/messages')}
                  data-tour="messages"
                >
                  <div className="relative">
                    <MessageCircle className="w-5 h-5" />
                    {unreadMessageCount > 0 && (
                      <Badge 
                        variant="destructive" 
                        className="absolute -top-2 -right-2 h-4 min-w-4 px-1 text-[10px] flex items-center justify-center"
                      >
                        {unreadMessageCount > 9 ? '9+' : unreadMessageCount}
                      </Badge>
                    )}
                  </div>
                  <span className="text-xs">Messages</span>
                </Button>
                <NotificationsDropdown currentUserId={currentUserId} />
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="flex flex-col items-center gap-0.5 h-auto py-2 px-3"
                  onClick={() => navigate('/calendar')}
                  data-tour="calendar"
                >
                  <Calendar className="w-5 h-5" />
                  <span className="text-xs">Calendar</span>
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="flex flex-col items-center gap-0.5 h-auto py-2 px-3"
                  onClick={() => navigate('/companies')}
                >
                  <Building2 className="w-5 h-5" />
                  <span className="text-xs">Companies</span>
                </Button>
                
                {/* Profile Dropdown - Desktop only */}
                <div className="flex items-center gap-2 border-l pl-4">
                  {profile && currentUserId && (
                    <Avatar 
                      className="cursor-pointer hover:ring-2 hover:ring-primary transition-all w-8 h-8" 
                      onClick={() => navigate(`/profile/${currentUserId}`)}
                    >
                      <AvatarImage src={profile.avatar || undefined} />
                      <AvatarFallback className="text-xs">
                        {profile.first_name?.[0]}{profile.last_name?.[0]}
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => navigate('/account-settings')}>
                    <Settings className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleLogout}>
                    <LogOut className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto py-4 md:py-6 md:pl-20 max-w-3xl overflow-x-hidden">
        <RoleNavigation />
        
        {/* Associated Associations Ribbon */}
        {associations.length > 0 && (
          <Card className="mb-4">
            <CardContent className="py-3">
              <div className="flex items-center gap-3 overflow-x-auto">
                <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">Your Associations:</span>
                <div className="flex items-center gap-3">
                  {associations.map((association) => (
                    <div
                      key={association.id}
                      onClick={() => navigate(`/member/associations/${association.id}`)}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted hover:bg-muted/80 cursor-pointer transition-colors whitespace-nowrap"
                    >
                      {association.logo ? (
                        <img 
                          src={association.logo} 
                          alt={association.name}
                          className="w-5 h-5 rounded-full object-cover"
                        />
                      ) : (
                        <Building2 className="w-4 h-4 text-primary" />
                      )}
                      <span className="text-sm font-medium">{association.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        
        {/* Create Post Card */}
        <Card className="mb-6">
          <CardContent className="pt-6 pb-4">
            <div className="flex gap-3 mb-4">
              <Avatar className="w-12 h-12 flex-shrink-0">
                <AvatarImage src={profile?.avatar || undefined} />
                <AvatarFallback>
                  {profile?.first_name?.[0]}{profile?.last_name?.[0]}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-h-[80px]">
                <MentionInput
                  placeholder="What's on your mind? Use @ to mention"
                  value={newPostContent}
                  onChange={setNewPostContent}
                  rows={3}
                  className="resize-none border-0 focus-visible:ring-0 px-3 py-2 placeholder:text-muted-foreground w-full"
                />
              </div>
            </div>
            
            {imagePreview && (
              <div className="relative mb-4">
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="rounded-lg w-full object-cover"
                  style={{ maxHeight: '516px' }}
                />
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2"
                  onClick={removeImage}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            )}

            {videoPreview && (
              <div className="relative mb-4">
                <video
                  src={videoPreview}
                  controls
                  className="rounded-lg max-h-64 w-full object-cover"
                />
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2"
                  onClick={removeVideo}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            )}

            {documentFile && (
              <div className="relative mb-4 flex items-center gap-2 p-3 bg-muted rounded-lg">
                <FileText className="w-5 h-5 text-primary" />
                <span className="text-sm flex-1 truncate">{documentFile.name}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={removeDocument}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            )}

            <div className="flex items-center justify-between pt-3 border-t">
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="hidden"
                />
                <input
                  ref={videoInputRef}
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime,video/x-msvideo"
                  onChange={handleVideoSelect}
                  className="hidden"
                />
                <input
                  ref={documentInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={handleDocumentSelect}
                  className="hidden"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-muted-foreground hover:text-foreground hover:bg-transparent"
                  title="Add photo (max 10MB)"
                >
                  <ImageIcon className="w-5 h-5 mr-2" />
                  Photo
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => videoInputRef.current?.click()}
                  className="text-muted-foreground hover:text-foreground hover:bg-transparent"
                  title="Add video (max 50MB, MP4/WebM/MOV)"
                >
                  <Video className="w-5 h-5 mr-2" />
                  Video
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => documentInputRef.current?.click()}
                  className="text-muted-foreground hover:text-foreground hover:bg-transparent"
                  title="Add document (max 10MB, PDF/DOC/DOCX)"
                >
                  <FileText className="w-5 h-5 mr-2" />
                  Document
                </Button>
              </div>
              <div className="flex items-center gap-2">
                {hasAnyContent && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearPostComposer}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    title="Clear all"
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Clear
                  </Button>
                )}
                <Button
                  onClick={handleCreatePost}
                  disabled={(!newPostContent.trim() && !imageFile && !videoFile && !documentFile) || posting}
                  size="sm"
                  className="bg-primary hover:bg-primary/90"
                >
                  {posting ? 'Posting...' : 'Post'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Posts Feed */}
        {loading ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">Loading posts...</p>
          </div>
        ) : posts.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground text-lg">No posts yet. Be the first to share!</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {posts
              .filter(post => {
                if (!searchTerm) return true;
                const searchLower = searchTerm.toLowerCase();
                const fullName = `${post.profile.first_name} ${post.profile.last_name}`.toLowerCase();
                return post.content.toLowerCase().includes(searchLower) ||
                       fullName.includes(searchLower);
              })
              .map((post) => {
              const isAssociationPost = post.post_context === 'association' && post.association;
              const fullName = isAssociationPost 
                ? post.association!.name 
                : `${post.profile.first_name} ${post.profile.last_name}`;
              const initials = isAssociationPost
                ? post.association!.name.substring(0, 2).toUpperCase()
                : `${post.profile.first_name[0]}${post.profile.last_name[0]}`;
              const avatarSrc = isAssociationPost
                ? post.association!.logo || undefined
                : (post.profile.avatar || undefined);
              const isOwnPost = post.user_id === currentUserId;

              return (
                <Card key={post.id}>
                  <CardContent className="pt-6">
                    {/* Engagement badge */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        {/* Association badge */}
                        {isAssociationPost && (
                          <div className="flex items-center gap-1 text-xs text-primary font-medium">
                            <Building2 className="w-3 h-3" />
                            <span>Association Update</span>
                          </div>
                        )}
                        {/* Repost indicator */}
                        {!isAssociationPost && post.original_post_id && post.original_author && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Repeat2 className="w-4 h-4" />
                            <span>
                              <span className="font-semibold">{post.profile.first_name} {post.profile.last_name}</span>
                              {' '}reposted{' '}
                              <span className="font-semibold">{post.original_author.first_name} {post.original_author.last_name}</span>
                            </span>
                          </div>
                        )}
                      </div>
                      <PostEngagementBadge 
                        likesCount={post.likes_count || 0}
                        commentsCount={post.comments_count || 0}
                        sharesCount={post.shares_count || 0}
                        repostsCount={post.reposts_count || 0}
                      />
                    </div>
                    <div className="flex gap-4 min-w-0">
                      <Avatar 
                        className="cursor-pointer"
                        onClick={() => isAssociationPost 
                          ? navigate(`/member/associations/${post.organization_id}`)
                          : navigate(`/profile/${post.user_id}`)
                        }
                      >
                        <AvatarImage src={avatarSrc} />
                        <AvatarFallback>
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 
                              className="font-semibold hover:underline cursor-pointer"
                              onClick={() => isAssociationPost
                                ? navigate(`/member/associations/${post.organization_id}`)
                                : navigate(`/profile/${post.user_id}`)
                              }
                            >
                              {fullName}
                            </h3>
                            {!isAssociationPost && !post.original_post_id && post.profile.headline && (
                              <p className="text-sm text-muted-foreground">
                                {post.profile.headline}
                              </p>
                            )}
                            {!isAssociationPost && !post.original_post_id && post.member?.company && (
                              <p className="text-sm text-muted-foreground">
                                {post.member.company.name}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground mt-1">
                              {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            {isOwnPost && (
                              <>
                                <EditPostDialog
                                  postId={post.id}
                                  initialContent={post.content}
                                  onSave={loadPosts}
                                />
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeletePost(post.id)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </>
                            )}
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
                            className="mt-4 rounded-lg max-h-96 w-full max-w-full"
                          />
                        )}

                        {post.document_url && (
                          <a
                            href={post.document_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-4 flex items-center gap-2 p-3 bg-muted rounded-lg hover:bg-muted/80 transition-colors"
                          >
                            <FileText className="w-5 h-5 text-primary" />
                            <span className="text-sm font-medium">View Document</span>
                          </a>
                        )}

                        <div className="flex items-center gap-1 sm:gap-4 mt-4 pt-4 border-t flex-wrap">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleLikePost(post.id, post.user_liked)}
                            className={`px-2 sm:px-3 ${post.user_liked ? 'text-red-500' : ''}`}
                          >
                            <Heart className={`w-4 h-4 sm:mr-1 ${post.user_liked ? 'fill-current' : ''}`} />
                            <span className="hidden sm:inline">{post.likes_count > 0 && post.likes_count}</span>
                            <span className="sm:hidden text-xs ml-1">{post.likes_count > 0 && post.likes_count}</span>
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => toggleComments(post.id)}
                            className="px-2 sm:px-3"
                          >
                            <MessageCircle className="w-4 h-4 sm:mr-1" />
                            <span className="hidden sm:inline">{post.comments_count > 0 && post.comments_count}</span>
                            <span className="sm:hidden text-xs ml-1">{post.comments_count > 0 && post.comments_count}</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRepost(post)}
                            className="px-2 sm:px-3"
                          >
                            <Repeat2 className="w-4 h-4 sm:mr-1" />
                            <span className="hidden sm:inline">{post.reposts_count > 0 && post.reposts_count}</span>
                            <span className="sm:hidden text-xs ml-1">{post.reposts_count > 0 && post.reposts_count}</span>
                          </Button>
                          <SharePostDropdown
                            postId={post.id}
                            postContent={post.content}
                            sharesCount={post.shares_count || 0}
                            onShareComplete={() => {}}
                          />
                          <BookmarkButton postId={post.id} userId={currentUserId} />
                        </div>

                        {/* Comments Section */}
                        {showComments.has(post.id) && (
                          <CommentsSection
                            postId={post.id}
                            currentUserId={currentUserId}
                            onCommentAdded={() => {}}
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

      {/* Floating Chat Widget */}
      <FloatingChat currentUserId={currentUserId} />
      
      {/* Mobile Bottom Navigation */}
      <MobileNavigation />
    </div>
    </>
  );
}