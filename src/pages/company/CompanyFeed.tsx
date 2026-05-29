import { useEffect, useState, useRef } from 'react';
import { MentionText } from '@/components/post/MentionText';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Heart, MessageCircle, Trash2, Image as ImageIcon, Video, X, ArrowLeft, Search, Repeat2, MessageSquare, Users, Calendar, Building2, Settings, LogOut, UserPlus, Bell, Send, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { CommentsSection } from '@/components/member/CommentsSection';
import { EditPostDialog } from '@/components/member/EditPostDialog';
import { Input } from '@/components/ui/input';
import { SharePostDropdown } from '@/components/post/SharePostDropdown';
import { BookmarkButton } from '@/components/post/BookmarkButton';
import { PostEngagementBadge } from '@/components/post/PostEngagementBadge';
import { FloatingChat } from '@/components/messages/FloatingChat';
import { MobileNavigation } from '@/components/layout/MobileNavigation';
import { RoleNavigation } from '@/components/RoleNavigation';
import { UniversalSearch } from '@/components/UniversalSearch';
import { NotificationsDropdown } from '@/components/notifications/NotificationsDropdown';
import { useUnreadMessageCount } from '@/hooks/useUnreadMessageCount';
import { Badge } from '@/components/ui/badge';
import { BackButton } from '@/components/BackButton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Post {
  id: string;
  content: string;
  image_url: string | null;
  video_url: string | null;
  document_url: string | null;
  created_at: string;
  updated_at: string;
  user_id: string;
  likes_count: number;
  comments_count: number;
  shares_count: number;
  reposts_count: number;
  original_post_id: string | null;
  original_author_id: string | null;
  post_context: string | null;
  organization_id: string | null;
  profiles: {
    first_name: string;
    last_name: string;
    avatar: string | null;
  };
  members: {
    company_id: string | null;
    companies: {
      name: string;
    } | null;
  };
  original_author?: {
    first_name: string;
    last_name: string;
    avatar: string | null;
  } | null;
  liked_by_user?: boolean;
}

interface CompanyInfo {
  id: string;
  name: string;
  logo: string | null;
  description: string | null;
  industry_type: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  employee_count: number | null;
  member_count?: number;
}

export default function CompanyFeed() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [posts, setPosts] = useState<Post[]>([]);
  const [newPost, setNewPost] = useState('');
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [showComments, setShowComments] = useState<{ [key: string]: boolean }>({});
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [profile, setProfile] = useState<any>(null);
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null);
  const [pendingConnectionsCount, setPendingConnectionsCount] = useState(0);
  const [activeTab, setActiveTab] = useState<'posts' | 'about' | 'members'>('posts');
  const [contentFilter, setContentFilter] = useState<'all' | 'images' | 'videos'>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'top'>('recent');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const userIdRef = useRef<string | null>(null);
  const companyIdRef = useRef<string | null>(null);

  const { unreadCount: unreadMessageCount } = useUnreadMessageCount(currentUserId);

  // Single initialization: get session once, eliminate waterfall
  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) { setLoading(false); return; }

      userIdRef.current = user.id;
      setCurrentUserId(user.id);

      // Profile + pending count run in background (don't block posts)
      loadProfile(user.id);
      loadPendingConnectionsCount(user.id);

      // Resolve company info, then load posts immediately (no second useEffect)
      const compInfo = await resolveCompanyInfo(user.id);
      if (compInfo) {
        companyIdRef.current = compInfo.id;
        setCompanyInfo(compInfo);
        loadPosts(user.id, compInfo.id);
      } else {
        setLoading(false);
      }
    };

    init();

    const connectionsChannel = supabase
      .channel('connections-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'connections' }, () => {
        loadPendingConnectionsCount();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(connectionsChannel);
    };
  }, []);

  // Realtime subscription for posts (re-subscribes when companyId changes)
  useEffect(() => {
    if (!companyInfo?.id) return;

    const channel = supabase
      .channel('posts-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, (payload) => {
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
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [companyInfo?.id]);

  const loadProfile = async (userId?: string) => {
    try {
      const uid = userId || userIdRef.current;
      if (!uid) return;

      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', uid)
        .maybeSingle();

      if (profileData) setProfile(profileData);
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  };

  // Resolves company info with parallelized data + member count. Returns the info object.
  const resolveCompanyInfo = async (userId: string) => {
    try {
      const { data: adminData } = await supabase
        .from('company_admins')
        .select('company_id')
        .eq('user_id', userId)
        .eq('is_active', true)
        .maybeSingle();

      if (!adminData?.company_id) return null;

      // Fetch company data + member count in parallel
      const [companyRes, memberCountRes] = await Promise.all([
        supabase.from('companies').select('*').eq('id', adminData.company_id).maybeSingle(),
        supabase.from('members').select('*', { count: 'exact', head: true }).eq('company_id', adminData.company_id).eq('is_active', true),
      ]);

      if (!companyRes.data) return null;

      return {
        ...companyRes.data,
        member_count: memberCountRes.count || 0,
      };
    } catch (error) {
      console.error('Error loading company info:', error);
      return null;
    }
  };

  const loadPendingConnectionsCount = async (userId?: string) => {
    try {
      const uid = userId || userIdRef.current;
      if (!uid) return;

      const { data: memberRows } = await supabase
        .from('members')
        .select('id')
        .eq('user_id', uid)
        .eq('is_active', true)
        .limit(1);

      const memberData = memberRows?.[0] || null;
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

  const loadPosts = async (userId?: string, companyId?: string) => {
    try {
      const uid = userId || userIdRef.current;
      const cid = companyId || companyIdRef.current || companyInfo?.id;
      if (!uid) return;

      const query = supabase
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (cid) {
        query.eq('post_context', 'company').eq('organization_id', cid);
      }

      const { data: postsData, error } = await query;
      if (error) throw error;

      if (postsData && postsData.length > 0) {
        const userIds = Array.from(new Set(postsData.map((post: any) => post.user_id)));
        const originalAuthorIds = Array.from(new Set(postsData.map((post: any) => post.original_author_id).filter(Boolean)));
        const allUserIds = Array.from(new Set([...userIds, ...originalAuthorIds]));
        const postIds = postsData.map((p: any) => p.id);

        const [profilesRes, membersRes, likesRes] = await Promise.all([
          supabase.from('profiles').select('id, first_name, last_name, avatar').in('id', allUserIds),
          supabase.from('members').select('user_id, company_id, companies (name)').in('user_id', userIds).eq('is_active', true),
          supabase.from('post_likes').select('post_id').eq('user_id', uid).in('post_id', postIds),
        ]);

        const profilesById = (profilesRes.data || []).reduce((acc: Record<string, any>, profile: any) => {
          acc[profile.id] = profile;
          return acc;
        }, {} as Record<string, any>);

        const membersByUserId = (membersRes.data || []).reduce((acc: Record<string, any>, m: any) => {
          if (!acc[m.user_id]) acc[m.user_id] = m;
          return acc;
        }, {} as Record<string, any>);

        const likedPostIds = new Set(likesRes.data?.map((l: any) => l.post_id) || []);

        const postsWithDetails = postsData.map((post: any) => ({
          ...post,
          profiles: profilesById[post.user_id] || null,
          members: membersByUserId[post.user_id] || null,
          original_author: post.original_author_id ? profilesById[post.original_author_id] : null,
          liked_by_user: likedPostIds.has(post.id),
        }));

        setPosts(postsWithDetails as any);
      } else {
        setPosts([]);
      }
    } catch (error: any) {
      console.error('Error loading posts:', error);
      toast({
        title: 'Error',
        description: 'Failed to load posts',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

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

    setVideoFile(null);
    if (videoPreview) {
      URL.revokeObjectURL(videoPreview);
    }
    setVideoPreview(null);

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

    setImageFile(null);
    setImagePreview(null);

    setVideoFile(file);
    const url = URL.createObjectURL(file);
    setVideoPreview(url);
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
  };

  const removeVideo = () => {
    if (videoPreview) {
      URL.revokeObjectURL(videoPreview);
    }
    setVideoFile(null);
    setVideoPreview(null);
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
    setNewPost('');
    setImageFile(null);
    setImagePreview(null);
    setVideoFile(null);
    setVideoPreview(null);
    setDocumentFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (videoInputRef.current) videoInputRef.current.value = '';
    if (documentInputRef.current) documentInputRef.current.value = '';
  };

  const hasAnyContent = newPost.trim() || imageFile || videoFile || documentFile;

  const uploadImage = async (file: File): Promise<string | null> => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${currentUserId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('profile-images')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('profile-images')
        .getPublicUrl(filePath);

      return data.publicUrl;
    } catch (error) {
      console.error('Error uploading image:', error);
      return null;
    }
  };

  const handleCreatePost = async () => {
    if (!newPost.trim() && !imageFile && !videoFile) return;

    setPosting(true);
    try {
      let imageUrl = null;
      let videoUrl = null;
      let documentUrl = null;
      
      if (imageFile) {
        imageUrl = await uploadImage(imageFile);
      }
      
      if (videoFile) {
        videoUrl = await uploadImage(videoFile);
      }

      if (documentFile) {
        documentUrl = await uploadImage(documentFile);
      }

      const { error } = await supabase
        .from('posts')
        .insert([{ 
          content: newPost.trim(), 
          user_id: currentUserId, 
          image_url: imageUrl,
          video_url: videoUrl,
          document_url: documentUrl,
          post_context: 'company',
          organization_id: companyInfo?.id,
        }]);

      if (error) throw error;

      setNewPost('');
      setImageFile(null);
      setImagePreview(null);
      setVideoFile(null);
      if (videoPreview) {
        URL.revokeObjectURL(videoPreview);
      }
      setVideoPreview(null);
      setDocumentFile(null);
      toast({
        title: 'Success',
        description: 'Post created successfully',
      });
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

  const handleLike = async (postId: string, isLiked: boolean) => {
    try {
      // Optimistic update
      setPosts(prev => prev.map(p => p.id === postId
        ? { ...p, liked_by_user: !isLiked, likes_count: isLiked ? Math.max(0, p.likes_count - 1) : p.likes_count + 1 }
        : p
      ));

      if (isLiked) {
        await supabase.from('post_likes').delete().eq('post_id', postId).eq('user_id', currentUserId);
        const post = posts.find(p => p.id === postId);
        if (post) {
          await supabase.from('posts').update({ likes_count: Math.max(0, post.likes_count - 1) }).eq('id', postId);
        }
      } else {
        await supabase.from('post_likes').insert([{ post_id: postId, user_id: currentUserId }]);
        const post = posts.find(p => p.id === postId);
        if (post) {
          await supabase.from('posts').update({ likes_count: post.likes_count + 1 }).eq('id', postId);
        }
      }
    } catch (error: any) {
      // Revert optimistic update
      setPosts(prev => prev.map(p => p.id === postId
        ? { ...p, liked_by_user: isLiked, likes_count: isLiked ? p.likes_count + 1 : Math.max(0, p.likes_count - 1) }
        : p
      ));
      toast({
        title: 'Error',
        description: 'Failed to update like',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (postId: string) => {
    try {
      setPosts(prev => prev.filter(p => p.id !== postId));

      const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', postId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Post deleted successfully',
      });
    } catch (error: any) {
      loadPosts(); // Revert optimistic removal
      toast({
        title: 'Error',
        description: 'Failed to delete post',
        variant: 'destructive',
      });
    }
  };

  const toggleComments = (postId: string) => {
    setShowComments(prev => ({ ...prev, [postId]: !prev[postId] }));
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
      // Realtime INSERT triggers reload
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to repost',
        variant: 'destructive',
      });
    }
  };

  const handleCommentAdded = async () => {
    // Realtime UPDATE pushes comments_count change — no full reload needed
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

  const filteredPosts = posts.filter(post => {
    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const authorName = post.profiles ? `${post.profiles.first_name} ${post.profiles.last_name}`.toLowerCase() : '';
      const content = post.content.toLowerCase();
      if (!authorName.includes(query) && !content.includes(query)) {
        return false;
      }
    }
    
    // Content type filter
    if (contentFilter === 'images' && !post.image_url) return false;
    if (contentFilter === 'videos' && !post.video_url) return false;
    
    return true;
  }).sort((a, b) => {
    if (sortBy === 'top') {
      return (b.likes_count + b.comments_count) - (a.likes_count + a.comments_count);
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return (
    <>
      <div className="min-h-screen bg-background pb-20 md:pb-0 scrollbar-hide">
        {/* Header */}
        <header className="border-b bg-card sticky top-0 z-10 shadow-sm">
          <div className="container mx-auto pl-14 md:pl-20 lg:pl-24">
            <div className="flex items-center justify-between h-14 gap-3">
              {/* Left - Back Button (desktop only, logo handles home on all views) */}
              <div className="flex items-center gap-3 flex-shrink-0">
                <BackButton fallbackPath="/company" variant="ghost" size="icon" label="" className="hidden md:flex" />
              </div>

              {/* Center - Universal Search */}
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
                    onClick={() => navigate('/company/feed')}
                  >
                    <MessageSquare className="w-5 h-5" />
                    <span className="text-xs">Feed</span>
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="flex flex-col items-center gap-0.5 h-auto py-2 px-3"
                    onClick={() => navigate('/company/members')}
                  >
                    <Users className="w-5 h-5" />
                    <span className="text-xs">Members</span>
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="flex flex-col items-center gap-0.5 h-auto py-2 px-3 relative"
                    onClick={() => navigate('/messages')}
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
                  >
                    <Calendar className="w-5 h-5" />
                    <span className="text-xs">Calendar</span>
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
          
          {/* Organization Profile Header */}
          {companyInfo && (
            <Card className="mb-6 overflow-hidden">
              {/* Cover Banner */}
              <div className="h-32 md:h-40 bg-gradient-to-r from-primary/20 via-primary/30 to-primary/20 relative">
                <div className="absolute inset-0 bg-[url('/placeholder.svg')] opacity-10 bg-cover bg-center" />
              </div>
              
              {/* Logo and Info */}
              <div className="px-6 pb-6">
                <div className="flex flex-col md:flex-row md:items-end gap-4 -mt-12 md:-mt-16">
                  <Avatar className="w-24 h-24 md:w-32 md:h-32 border-4 border-background shadow-lg">
                    <AvatarImage src={companyInfo.logo || undefined} />
                    <AvatarFallback className="text-2xl md:text-3xl bg-primary text-primary-foreground">
                      {companyInfo.name?.[0]}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1">
                    <h1 className="text-2xl md:text-3xl font-bold">{companyInfo.name}</h1>
                    <p className="text-muted-foreground">{companyInfo.industry_type || 'Company'}</p>
                    <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground flex-wrap">
                      {companyInfo.city && (
                        <span>{companyInfo.city}, {companyInfo.state}</span>
                      )}
                      {companyInfo.employee_count && (
                        <span>{companyInfo.employee_count} employees</span>
                      )}
                      <span>{companyInfo.member_count || 0} members</span>
                    </div>
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="flex gap-3 mt-4 md:mt-0">
                    <Button size="sm" onClick={() => navigate('/messages')}>
                      <Send className="w-4 h-4 mr-2" />
                      Message
                    </Button>
                    <Button variant="outline" size="sm">
                      Following
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Tab Navigation */}
          <div className="mb-4">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
              <TabsList className="bg-muted/50 w-full justify-start">
                <TabsTrigger value="posts" className="flex-1 md:flex-none">Posts</TabsTrigger>
                <TabsTrigger value="about" className="flex-1 md:flex-none">About</TabsTrigger>
                <TabsTrigger value="members" className="flex-1 md:flex-none">Members</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Content Filters - Only show on Posts tab */}
          {activeTab === 'posts' && (
            <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
              <div className="flex gap-2">
                <Badge 
                  variant={contentFilter === 'all' ? 'default' : 'outline'} 
                  className="cursor-pointer hover:bg-primary/80"
                  onClick={() => setContentFilter('all')}
                >
                  All
                </Badge>
                <Badge 
                  variant={contentFilter === 'images' ? 'default' : 'outline'}
                  className="cursor-pointer hover:bg-primary/80"
                  onClick={() => setContentFilter('images')}
                >
                  Images
                </Badge>
                <Badge 
                  variant={contentFilter === 'videos' ? 'default' : 'outline'}
                  className="cursor-pointer hover:bg-primary/80"
                  onClick={() => setContentFilter('videos')}
                >
                  Videos
                </Badge>
              </div>
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recent">Recent</SelectItem>
                  <SelectItem value="top">Top</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {activeTab === 'posts' && (
            <>
              {/* Post Creation Card */}
              <Card className="mb-6">
                <CardContent className="pt-6">
                  <Textarea
                    placeholder="What's on your mind?"
                    value={newPost}
                    onChange={(e) => setNewPost(e.target.value)}
                    className="mb-4 resize-none"
                    rows={3}
                  />
                  {imagePreview && (
                    <div className="relative mb-4">
                      <img src={imagePreview} alt="Preview" className="rounded-lg w-full object-cover" style={{ maxHeight: '516px' }} />
                      <Button
                        variant="destructive"
                        size="sm"
                        className="absolute top-2 right-2"
                        onClick={removeImage}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                  {videoPreview && (
                    <div className="relative mb-4">
                      <video src={videoPreview} controls className="rounded-lg max-h-64 w-full" />
                      <Button
                        variant="destructive"
                        size="sm"
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
                  <div className="flex justify-between items-center">
                    <div className="flex gap-2">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageSelect}
                        className="hidden"
                        id="image-upload"
                        ref={fileInputRef}
                      />
                      <label htmlFor="image-upload">
                        <Button variant="outline" size="sm" type="button" asChild title="Add photo (max 10MB)">
                          <span className="cursor-pointer">
                            <ImageIcon className="w-4 h-4 mr-2" />
                            Photo
                          </span>
                        </Button>
                      </label>
                      <input
                        type="file"
                        accept="video/mp4,video/webm,video/quicktime,video/x-msvideo"
                        onChange={handleVideoSelect}
                        className="hidden"
                        id="video-upload"
                        ref={videoInputRef}
                      />
                      <label htmlFor="video-upload">
                        <Button variant="outline" size="sm" type="button" asChild title="Add video (max 50MB, MP4/WebM/MOV)">
                          <span className="cursor-pointer">
                            <Video className="w-4 h-4 mr-2" />
                            Video
                          </span>
                        </Button>
                      </label>
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                        onChange={handleDocumentSelect}
                        className="hidden"
                        id="document-upload"
                        ref={documentInputRef}
                      />
                      <label htmlFor="document-upload">
                        <Button variant="outline" size="sm" type="button" asChild title="Add document (max 10MB, PDF/DOC/DOCX)">
                          <span className="cursor-pointer">
                            <FileText className="w-4 h-4 mr-2" />
                            Document
                          </span>
                        </Button>
                      </label>
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
                      <Button onClick={handleCreatePost} disabled={(!newPost.trim() && !imageFile && !videoFile && !documentFile) || posting}>
                        {posting ? 'Posting...' : 'Post'}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Posts Feed */}
              {loading ? (
                <div className="text-center py-8">Loading posts...</div>
              ) : filteredPosts.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    {searchQuery || contentFilter !== 'all' ? 'No posts found matching your filters' : 'No posts yet. Be the first to share something!'}
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-6">
                  {filteredPosts.map((post) => (
                    <Card key={post.id}>
                      <CardContent className="pt-6">
                        {/* Engagement badge */}
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            {post.original_post_id && post.original_author && (
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Repeat2 className="w-4 h-4" />
                                <span>
                                  <span className="font-semibold">{post.profiles?.first_name} {post.profiles?.last_name}</span>
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
                        <div className="flex items-start gap-4 mb-4">
                          <Avatar
                            className="cursor-pointer"
                            onClick={() => {
                              if (post.post_context !== 'company') {
                                navigate(`/profile/${post.user_id}`);
                              }
                            }}
                          >
                            <AvatarImage 
                              src={post.post_context === 'company' 
                                ? companyInfo?.logo || undefined 
                                : (post.profiles?.avatar || undefined)
                              } 
                            />
                            <AvatarFallback>
                              {post.post_context === 'company'
                                ? companyInfo?.name?.[0] || 'C'
                                : `${post.profiles?.first_name?.[0] || '?'}${post.profiles?.last_name?.[0] || '?'}`
                              }
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <div>
                                <p 
                                  className={`font-semibold ${post.post_context !== 'company' ? 'cursor-pointer hover:underline' : ''}`}
                                  onClick={() => {
                                    if (post.post_context !== 'company') {
                                      navigate(`/profile/${post.user_id}`);
                                    }
                                  }}
                                >
                                  {post.post_context === 'company'
                                    ? companyInfo?.name || 'Company'
                                    : `${post.profiles?.first_name} ${post.profiles?.last_name}`
                                  }
                                </p>
                                {post.post_context !== 'company' && post.members?.companies && !post.original_post_id && (
                                  <p className="text-sm text-muted-foreground">
                                    {post.members.companies.name}
                                  </p>
                                )}
                                <p className="text-xs text-muted-foreground">
                                  {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                                </p>
                              </div>
                              {post.user_id === currentUserId && (
                                <div className="flex gap-2">
                                  <EditPostDialog
                                    postId={post.id}
                                    initialContent={post.content}
                                    onSave={loadPosts}
                                  />
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDelete(post.id)}
                                  >
                                    <Trash2 className="w-4 h-4 text-destructive" />
                                  </Button>
                                </div>
                              )}
                            </div>
                            <MentionText text={post.content} className="mt-3" />
                            {post.image_url && (
                              <div className="mt-3 overflow-hidden rounded-lg bg-black/5">
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
                                className="mt-3 rounded-lg max-h-96 w-full max-w-full"
                              />
                            )}
                            {post.document_url && (
                              <a
                                href={post.document_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-3 flex items-center gap-2 p-3 bg-muted rounded-lg hover:bg-muted/80 transition-colors"
                              >
                                <FileText className="w-5 h-5 text-primary" />
                                <span className="text-sm font-medium">View Document</span>
                              </a>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1 sm:gap-4 pt-4 border-t flex-wrap">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleLike(post.id, post.liked_by_user || false)}
                            className={`px-2 sm:px-3 ${post.liked_by_user ? 'text-red-500' : ''}`}
                          >
                            <Heart className={`w-4 h-4 sm:mr-1 ${post.liked_by_user ? 'fill-current' : ''}`} />
                            <span className="text-xs ml-1">{post.likes_count > 0 && post.likes_count}</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleComments(post.id)}
                            className="px-2 sm:px-3"
                          >
                            <MessageCircle className="w-4 h-4 sm:mr-1" />
                            <span className="text-xs ml-1">{post.comments_count > 0 && post.comments_count}</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRepost(post)}
                            className="px-2 sm:px-3"
                          >
                            <Repeat2 className="w-4 h-4 sm:mr-1" />
                            <span className="text-xs ml-1">{post.reposts_count > 0 && post.reposts_count}</span>
                          </Button>
                          <SharePostDropdown
                            postId={post.id}
                            postContent={post.content}
                            sharesCount={post.shares_count || 0}
                            onShareComplete={loadPosts}
                          />
                          <BookmarkButton postId={post.id} userId={currentUserId} />
                        </div>

                        {showComments[post.id] && (
                          <div className="mt-4 pt-4 border-t">
                            <CommentsSection 
                              postId={post.id}
                              currentUserId={currentUserId}
                              onCommentAdded={handleCommentAdded}
                            />
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </>
          )}

          {activeTab === 'about' && (
            <Card>
              <CardContent className="py-6">
                <h3 className="text-lg font-semibold mb-4">About {companyInfo?.name}</h3>
                <p className="text-muted-foreground">
                  {companyInfo?.description || 'No description available.'}
                </p>
              </CardContent>
            </Card>
          )}

          {activeTab === 'members' && (
            <Card>
              <CardContent className="py-6 text-center">
                <Button onClick={() => navigate('/company/members')}>
                  View All Members
                </Button>
              </CardContent>
            </Card>
          )}
        </main>

        {/* Floating Chat */}
        <FloatingChat currentUserId={currentUserId} />

        {/* Mobile Navigation */}
        <MobileNavigation />
      </div>
    </>
  );
}
