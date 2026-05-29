import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BackButton } from "@/components/BackButton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MentionText } from "@/components/post/MentionText";
import { CommentsSection } from "@/components/member/CommentsSection";
import { SharePostDropdown } from "@/components/post/SharePostDropdown";
import { BookmarkButton } from "@/components/post/BookmarkButton";
import { PostEngagementBadge } from "@/components/post/PostEngagementBadge";
import { FloatingChat } from "@/components/messages/FloatingChat";
import { MobileNavigation } from "@/components/layout/MobileNavigation";
import { UniversalSearch } from "@/components/UniversalSearch";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import {
  Building2,
  MapPin,
  Phone,
  Mail,
  Globe,
  Calendar,
  Facebook,
  Twitter,
  Linkedin,
  Instagram,
  Heart,
  MessageCircle,
  Repeat2,
  FileText,
  Users,
  Building,
} from "lucide-react";

interface Association {
  id: string;
  name: string;
  description: string | null;
  logo: string | null;
  cover_image: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postal_code: string | null;
  contact_phone: string | null;
  contact_email: string;
  website: string | null;
  industry: string | null;
  founded_year: number | null;
  social_links: any;
  keywords: string[] | null;
}

interface Post {
  id: string;
  content: string;
  image_url: string | null;
  video_url: string | null;
  document_url: string | null;
  created_at: string;
  user_id: string;
  likes_count: number;
  comments_count: number;
  shares_count: number;
  reposts_count: number;
  original_post_id: string | null;
  original_author_id: string | null;
  post_context: string | null;
  organization_id: string | null;
  profiles: { first_name: string; last_name: string; avatar: string | null } | null;
  original_author?: { first_name: string; last_name: string; avatar: string | null } | null;
  liked_by_user?: boolean;
}

interface KeyFunctionary {
  id: string;
  name: string;
  designation: string;
  bio: string | null;
  photo: string | null;
  display_order: number;
}

interface CompanyItem {
  id: string;
  name: string;
  logo: string | null;
  industry_type: string | null;
  city: string | null;
  state: string | null;
}

interface MemberItem {
  id: string;
  user_id: string;
  designation: string | null;
  department: string | null;
  profiles: { first_name: string; last_name: string; avatar: string | null } | null;
  companies: { name: string } | null;
}

export default function AssociationProfileView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [association, setAssociation] = useState<Association | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Tabs
  const [activeTab, setActiveTab] = useState<"posts" | "about" | "members" | "companies">("posts");

  // Posts
  const [posts, setPosts] = useState<Post[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [showComments, setShowComments] = useState<Record<string, boolean>>({});
  const [contentFilter, setContentFilter] = useState<"all" | "images" | "videos">("all");
  const [sortBy, setSortBy] = useState<"recent" | "top">("recent");

  // Counts
  const [memberCount, setMemberCount] = useState(0);
  const [companyCount, setCompanyCount] = useState(0);

  // About
  const [functionaries, setFunctionaries] = useState<KeyFunctionary[]>([]);

  // Members & Companies tabs
  const [companies, setCompanies] = useState<CompanyItem[]>([]);
  const [members, setMembers] = useState<MemberItem[]>([]);

  useEffect(() => {
    loadCurrentUser();
  }, []);

  useEffect(() => {
    if (id) {
      loadAssociation();
      loadFunctionaries();
      loadCounts();
    }
  }, [id]);

  useEffect(() => {
    if (id && currentUserId) {
      loadPosts();
    }
  }, [id, currentUserId]);

  useEffect(() => {
    if (activeTab === "companies" && id && companies.length === 0) loadCompanies();
    if (activeTab === "members" && id && members.length === 0) loadMembers();
  }, [activeTab, id]);

  const loadCurrentUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
    if (user) setCurrentUserId(user.id);
  };

  const loadAssociation = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("associations")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      setAssociation(data);
    } catch (error: any) {
      toast.error("Failed to load association");
    } finally {
      setLoading(false);
    }
  };

  const loadCounts = async () => {
    try {
      const { count: cCount } = await supabase
        .from("companies")
        .select("*", { count: "exact", head: true })
        .eq("association_id", id!)
        .eq("is_active", true);
      setCompanyCount(cCount || 0);

      const { data: companyIds } = await supabase
        .from("companies")
        .select("id")
        .eq("association_id", id!)
        .eq("is_active", true);

      if (companyIds && companyIds.length > 0) {
        const { count: mCount } = await supabase
          .from("members")
          .select("*", { count: "exact", head: true })
          .in("company_id", companyIds.map((c) => c.id))
          .eq("is_active", true);
        setMemberCount(mCount || 0);
      }
    } catch (e) {
      console.error("Error loading counts:", e);
    }
  };

  const loadFunctionaries = async () => {
    try {
      const { data } = await supabase
        .from("key_functionaries")
        .select("id, name, designation, bio, photo, display_order")
        .eq("association_id", id!)
        .eq("is_active", true)
        .order("display_order");
      setFunctionaries(data || []);
    } catch (e) {
      console.error("Error loading functionaries:", e);
    }
  };

  const loadPosts = async () => {
    try {
      setPostsLoading(true);
      const { data: postsData, error } = await supabase
        .from("posts")
        .select("*")
        .eq("post_context", "association")
        .eq("organization_id", id!)
        .order("created_at", { ascending: false });

      if (error) throw error;
      if (!postsData || postsData.length === 0) {
        setPosts([]);
        return;
      }

      const userIds = Array.from(new Set([
        ...postsData.map((p: any) => p.user_id),
        ...postsData.map((p: any) => p.original_author_id).filter(Boolean),
      ]));

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, avatar")
        .in("id", userIds);

      const profilesById = (profiles || []).reduce((acc: any, p: any) => {
        acc[p.id] = p;
        return acc;
      }, {});

      // Batch fetch likes for current user
      const postIds = postsData.map((p: any) => p.id);
      const { data: likesData } = await supabase
        .from("post_likes")
        .select("post_id")
        .eq("user_id", currentUserId!)
        .in("post_id", postIds);

      const likedPostIds = new Set(likesData?.map((l: any) => l.post_id) || []);

      const enriched = postsData.map((post: any) => ({
        ...post,
        profiles: profilesById[post.user_id] || null,
        original_author: post.original_author_id ? profilesById[post.original_author_id] : null,
        liked_by_user: likedPostIds.has(post.id),
      }));

      setPosts(enriched);
    } catch (e) {
      console.error("Error loading posts:", e);
    } finally {
      setPostsLoading(false);
    }
  };

  const loadCompanies = async () => {
    try {
      const { data } = await supabase
        .from("companies")
        .select("id, name, logo, industry_type, city, state")
        .eq("association_id", id!)
        .eq("is_active", true)
        .eq("is_default", false)
        .order("name");
      setCompanies(data || []);
    } catch (e) {
      console.error("Error loading companies:", e);
    }
  };

  const loadMembers = async () => {
    try {
      const { data: companyIds } = await supabase
        .from("companies")
        .select("id")
        .eq("association_id", id!)
        .eq("is_active", true);

      if (!companyIds || companyIds.length === 0) return;

      const { data } = await supabase
        .from("members")
        .select("id, user_id, designation, department, profiles(first_name, last_name, avatar), companies(name)")
        .in("company_id", companyIds.map((c) => c.id))
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      setMembers((data as any) || []);
    } catch (e) {
      console.error("Error loading members:", e);
    }
  };

  const handleLike = async (postId: string, isLiked: boolean) => {
    if (!currentUserId) return;
    try {
      if (isLiked) {
        await supabase.from("post_likes").delete().eq("post_id", postId).eq("user_id", currentUserId);
        const post = posts.find((p) => p.id === postId);
        if (post) await supabase.from("posts").update({ likes_count: Math.max(0, post.likes_count - 1) }).eq("id", postId);
      } else {
        await supabase.from("post_likes").insert([{ post_id: postId, user_id: currentUserId }]);
        const post = posts.find((p) => p.id === postId);
        if (post) await supabase.from("posts").update({ likes_count: post.likes_count + 1 }).eq("id", postId);
      }
      loadPosts();
    } catch (e) {
      toast.error("Failed to update like");
    }
  };

  const handleRepost = async (post: Post) => {
    if (!currentUserId) return;
    if (post.user_id === currentUserId) {
      toast.error("You cannot repost your own post");
      return;
    }
    try {
      await supabase.from("posts").insert([{
        content: post.content,
        image_url: post.image_url,
        user_id: currentUserId,
        original_post_id: post.original_post_id || post.id,
        original_author_id: post.original_author_id || post.user_id,
      }]);
      toast.success("Post reposted successfully");
      loadPosts();
    } catch (e) {
      toast.error("Failed to repost");
    }
  };

  const filteredPosts = posts
    .filter((p) => {
      if (contentFilter === "images" && !p.image_url) return false;
      if (contentFilter === "videos" && !p.video_url) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "top") return (b.likes_count + b.comments_count) - (a.likes_count + a.comments_count);
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading association...</p>
      </div>
    );
  }

  if (!association) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Association not found</p>
          <Button onClick={() => navigate("/member/browse-associations")}>Back to Associations</Button>
        </div>
      </div>
    );
  }

  const socialLinks = association.social_links || {};

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-10 shadow-sm">
        <div className="container mx-auto pl-14 md:pl-20 lg:pl-24">
          <div className="flex items-center justify-between h-14 gap-3">
            <div className="flex items-center gap-3 flex-shrink-0">
              <BackButton fallbackPath="/dashboard" variant="ghost" size="icon" label="" />
            </div>
            <div className="flex-1 max-w-md">
              <UniversalSearch />
            </div>
            <div className="w-10" />
          </div>
        </div>
      </header>

      <main className="container mx-auto py-4 md:py-6 pl-14 md:pl-20 lg:pl-24 pr-4 max-w-3xl overflow-x-hidden">
        {/* Profile Header Card */}
        <Card className="mb-6 overflow-hidden">
          {/* Cover Banner */}
          <div className="h-[128px] md:h-[200px] relative overflow-hidden">
            {association.cover_image ? (
              <img src={association.cover_image} alt="Cover" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-r from-primary/20 via-primary/30 to-primary/20" />
            )}
          </div>

          {/* Logo and Info */}
          <div className="relative px-6 pb-6 pt-4">
            <div className="absolute -top-12 md:-top-16 left-6">
              <Avatar className="w-24 h-24 md:w-32 md:h-32 border-4 border-background shadow-lg">
                <AvatarImage src={association.logo || undefined} />
                <AvatarFallback className="text-2xl md:text-3xl bg-primary text-primary-foreground">
                  {association.name?.[0]}
                </AvatarFallback>
              </Avatar>
            </div>

            <div className="flex flex-col md:flex-row md:items-start gap-4 pt-14 md:pt-0 md:pl-36 lg:pl-40">
              <div className="flex-1">
                <h1 className="text-2xl md:text-3xl font-bold">{association.name}</h1>
                <p className="text-muted-foreground">{association.industry || "Association"}</p>
                <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground flex-wrap">
                  {association.city && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {association.city}{association.state ? `, ${association.state}` : ""}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Building2 className="w-3 h-3" />
                    {companyCount} companies
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {memberCount} members
                  </span>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Tab Navigation */}
        <div className="mb-4">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
            <TabsList className="bg-muted/50 w-full justify-start">
              <TabsTrigger value="posts" className="flex-1 md:flex-none">Posts</TabsTrigger>
              <TabsTrigger value="about" className="flex-1 md:flex-none">About</TabsTrigger>
              <TabsTrigger value="members" className="flex-1 md:flex-none">Members</TabsTrigger>
              <TabsTrigger value="companies" className="flex-1 md:flex-none">Companies</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Posts Tab */}
        {activeTab === "posts" && (
          <>
            {/* Content Filters */}
            <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
              <div className="flex gap-2">
                {(["all", "images", "videos"] as const).map((f) => (
                  <Badge
                    key={f}
                    variant={contentFilter === f ? "default" : "outline"}
                    className="cursor-pointer hover:bg-primary/80 capitalize"
                    onClick={() => setContentFilter(f)}
                  >
                    {f}
                  </Badge>
                ))}
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

            {postsLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading posts...</div>
            ) : filteredPosts.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No posts yet from this association.
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                {filteredPosts.map((post) => (
                  <Card key={post.id}>
                    <CardContent className="pt-6">
                      {/* Engagement badge */}
                      <div className="flex items-center justify-between mb-3">
                        <div />
                        <PostEngagementBadge
                          likesCount={post.likes_count || 0}
                          commentsCount={post.comments_count || 0}
                          sharesCount={post.shares_count || 0}
                          repostsCount={post.reposts_count || 0}
                        />
                      </div>
                      <div className="flex items-start gap-4 mb-4">
                        <Avatar>
                          <AvatarImage src={association.logo || undefined} />
                          <AvatarFallback>{association.name?.[0]}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold">{association.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                          </p>
                          <MentionText text={post.content} className="mt-3" />
                          {post.image_url && (
                            <div className="mt-3 overflow-hidden rounded-lg bg-black/5">
                              <img src={post.image_url} alt="Post" className="w-full object-cover" style={{ maxHeight: '516px' }} />
                            </div>
                          )}
                          {post.video_url && (
                            <video src={post.video_url} controls className="mt-3 rounded-lg max-h-96 w-full max-w-full" />
                          )}
                          {post.document_url && (
                            <a href={post.document_url} target="_blank" rel="noopener noreferrer" className="mt-3 flex items-center gap-2 p-3 bg-muted rounded-lg hover:bg-muted/80 transition-colors">
                              <FileText className="w-5 h-5 text-primary" />
                              <span className="text-sm font-medium">View Document</span>
                            </a>
                          )}
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1 sm:gap-4 pt-4 border-t flex-wrap">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleLike(post.id, post.liked_by_user || false)}
                          className={`px-2 sm:px-3 ${post.liked_by_user ? "text-red-500" : ""}`}
                        >
                          <Heart className={`w-4 h-4 sm:mr-1 ${post.liked_by_user ? "fill-current" : ""}`} />
                          <span className="text-xs ml-1">{post.likes_count > 0 && post.likes_count}</span>
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setShowComments((p) => ({ ...p, [post.id]: !p[post.id] }))} className="px-2 sm:px-3">
                          <MessageCircle className="w-4 h-4 sm:mr-1" />
                          <span className="text-xs ml-1">{post.comments_count > 0 && post.comments_count}</span>
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleRepost(post)} className="px-2 sm:px-3">
                          <Repeat2 className="w-4 h-4 sm:mr-1" />
                          <span className="text-xs ml-1">{post.reposts_count > 0 && post.reposts_count}</span>
                        </Button>
                        <SharePostDropdown postId={post.id} postContent={post.content} sharesCount={post.shares_count || 0} onShareComplete={loadPosts} />
                        <BookmarkButton postId={post.id} userId={currentUserId} />
                      </div>

                      {showComments[post.id] && (
                        <div className="mt-4 pt-4 border-t">
                          <CommentsSection postId={post.id} currentUserId={currentUserId} onCommentAdded={loadPosts} />
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}

        {/* About Tab */}
        {activeTab === "about" && (
          <div className="space-y-6">
            {association.description && (
              <Card>
                <CardHeader><CardTitle className="text-xl">About</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{association.description}</p>
                </CardContent>
              </Card>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader><CardTitle className="text-xl">Contact</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  {association.contact_email && (
                    <div className="flex items-center gap-3">
                      <Mail className="h-5 w-5 text-muted-foreground" />
                      <a href={`mailto:${association.contact_email}`} className="hover:underline">{association.contact_email}</a>
                    </div>
                  )}
                  {association.contact_phone && (
                    <div className="flex items-center gap-3">
                      <Phone className="h-5 w-5 text-muted-foreground" />
                      <a href={`tel:${association.contact_phone}`} className="hover:underline">{association.contact_phone}</a>
                    </div>
                  )}
                  {association.website && (
                    <div className="flex items-center gap-3">
                      <Globe className="h-5 w-5 text-muted-foreground" />
                      <a href={association.website} target="_blank" rel="noopener noreferrer" className="hover:underline">{association.website}</a>
                    </div>
                  )}
                  {(association.address || association.city) && (
                    <div className="flex items-start gap-3">
                      <MapPin className="h-5 w-5 text-muted-foreground mt-1" />
                      <div>
                        {association.address && <p>{association.address}</p>}
                        <p>{[association.city, association.state, association.postal_code].filter(Boolean).join(", ")}</p>
                        {association.country && <p>{association.country}</p>}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-xl">Details</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  {association.founded_year && (
                    <div className="flex items-center gap-3">
                      <Calendar className="h-5 w-5 text-muted-foreground" />
                      <span>Founded {association.founded_year}</span>
                    </div>
                  )}
                  {association.keywords && association.keywords.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {association.keywords.map((kw, i) => <Badge key={i} variant="secondary">{kw}</Badge>)}
                    </div>
                  )}
                  {(socialLinks.facebook || socialLinks.twitter || socialLinks.linkedin || socialLinks.instagram) && (
                    <div>
                      <p className="text-sm font-medium mb-3">Social Media</p>
                      <div className="flex gap-3">
                        {socialLinks.facebook && <a href={socialLinks.facebook} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary"><Facebook className="h-5 w-5" /></a>}
                        {socialLinks.twitter && <a href={socialLinks.twitter} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary"><Twitter className="h-5 w-5" /></a>}
                        {socialLinks.linkedin && <a href={socialLinks.linkedin} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary"><Linkedin className="h-5 w-5" /></a>}
                        {socialLinks.instagram && <a href={socialLinks.instagram} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary"><Instagram className="h-5 w-5" /></a>}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {functionaries.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-xl">Key Functionaries</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {functionaries.map((f) => (
                      <div key={f.id} className="flex items-start gap-4">
                        {f.photo ? (
                          <img src={f.photo} alt={f.name} className="w-16 h-16 rounded-full object-cover" />
                        ) : (
                          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                            <span className="text-lg font-semibold text-primary">{f.name.charAt(0)}</span>
                          </div>
                        )}
                        <div>
                          <h4 className="font-semibold">{f.name}</h4>
                          <p className="text-sm text-muted-foreground">{f.designation}</p>
                          {f.bio && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{f.bio}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Members Tab */}
        {activeTab === "members" && (
          <Card>
            <CardHeader><CardTitle className="text-xl">Members ({memberCount})</CardTitle></CardHeader>
            <CardContent>
              {members.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">No members found.</p>
              ) : (
                <div className="space-y-4">
                  {members.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => navigate(`/profile/${m.user_id}`)}
                    >
                      <Avatar>
                        <AvatarImage src={m.profiles?.avatar || undefined} />
                        <AvatarFallback>
                          {m.profiles?.first_name?.[0]}{m.profiles?.last_name?.[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{m.profiles?.first_name} {m.profiles?.last_name}</p>
                        <p className="text-sm text-muted-foreground truncate">
                          {[m.designation, m.companies?.name].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Companies Tab */}
        {activeTab === "companies" && (
          <Card>
            <CardHeader><CardTitle className="text-xl">Companies ({companyCount})</CardTitle></CardHeader>
            <CardContent>
              {companies.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">No companies found.</p>
              ) : (
                <div className="space-y-4">
                  {companies.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => navigate(`/member/company/${c.id}`)}
                    >
                      {c.logo ? (
                        <img src={c.logo} alt={c.name} className="w-12 h-12 rounded-lg object-cover" />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Building className="h-6 w-6 text-primary" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{c.name}</p>
                        <p className="text-sm text-muted-foreground truncate">
                          {[c.industry_type, c.city, c.state].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </main>

      <FloatingChat currentUserId={currentUserId} />
      <MobileNavigation />
    </div>
  );
}
