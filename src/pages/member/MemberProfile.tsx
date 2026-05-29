import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useProfile } from '@/hooks/useProfile';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { FloatingChat } from '@/components/messages/FloatingChat';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { CommentsSection } from '@/components/member/CommentsSection';
import { EditPostDialog } from '@/components/member/EditPostDialog';
import { SharePostDropdown } from '@/components/post/SharePostDropdown';
import { BookmarkButton } from '@/components/post/BookmarkButton';
import { PostEngagementBadge } from '@/components/post/PostEngagementBadge';
import { formatDistanceToNow } from 'date-fns';
import { 
  ArrowLeft, 
  MapPin, 
  Briefcase, 
  GraduationCap, 
  Award, 
  Lightbulb,
  Linkedin,
  Twitter,
  Globe,
  Mail,
  Phone,
  Edit,
  Camera,
  MessageSquare,
  Building2,
  Pencil,
  Trash2,
  ExternalLink,
  Users,
  Heart,
  MessageCircle,
  Repeat2,
  FileText,
  Bookmark
} from 'lucide-react';
import { EditProfileDialog } from '@/components/member/EditProfileDialog';
import { EditWorkExperienceDialog } from '@/components/member/EditWorkExperienceDialog';
import { EditEducationDialog } from '@/components/member/EditEducationDialog';
import { EditSkillsDialog } from '@/components/member/EditSkillsDialog';
import { EditCertificationsDialog } from '@/components/member/EditCertificationsDialog';
import { ManageCertificationDialog } from '@/components/member/ManageCertificationDialog';
import { MobileNavigation } from '@/components/layout/MobileNavigation';

interface ProfileData {
  id: string;
  first_name: string;
  last_name: string;
  headline: string | null;
  bio: string | null;
  avatar: string | null;
  cover_image: string | null;
  location: string | null;
  phone: string | null;
  linkedin_url: string | null;
  twitter_url: string | null;
  website_url: string | null;
  employment_status: string | null;
  open_to_work: boolean;
}

interface WorkExperience {
  id: string;
  company: string;
  title: string;
  location: string | null;
  start_date: string;
  end_date: string | null;
  is_current: boolean;
  description: string | null;
}

interface Education {
  id: string;
  school: string;
  degree: string | null;
  field_of_study: string | null;
  start_date: string | null;
  end_date: string | null;
  description: string | null;
}

interface Skill {
  id: string;
  skill_name: string;
  endorsements_count: number;
}

interface Certification {
  id: string;
  name: string;
  issuing_organization: string;
  issue_date: string | null;
  expiration_date: string | null;
  credential_id?: string | null;
  credential_url: string | null;
  certificate_file_url?: string | null;
}

interface Association {
  id: string;
  name: string;
  description: string | null;
  logo: string | null;
  city: string | null;
  state: string | null;
}

interface ProfilePost {
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
  user_liked: boolean;
}

interface SavedPostWithAuthor extends ProfilePost {
  author: {
    first_name: string;
    last_name: string;
    avatar: string | null;
  } | null;
}

export default function MemberProfile() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile, loading: profileLoading, refresh: refreshProfile } = useProfile(userId);
  const [workExperience, setWorkExperience] = useState<WorkExperience[]>([]);
  const [education, setEducation] = useState<Education[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [certifications, setCertifications] = useState<Certification[]>([]);
  const [associations, setAssociations] = useState<Association[]>([]);
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'none' | 'pending' | 'connected'>('none');
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [isReceiver, setIsReceiver] = useState(false);
  const [chatId, setChatId] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [connectionCount, setConnectionCount] = useState(0);
  const [activeTab, setActiveTab] = useState<'posts' | 'saved' | 'about'>('posts');
  const [userPosts, setUserPosts] = useState<ProfilePost[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [showComments, setShowComments] = useState<Set<string>>(new Set());
  const [savedPosts, setSavedPosts] = useState<SavedPostWithAuthor[]>([]);
  const [savedPostsLoading, setSavedPostsLoading] = useState(false);
  const [creatingChat, setCreatingChat] = useState(false);
  const latestUserIdRef = useRef(userId);
  const latestCurrentUserRef = useRef(currentUser);
  const profileLoadRequestIdRef = useRef(0);
  const postsLoadRequestIdRef = useRef(0);
  const savedPostsRequestIdRef = useRef(0);
  const connectionRequestIdRef = useRef(0);
  const chatCreationInFlightRef = useRef(false);

  const isOwnProfile = currentUser === userId;

  useEffect(() => {
    latestUserIdRef.current = userId;
  }, [userId]);

  useEffect(() => {
    latestCurrentUserRef.current = currentUser;
  }, [currentUser]);

  useEffect(() => {
    loadCurrentUser();
    loadProfile();
    loadUserPosts();
  }, [userId]);

  // Load saved posts when switching to Saved tab (only for own profile)
  useEffect(() => {
    if (activeTab === 'saved' && isOwnProfile && savedPosts.length === 0 && !savedPostsLoading) {
      loadSavedPosts();
    }
  }, [activeTab, isOwnProfile]);

  const loadSavedPosts = async () => {
    if (!currentUser) return;
    const requestId = ++savedPostsRequestIdRef.current;
    const currentUserId = currentUser;

    try {
      setSavedPostsLoading(true);
      
      // Get bookmarked post IDs
      const { data: bookmarks, error: bookmarkError } = await supabase
        .from('post_bookmarks')
        .select('post_id')
        .eq('user_id', currentUser)
        .order('created_at', { ascending: false });

      if (bookmarkError) throw bookmarkError;
      
      if (!bookmarks || bookmarks.length === 0) {
        if (requestId === savedPostsRequestIdRef.current && currentUserId === latestCurrentUserRef.current) {
          setSavedPosts([]);
        }
        return;
      }

      const postIds = bookmarks.map(b => b.post_id);
      
      // Get the actual posts
      const { data: postsData, error: postsError } = await supabase
        .from('posts')
        .select('*')
        .in('id', postIds);

      if (postsError) throw postsError;

      // Get unique author IDs
      const authorIds = [...new Set((postsData || []).map(p => p.user_id))];
      
      // Fetch author profiles
      const { data: authorsData } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, avatar')
        .in('id', authorIds);

      const authorsMap = new Map(
        (authorsData || []).map(a => [a.id, { first_name: a.first_name, last_name: a.last_name, avatar: a.avatar }])
      );

      // Check which posts the current user has liked
      let likedPostIds: string[] = [];
      if (postsData && postsData.length > 0) {
        const { data: likesData } = await supabase
          .from('post_likes')
          .select('post_id')
          .eq('user_id', currentUser)
          .in('post_id', postsData.map(p => p.id));
        
        likedPostIds = (likesData || []).map(l => l.post_id);
      }

      // Order by bookmark order (most recent first)
      const orderedPosts: SavedPostWithAuthor[] = postIds
        .map(id => postsData?.find(p => p.id === id))
        .filter(Boolean)
        .map(post => ({
          ...post!,
          user_liked: likedPostIds.includes(post!.id),
          author: authorsMap.get(post!.user_id) || null
        }));

      if (requestId === savedPostsRequestIdRef.current && currentUserId === latestCurrentUserRef.current) {
        setSavedPosts(orderedPosts);
      }
    } catch (error: any) {
      console.error('Error loading saved posts:', error);
    } finally {
      if (requestId === savedPostsRequestIdRef.current && currentUserId === latestCurrentUserRef.current) {
        setSavedPostsLoading(false);
      }
    }
  };

  useEffect(() => {
    if (currentUser && userId && !isOwnProfile) {
      checkConnectionStatus();
    }
  }, [currentUser, userId, isOwnProfile]);

  const loadUserPosts = async () => {
    if (!userId) return;
    const requestId = ++postsLoadRequestIdRef.current;
    const targetUserId = userId;

    try {
      setPostsLoading(true);
      
      // Get current user for checking likes
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      
      // Load posts by this user
      const { data: postsData, error } = await supabase
        .from('posts')
        .select('*')
        .eq('user_id', targetUserId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Check which posts the current user has liked
      let likedPostIds: string[] = [];
      if (user && postsData && postsData.length > 0) {
        const { data: likesData } = await supabase
          .from('post_likes')
          .select('post_id')
          .eq('user_id', user.id)
          .in('post_id', postsData.map(p => p.id));
        
        likedPostIds = (likesData || []).map(l => l.post_id);
      }

      const postsWithLikeStatus = (postsData || []).map(post => ({
        ...post,
        user_liked: likedPostIds.includes(post.id)
      }));

      if (requestId === postsLoadRequestIdRef.current && targetUserId === latestUserIdRef.current) {
        setUserPosts(postsWithLikeStatus);
      }
    } catch (error: any) {
      console.error('Error loading posts:', error);
    } finally {
      if (requestId === postsLoadRequestIdRef.current && targetUserId === latestUserIdRef.current) {
        setPostsLoading(false);
      }
    }
  };

  const handleLikePost = async (postId: string, currentlyLiked: boolean) => {
    if (!currentUser) return;
    
    try {
      if (currentlyLiked) {
        await supabase
          .from('post_likes')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', currentUser);
        
        await supabase
          .from('posts')
          .update({ likes_count: userPosts.find(p => p.id === postId)!.likes_count - 1 })
          .eq('id', postId);
      } else {
        await supabase
          .from('post_likes')
          .insert({ post_id: postId, user_id: currentUser });
        
        await supabase
          .from('posts')
          .update({ likes_count: userPosts.find(p => p.id === postId)!.likes_count + 1 })
          .eq('id', postId);
      }
      
      setUserPosts(prev => prev.map(post => 
        post.id === postId 
          ? { 
              ...post, 
              user_liked: !currentlyLiked,
              likes_count: currentlyLiked ? post.likes_count - 1 : post.likes_count + 1
            }
          : post
      ));
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to update like',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteEducation = async (educationId: string) => {
    try {
      const { error } = await supabase
        .from('education')
        .delete()
        .eq('id', educationId);

      if (error) throw error;

      setEducation(prev => prev.filter(e => e.id !== educationId));
      toast({
        title: 'Success',
        description: 'Education entry deleted',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to delete education entry',
        variant: 'destructive',
      });
    }
  };

  const handleDeletePost = async (postId: string) => {
    try {
      const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', postId);
      
      if (error) throw error;
      
      setUserPosts(prev => prev.filter(p => p.id !== postId));
      toast({
        title: 'Success',
        description: 'Post deleted',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to delete post',
        variant: 'destructive',
      });
    }
  };

  const toggleComments = (postId: string) => {
    setShowComments(prev => {
      const newSet = new Set(prev);
      if (newSet.has(postId)) {
        newSet.delete(postId);
      } else {
        newSet.add(postId);
      }
      return newSet;
    });
  };

  const loadCurrentUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
    setCurrentUser(user?.id || null);
  };

  const checkConnectionStatus = async () => {
    const requestId = ++connectionRequestIdRef.current;
    const currentViewerId = currentUser;
    const targetUserId = userId;

    try {
      // Get both members with company_id (use limit(1) to handle duplicate member records)
      const { data: currentMembers } = await supabase
        .from('members')
        .select('id, company_id')
        .eq('user_id', currentViewerId)
        .eq('is_active', true)
        .limit(1);
      const currentMember = currentMembers?.[0] || null;

      const { data: otherMembers } = await supabase
        .from('members')
        .select('id, company_id')
        .eq('user_id', targetUserId)
        .eq('is_active', true)
        .limit(1);
      const otherMember = otherMembers?.[0] || null;

      if (!currentMember || !otherMember) return;
      if (requestId !== connectionRequestIdRef.current || currentViewerId !== latestCurrentUserRef.current || targetUserId !== latestUserIdRef.current) return;

      // Check connection status
      const { data: connection } = await supabase
        .from('connections')
        .select('id, status, sender_id, receiver_id')
        .or(`and(sender_id.eq.${currentMember.id},receiver_id.eq.${otherMember.id}),and(sender_id.eq.${otherMember.id},receiver_id.eq.${currentMember.id})`)
        .maybeSingle();

      if (connection && (connection.status === 'accepted' || connection.status === 'pending')) {
        if (requestId !== connectionRequestIdRef.current || currentViewerId !== latestCurrentUserRef.current || targetUserId !== latestUserIdRef.current) return;
        setConnectionId(connection.id);
        // Check if current user is the receiver
        setIsReceiver(connection.receiver_id === currentMember.id);

        if (connection.status === 'accepted') {
          setConnectionStatus('connected');
          // Find existing chat using member.id
          await findExistingChat(currentMember.id, otherMember.id);
        } else {
          setConnectionStatus('pending');
        }
      } else {
        if (requestId !== connectionRequestIdRef.current || currentViewerId !== latestCurrentUserRef.current || targetUserId !== latestUserIdRef.current) return;
        setConnectionStatus('none');
        setConnectionId(null);
        setIsReceiver(false);
      }
    } catch (error) {
      console.error('Error checking connection:', error);
    }
  };

  const findExistingChat = async (currentMemberId: string, otherMemberId: string) => {
    try {
      // Get chats where current member is participant
      const { data: currentChats } = await supabase
        .from('chat_participants')
        .select('chat_id')
        .eq('member_id', currentMemberId);

      if (!currentChats || currentChats.length === 0) return;

      // Check each chat to see if other member is also in it
      for (const chat of currentChats) {
        const { data: participants } = await supabase
          .from('chat_participants')
          .select('member_id')
          .eq('chat_id', chat.chat_id);

        if (participants && participants.length === 2) {
          const otherParticipant = participants.find(p => p.member_id !== currentMemberId);
          if (otherParticipant?.member_id === otherMemberId) {
            setChatId(chat.chat_id);
            return chat.chat_id;
          }
        }
      }
    } catch (error) {
      console.error('Error finding chat:', error);
    }

    return null;
  };

  const handleStartMessage = async () => {
    if (chatCreationInFlightRef.current) return;

    try {
      chatCreationInFlightRef.current = true;
      setCreatingChat(true);

      if (chatId) {
        // Chat already exists, just open it
        setChatOpen(true);
        return;
      }

      // Create new chat (use limit(1) to handle duplicate member records)
      const { data: currentMembers } = await supabase
        .from('members')
        .select('id')
        .eq('user_id', currentUser)
        .eq('is_active', true)
        .limit(1);
      const currentMember = currentMembers?.[0] || null;

      const { data: otherMembers } = await supabase
        .from('members')
        .select('id')
        .eq('user_id', userId)
        .eq('is_active', true)
        .limit(1);
      const otherMember = otherMembers?.[0] || null;

      if (!currentMember || !otherMember) {
        toast({
          title: 'Error',
          description: 'Unable to find member information',
          variant: 'destructive',
        });
        return;
      }

      const existingChatId = await findExistingChat(currentMember.id, otherMember.id);
      if (existingChatId) {
        setChatId(existingChatId);
        setChatOpen(true);
        return;
      }

      const { data: newChat, error: chatError } = await supabase
        .from('chats')
        .insert({
          type: 'direct',
          last_message_at: new Date().toISOString()
        })
        .select()
        .single();

      if (chatError) throw chatError;

      // Add participants
      const { error: participantError } = await supabase
        .from('chat_participants')
        .insert([
          { chat_id: newChat.id, member_id: currentMember.id },
          { chat_id: newChat.id, member_id: otherMember.id }
        ]);

      if (participantError) throw participantError;

      setChatId(newChat.id);
      setChatOpen(true);
      toast({
        title: 'Success',
        description: 'Chat created',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to create chat',
        variant: 'destructive',
      });
    } finally {
      chatCreationInFlightRef.current = false;
      setCreatingChat(false);
    }
  };

  const loadProfile = async () => {
    const requestId = ++profileLoadRequestIdRef.current;
    const targetUserId = userId;

    try {
      setLoading(true);

      // Refresh profile from the hook
      await refreshProfile();
      if (requestId !== profileLoadRequestIdRef.current || targetUserId !== latestUserIdRef.current) return;

      // Load work experience
      const { data: workData } = await supabase
        .from('work_experience')
        .select('*')
        .eq('user_id', userId)
        .order('is_current', { ascending: false })
        .order('start_date', { ascending: false });
      if (requestId !== profileLoadRequestIdRef.current || targetUserId !== latestUserIdRef.current) return;
      setWorkExperience(workData || []);

      // Load education
      const { data: eduData } = await supabase
        .from('education')
        .select('*')
        .eq('user_id', userId)
        .order('start_date', { ascending: false });
      if (requestId !== profileLoadRequestIdRef.current || targetUserId !== latestUserIdRef.current) return;
      setEducation(eduData || []);

      // Load skills
      const { data: skillsData } = await supabase
        .from('skills')
        .select('*')
        .eq('user_id', userId)
        .order('endorsements_count', { ascending: false });
      if (requestId !== profileLoadRequestIdRef.current || targetUserId !== latestUserIdRef.current) return;
      setSkills(skillsData || []);

      // Load certifications
      const { data: certsData } = await supabase
        .from('certifications')
        .select('*')
        .eq('user_id', userId)
        .order('issue_date', { ascending: false });
      if (requestId !== profileLoadRequestIdRef.current || targetUserId !== latestUserIdRef.current) return;
      setCertifications(certsData || []);

      // Load associations - both direct (as manager) and indirect (via company)
      const associationIds = new Set<string>();
      
      // Get associations where user is a manager
      const { data: managerData } = await supabase
        .from('association_managers')
        .select('association_id')
        .eq('user_id', userId)
        .eq('is_active', true);
      
      managerData?.forEach(m => associationIds.add(m.association_id));

      // Get associations through company membership
      const { data: memberData } = await supabase
        .from('members')
        .select('company_id, companies!inner(association_id)')
        .eq('user_id', userId)
        .eq('is_active', true);

      memberData?.forEach(m => {
        const company = m.companies as any;
        if (company?.association_id) {
          associationIds.add(company.association_id);
        }
      });

      // Fetch association details
      if (associationIds.size > 0) {
        const { data: associationsData } = await supabase
          .from('associations')
          .select('id, name, description, logo, city, state')
          .in('id', Array.from(associationIds))
          .eq('is_active', true)
          .order('name');
        
        if (requestId !== profileLoadRequestIdRef.current || targetUserId !== latestUserIdRef.current) return;
        setAssociations(associationsData || []);
      } else if (requestId === profileLoadRequestIdRef.current && targetUserId === latestUserIdRef.current) {
        setAssociations([]);
      }

      // Load connection count (use limit(1) to handle duplicate member records)
      const { data: userMembers } = await supabase
        .from('members')
        .select('id')
        .eq('user_id', userId)
        .eq('is_active', true)
        .limit(1);
      const userMember = userMembers?.[0] || null;

      if (userMember) {
        const { count } = await supabase
          .from('connections')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'accepted')
          .or(`sender_id.eq.${userMember.id},receiver_id.eq.${userMember.id}`);
        
        if (requestId !== profileLoadRequestIdRef.current || targetUserId !== latestUserIdRef.current) return;
        setConnectionCount(count || 0);
      } else if (requestId === profileLoadRequestIdRef.current && targetUserId === latestUserIdRef.current) {
        setConnectionCount(0);
      }

    } catch (error: any) {
      if (requestId !== profileLoadRequestIdRef.current || targetUserId !== latestUserIdRef.current) return;
      toast({
        title: 'Error',
        description: 'Failed to load profile',
        variant: 'destructive',
      });
    } finally {
      if (requestId === profileLoadRequestIdRef.current && targetUserId === latestUserIdRef.current) {
        setLoading(false);
      }
    }
  };

  const handleImageUpload = async (file: File, type: 'avatar' | 'cover') => {
    if (!currentUser || !isOwnProfile) return;

    try {
      setUploading(true);

      // Validate based on type
      const { validateAvatarUpload, validateCoverImageUpload } = await import('@/lib/uploadValidation');
      const validation = type === 'avatar' 
        ? await validateAvatarUpload(file)
        : await validateCoverImageUpload(file);

      if (!validation.valid) {
        toast({
          title: 'Validation Error',
          description: validation.error,
          variant: 'destructive',
        });
        return;
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${currentUser}/${type}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('profile-images')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('profile-images')
        .getPublicUrl(fileName);

      const updateField = type === 'avatar' ? 'avatar' : 'cover_image';
      const { data: updatedProfile, error: updateError } = await supabase
        .from('profiles')
        .update({ [updateField]: publicUrl })
        .eq('id', currentUser)
        .select()
        .single();

      if (updateError) throw updateError;

      if (!updatedProfile?.[updateField]) {
        throw new Error('Photo update was not saved. Please try again.');
      }

      toast({
        title: 'Success',
        description: `${type === 'avatar' ? 'Profile' : 'Cover'} photo updated`,
      });

      await refreshProfile();
    } catch (error: any) {
      console.error('Image upload error:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to upload image',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleAcceptConnection = async () => {
    if (!connectionId) return;
    
    try {
      const { error } = await supabase
        .from('connections')
        .update({ status: 'accepted', responded_at: new Date().toISOString() })
        .eq('id', connectionId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Connection request accepted',
      });

      await checkConnectionStatus();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to accept connection',
        variant: 'destructive',
      });
    }
  };

  const handleRejectConnection = async () => {
    if (!connectionId) return;
    
    try {
      const { error } = await supabase
        .from('connections')
        .update({ status: 'rejected', responded_at: new Date().toISOString() })
        .eq('id', connectionId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Connection request rejected',
      });

      await checkConnectionStatus();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to reject connection',
        variant: 'destructive',
      });
    }
  };

  const handleSendConnection = async () => {
    try {
      // Get both members (use limit(1) to handle duplicate member records)
      const { data: currentMembers } = await supabase
        .from('members')
        .select('id')
        .eq('user_id', currentUser)
        .eq('is_active', true)
        .limit(1);
      const currentMember = currentMembers?.[0] || null;

      const { data: otherMembers } = await supabase
        .from('members')
        .select('id')
        .eq('user_id', userId)
        .eq('is_active', true)
        .limit(1);
      const otherMember = otherMembers?.[0] || null;

      if (!currentMember || !otherMember) {
        toast({
          title: 'Error',
          description: 'Unable to find member profiles',
          variant: 'destructive',
        });
        return;
      }

      // Remove any previously rejected connection before re-sending
      await supabase
        .from('connections')
        .delete()
        .eq('sender_id', currentMember.id)
        .eq('receiver_id', otherMember.id)
        .eq('status', 'rejected');

      const { error } = await supabase.from('connections').insert({
        sender_id: currentMember.id,
        receiver_id: otherMember.id,
        status: 'pending',
      });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Connection request sent',
      });

      await checkConnectionStatus();
    } catch (error: any) {
      console.error('Connection request error:', error);
      toast({
        title: 'Error',
        description: error?.message || 'Failed to send connection request',
        variant: 'destructive',
      });
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Present';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
    });
  };

  // Certifications Section Component
  const CertificationsSection = ({ 
    certifications, 
    isOwnProfile, 
    onSave 
  }: { 
    certifications: Certification[]; 
    isOwnProfile: boolean; 
    onSave: () => void;
  }) => {
    const [editingCert, setEditingCert] = useState<Certification | null>(null);

    if (certifications.length === 0 && !isOwnProfile) return null;

    return (
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5" />
              <h2 className="text-xl font-semibold">Certifications</h2>
            </div>
            {isOwnProfile && <EditCertificationsDialog onSave={onSave} />}
          </div>
          {certifications.length === 0 ? (
            <p className="text-muted-foreground">No certifications added yet</p>
          ) : (
            <div className="space-y-4">
              {certifications.map((cert) => (
                <div key={cert.id} className="group relative">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="font-semibold">{cert.name}</h3>
                      <p className="text-muted-foreground">{cert.issuing_organization}</p>
                      {cert.issue_date && (
                        <p className="text-sm text-muted-foreground mt-1">
                          Issued {formatDate(cert.issue_date)}
                          {cert.expiration_date && ` - Expires ${formatDate(cert.expiration_date)}`}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-3 mt-2">
                        {cert.credential_url && (
                          <a
                            href={cert.credential_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                          >
                            View credential
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                        {cert.certificate_file_url && (
                          <a
                            href={cert.certificate_file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                          >
                            View certificate
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </div>
                    {isOwnProfile && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => setEditingCert(cert)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>

        {editingCert && (
          <ManageCertificationDialog
            certification={editingCert}
            open={!!editingCert}
            onOpenChange={(open) => !open && setEditingCert(null)}
            onSave={onSave}
          />
        )}
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p>Loading profile...</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">Profile not found</p>
          <Button variant="outline" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  const fullName = `${profile.first_name} ${profile.last_name}`;
  const initials = `${profile.first_name[0]}${profile.last_name[0]}`;

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto py-3 md:py-4 md:pl-20">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Back</span>
            <span className="sm:hidden">Back</span>
          </Button>
        </div>
      </header>

      <main className="container mx-auto py-4 md:py-6 md:pl-20 max-w-5xl">
        {/* Cover & Profile Photo */}
        <Card className="overflow-hidden mb-6">
          <div className="relative">
            {/* Cover Image */}
            <div className="h-[128px] md:h-[200px] bg-gradient-to-r from-primary/20 to-primary/10 relative">
              {profile.cover_image && (
                <img
                  src={profile.cover_image}
                  alt="Cover"
                  className="w-full h-full object-cover"
                />
              )}
              {isOwnProfile && (
                <label className="absolute top-4 right-4 cursor-pointer">
                  <Button variant="secondary" size="sm" disabled={uploading} asChild>
                    <div>
                      <Camera className="w-4 h-4 mr-2" />
                      Edit cover
                    </div>
                  </Button>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleImageUpload(file, 'cover');
                    }}
                  />
                </label>
              )}
            </div>

            {/* Profile Info */}
            <CardContent className="pt-0">
              <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-end">
                {/* Avatar with overlap */}
                <div className="relative -mt-16 sm:-mt-20 shrink-0">
                  <Avatar className="w-32 h-32 border-4 border-card bg-card">
                    <AvatarImage src={profile.avatar || undefined} />
                    <AvatarFallback className="text-3xl">{initials}</AvatarFallback>
                  </Avatar>
                  {isOwnProfile && (
                    <label className="absolute bottom-0 right-0 cursor-pointer">
                      <Button size="icon" variant="secondary" className="rounded-full" disabled={uploading} asChild>
                        <div>
                          <Camera className="w-4 h-4" />
                        </div>
                      </Button>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleImageUpload(file, 'avatar');
                        }}
                      />
                    </label>
                  )}
                </div>

                {/* Text content - no overlap */}
              <div className="flex-1 sm:mb-4 pt-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <h1 className="text-3xl font-bold">{fullName}</h1>
                      {profile.headline && (
                        <p className="text-lg text-muted-foreground mt-1">{profile.headline}</p>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-muted-foreground">
                        {profile.location && (
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4" />
                            <span>{profile.location}</span>
                          </div>
                        )}
                        <button 
                          onClick={() => navigate('/member/connections')}
                          className="text-primary hover:underline font-medium"
                        >
                          {connectionCount > 500 ? '500+' : connectionCount} connection{connectionCount !== 1 ? 's' : ''}
                        </button>
                      </div>
                      {/* Employment Status Badge */}
                      {profile.employment_status && (
                        <div className="mt-3">
                          <Badge 
                            variant={profile.open_to_work ? "default" : "secondary"}
                            className="text-sm"
                          >
                            {profile.employment_status === 'currently_working' && '💼 Currently working'}
                            {profile.employment_status === 'open_to_opportunities' && '🟢 Open to opportunities'}
                            {profile.employment_status === 'actively_looking' && '🔍 Actively looking'}
                            {profile.employment_status === 'hiring' && '📢 Hiring'}
                            {profile.employment_status === 'not_looking' && 'Not looking'}
                            {profile.employment_status === 'open_to_consulting' && '💼 Open to consulting'}
                            {profile.employment_status === 'available_for_freelance' && '✨ Available for freelance'}
                          </Badge>
                        </div>
                      )}
                    </div>
                    {isOwnProfile && (
                      <div className="relative z-10">
                        <EditProfileDialog profile={profile} onSave={loadProfile} />
                      </div>
                    )}
                  </div>

                  {/* Contact & Social Links */}
                  <div className="flex flex-wrap gap-3 mt-4">
                    {/* Connect Button for No Connection */}
                    {!isOwnProfile && connectionStatus === 'none' && (
                      <Button variant="default" size="sm" onClick={handleSendConnection}>
                        Connect
                      </Button>
                    )}
                    {/* Pending Status for Sent Requests */}
                    {!isOwnProfile && connectionStatus === 'pending' && !isReceiver && (
                      <Button variant="outline" size="sm" disabled>
                        Request Pending
                      </Button>
                    )}
                    {/* Accept/Reject Buttons for Received Requests */}
                    {!isOwnProfile && connectionStatus === 'pending' && isReceiver && (
                      <>
                        <Button variant="default" size="sm" onClick={handleAcceptConnection}>
                          Accept
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleRejectConnection}>
                          Reject
                        </Button>
                      </>
                    )}
                    {/* Message Button for Connected Users */}
                    {!isOwnProfile && connectionStatus === 'connected' && (
                    <Button variant="default" size="sm" onClick={handleStartMessage} disabled={creatingChat}>
                        <MessageSquare className="w-4 h-4 mr-2" />
                        Message
                      </Button>
                    )}
                    {profile.phone && (
                      <a href={`tel:${profile.phone}`}>
                        <Button variant="outline" size="sm">
                          <Phone className="w-4 h-4 mr-2" />
                          Contact
                        </Button>
                      </a>
                    )}
                    {profile.linkedin_url && (
                      <a href={profile.linkedin_url} target="_blank" rel="noopener noreferrer">
                        <Button variant="outline" size="sm">
                          <Linkedin className="w-4 h-4" />
                        </Button>
                      </a>
                    )}
                    {profile.twitter_url && (
                      <a href={profile.twitter_url} target="_blank" rel="noopener noreferrer">
                        <Button variant="outline" size="sm">
                          <Twitter className="w-4 h-4" />
                        </Button>
                      </a>
                    )}
                    {profile.website_url && (
                      <a href={profile.website_url} target="_blank" rel="noopener noreferrer">
                        <Button variant="outline" size="sm">
                          <Globe className="w-4 h-4" />
                        </Button>
                      </a>
                    )}
                  </div>

                  {/* Bio Preview */}
                  {profile.bio && (
                    <p className="text-sm text-muted-foreground mt-4 line-clamp-3 whitespace-pre-wrap">{profile.bio}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </div>
        </Card>

        {/* Tabs Navigation */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'posts' | 'saved' | 'about')} className="w-full">
          <TabsList className="w-full justify-start bg-muted/50 mb-6">
            <TabsTrigger value="posts" className="flex-1 md:flex-none">
              Posts
            </TabsTrigger>
            {isOwnProfile && (
              <TabsTrigger value="saved" className="flex-1 md:flex-none">
                Saved
              </TabsTrigger>
            )}
            <TabsTrigger value="about" className="flex-1 md:flex-none">
              About
            </TabsTrigger>
          </TabsList>

          {/* Posts Tab */}
          <TabsContent value="posts" className="space-y-4">
            {postsLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <Card key={i}>
                    <CardContent className="pt-6">
                      <div className="flex gap-3">
                        <Skeleton className="h-10 w-10 rounded-full" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-4 w-full" />
                          <Skeleton className="h-4 w-3/4" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : userPosts.length === 0 ? (
              <Card>
                <CardContent className="pt-6 text-center py-12">
                  <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-semibold text-lg mb-2">No posts yet</h3>
                  {isOwnProfile ? (
                    <>
                      <p className="text-muted-foreground mb-4">Share your thoughts and updates with your network.</p>
                      <Button onClick={() => navigate('/member/feed')}>
                        Create your first post
                      </Button>
                    </>
                  ) : (
                    <p className="text-muted-foreground">{profile.first_name} hasn't posted yet.</p>
                  )}
                </CardContent>
              </Card>
            ) : (
              userPosts.map((post) => (
                <Card key={post.id}>
                  <CardContent className="pt-6">
                    {/* Post Header */}
                    <div className="flex items-start gap-3 mb-4">
                      <Avatar className="w-10 h-10 cursor-pointer">
                        <AvatarImage src={profile.avatar || undefined} />
                        <AvatarFallback>{profile.first_name[0]}{profile.last_name[0]}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-semibold">{profile.first_name} {profile.last_name}</span>
                            <p className="text-sm text-muted-foreground">
                              {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                            </p>
                          </div>
                          {isOwnProfile && (
                            <div className="flex items-center gap-1">
                              <EditPostDialog
                                postId={post.id}
                                initialContent={post.content}
                                onSave={loadUserPosts}
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive hover:text-destructive"
                                onClick={() => handleDeletePost(post.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Post Content */}
                    <p className="whitespace-pre-wrap mb-4">{post.content}</p>

                    {/* Post Media */}
                    {post.image_url && (
                      <div className="overflow-hidden rounded-lg bg-black/5 mb-4">
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
                        className="rounded-lg max-h-96 w-full object-cover mb-4"
                      />
                    )}
                    {post.document_url && (
                      <a
                        href={post.document_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 p-3 bg-muted rounded-lg mb-4 hover:bg-muted/80"
                      >
                        <FileText className="h-5 w-5" />
                        <span className="text-sm">View Document</span>
                      </a>
                    )}

                    {/* Engagement Badge */}
                    <PostEngagementBadge
                      likesCount={post.likes_count}
                      commentsCount={post.comments_count}
                      sharesCount={post.shares_count || 0}
                      repostsCount={post.reposts_count || 0}
                    />

                    <Separator className="my-4" />

                    {/* Post Actions */}
                    <div className="flex items-center justify-between">
                      <Button
                        variant="ghost"
                        size="sm"
                        className={post.user_liked ? 'text-red-500' : ''}
                        onClick={() => handleLikePost(post.id, post.user_liked)}
                      >
                        <Heart className={`h-4 w-4 mr-2 ${post.user_liked ? 'fill-current' : ''}`} />
                        Like
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleComments(post.id)}
                      >
                        <MessageCircle className="h-4 w-4 mr-2" />
                        Comment
                      </Button>
                      <SharePostDropdown postId={post.id} postContent={post.content} />
                      <BookmarkButton postId={post.id} userId={currentUser} />
                    </div>

                    {/* Comments Section */}
                    {showComments.has(post.id) && (
                      <div className="mt-4">
                        <CommentsSection postId={post.id} currentUserId={currentUser} onCommentAdded={loadUserPosts} />
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          {/* Saved Posts Tab - Only visible for own profile */}
          {isOwnProfile && (
            <TabsContent value="saved" className="space-y-4">
              {savedPostsLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => (
                    <Card key={i}>
                      <CardContent className="pt-6">
                        <div className="flex gap-3">
                          <Skeleton className="h-10 w-10 rounded-full" />
                          <div className="flex-1 space-y-2">
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-3/4" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : savedPosts.length === 0 ? (
                <Card>
                  <CardContent className="pt-6 text-center py-12">
                    <Bookmark className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="font-semibold text-lg mb-2">No saved posts yet</h3>
                    <p className="text-muted-foreground mb-4">Bookmark posts from your feed to save them here for later.</p>
                    <Button onClick={() => navigate('/member/feed')}>
                      Browse Feed
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                savedPosts.map((post) => {
                  const author = post.author;
                  const authorName = author ? `${author.first_name} ${author.last_name}` : 'Unknown User';
                  const authorInitials = author ? `${author.first_name[0]}${author.last_name[0]}` : 'U';
                  
                  return (
                    <Card key={post.id}>
                      <CardContent className="pt-6">
                        {/* Post Header */}
                        <div className="flex items-start gap-3 mb-4">
                          <Avatar 
                            className="w-10 h-10 cursor-pointer"
                            onClick={() => navigate(`/member/profile/${post.user_id}`)}
                          >
                            <AvatarImage src={author?.avatar || undefined} />
                            <AvatarFallback>{authorInitials}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <div>
                                <span 
                                  className="font-semibold cursor-pointer hover:underline"
                                  onClick={() => navigate(`/member/profile/${post.user_id}`)}
                                >
                                  {authorName}
                                </span>
                                <p className="text-sm text-muted-foreground">
                                  {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Post Content */}
                        <p className="whitespace-pre-wrap mb-4">{post.content}</p>

                        {/* Post Media */}
                        {post.image_url && (
                          <div className="overflow-hidden rounded-lg bg-black/5 mb-4">
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
                            className="rounded-lg max-h-96 w-full object-cover mb-4"
                          />
                        )}
                        {post.document_url && (
                          <a
                            href={post.document_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 p-3 bg-muted rounded-lg mb-4 hover:bg-muted/80"
                          >
                            <FileText className="h-5 w-5" />
                            <span className="text-sm">View Document</span>
                          </a>
                        )}

                        {/* Engagement Badge */}
                        <PostEngagementBadge
                          likesCount={post.likes_count}
                          commentsCount={post.comments_count}
                          sharesCount={post.shares_count || 0}
                          repostsCount={post.reposts_count || 0}
                        />

                        <Separator className="my-4" />

                        {/* Post Actions */}
                        <div className="flex items-center justify-between">
                          <Button
                            variant="ghost"
                            size="sm"
                            className={post.user_liked ? 'text-red-500' : ''}
                            onClick={() => handleLikePost(post.id, post.user_liked)}
                          >
                            <Heart className={`h-4 w-4 mr-2 ${post.user_liked ? 'fill-current' : ''}`} />
                            Like
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleComments(post.id)}
                          >
                            <MessageCircle className="h-4 w-4 mr-2" />
                            Comment
                          </Button>
                          <SharePostDropdown postId={post.id} postContent={post.content} />
                          <BookmarkButton 
                            postId={post.id} 
                            userId={currentUser}
                          />
                        </div>

                        {/* Comments Section */}
                        {showComments.has(post.id) && (
                          <div className="mt-4">
                            <CommentsSection postId={post.id} currentUserId={currentUser} onCommentAdded={loadSavedPosts} />
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </TabsContent>
          )}

          {/* About Tab */}
          <TabsContent value="about" className="space-y-6">
            {/* About */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold">About</h2>
                  {isOwnProfile && (
                    <div className="relative z-10">
                      <EditProfileDialog profile={profile} onSave={loadProfile} />
                    </div>
                  )}
                </div>
                {profile.bio ? (
                  <p className="text-muted-foreground whitespace-pre-wrap">{profile.bio}</p>
                ) : (
                  <p className="text-muted-foreground italic">No description added yet</p>
                )}
              </CardContent>
            </Card>


            {/* Work Experience */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Briefcase className="w-5 h-5" />
                    <h2 className="text-xl font-semibold">Experience</h2>
                  </div>
                  {isOwnProfile && <EditWorkExperienceDialog onSave={loadProfile} />}
                </div>
                {workExperience.length === 0 ? (
                  <p className="text-muted-foreground">No experience added yet</p>
                ) : (
                  <div className="space-y-6">
                    {workExperience.map((exp, index) => (
                      <div key={exp.id}>
                        <div className="flex gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-semibold">{exp.title}</h3>
                              {exp.is_current && (
                                <Badge className="bg-green-500 hover:bg-green-600 text-white text-xs">
                                  Currently Working
                                </Badge>
                              )}
                            </div>
                            <p className="text-muted-foreground">{exp.company}</p>
                            {exp.location && (
                              <p className="text-sm text-muted-foreground">{exp.location}</p>
                            )}
                            <p className="text-sm text-muted-foreground mt-1">
                              {formatDate(exp.start_date)} - {exp.is_current ? 'Present' : formatDate(exp.end_date)}
                            </p>
                            {exp.description && (
                              <p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">
                                {exp.description}
                              </p>
                            )}
                          </div>
                        </div>
                        {index < workExperience.length - 1 && <Separator className="mt-6" />}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Education */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <GraduationCap className="w-5 h-5" />
                    <h2 className="text-xl font-semibold">Education</h2>
                  </div>
                  {isOwnProfile && <EditEducationDialog onSave={loadProfile} />}
                </div>
                {education.length === 0 ? (
                  <p className="text-muted-foreground">No education added yet</p>
                ) : (
                  <div className="space-y-6">
                    {education.map((edu, index) => (
                      <div key={edu.id}>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="font-semibold">{edu.school}</h3>
                            <p className="text-muted-foreground">
                              {edu.degree}
                              {edu.field_of_study && ` in ${edu.field_of_study}`}
                            </p>
                            {(edu.start_date || edu.end_date) && (
                              <p className="text-sm text-muted-foreground mt-1">
                                {edu.start_date ? formatDate(edu.start_date) : ''} - {edu.end_date ? formatDate(edu.end_date) : ''}
                              </p>
                            )}
                            {edu.description && (
                              <p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">
                                {edu.description}
                              </p>
                            )}
                          </div>
                          {isOwnProfile && (
                            <div className="flex items-center gap-1 ml-2">
                              <EditEducationDialog
                                onSave={loadProfile}
                                education={edu}
                                trigger={
                                  <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <Pencil className="w-4 h-4" />
                                  </Button>
                                }
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={() => handleDeleteEducation(edu.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                        {index < education.length - 1 && <Separator className="mt-6" />}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Skills */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Lightbulb className="w-5 h-5" />
                    <h2 className="text-xl font-semibold">Skills</h2>
                  </div>
                  {isOwnProfile && <EditSkillsDialog onSave={loadProfile} />}
                </div>
                {skills.length === 0 ? (
                  <p className="text-muted-foreground">No skills added yet</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {skills.map((skill) => (
                      <Badge key={skill.id} variant="secondary" className="text-sm py-1.5 px-3">
                        {skill.skill_name}
                        {skill.endorsements_count > 0 && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            {skill.endorsements_count}
                          </span>
                        )}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Certifications */}
            <CertificationsSection 
              certifications={certifications} 
              isOwnProfile={isOwnProfile} 
              onSave={loadProfile}
            />

            {/* Associated Associations */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-4">
                  <Building2 className="w-5 h-5" />
                  <h2 className="text-xl font-semibold">Associated Associations</h2>
                </div>
                {associations.length === 0 ? (
                  <p className="text-muted-foreground">No associations yet</p>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {associations.map((association) => (
                      <Card key={association.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate(`/member/associations/${association.id}`)}>
                        <CardContent className="pt-6">
                          <div className="flex items-start gap-3">
                            {association.logo ? (
                              <img 
                                src={association.logo} 
                                alt={association.name}
                                className="w-12 h-12 rounded-lg object-cover"
                              />
                            ) : (
                              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                                <Building2 className="w-6 h-6 text-primary" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold truncate">{association.name}</h3>
                              {association.description && (
                                <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                                  {association.description}
                                </p>
                              )}
                              {(association.city || association.state) && (
                                <div className="flex items-center gap-1 mt-2 text-sm text-muted-foreground">
                                  <MapPin className="w-3 h-3" />
                                  <span className="truncate">
                                    {association.city}
                                    {association.city && association.state && ', '}
                                    {association.state}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Floating Chat Widget */}
      {!isOwnProfile && connectionStatus === 'connected' && (
        <FloatingChat currentUserId={currentUser} initialChatId={chatId} requestOpen={chatOpen} onOpenChange={setChatOpen} />
      )}
      
      <MobileNavigation />
    </div>
  );
}
