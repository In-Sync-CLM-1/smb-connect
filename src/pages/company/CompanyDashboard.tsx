import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, Users, MessageSquare, LogOut, Settings, Radio, GraduationCap, CheckCircle2, Clock, TrendingUp, Upload, UserPlus, Mail, BarChart3, Link2, FileText, TicketPercent } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useUserRole } from '@/hooks/useUserRole';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { RoleNavigation } from '@/components/RoleNavigation';
import { useRoleContext } from '@/contexts/RoleContext';
import { PageHeader } from '@/components/layout/PageHeader';
import { InviteLinkDialog } from '@/components/InviteLinkDialog';

export default function CompanyDashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { userData } = useUserRole();
  const { setRole } = useRoleContext();
  const [company, setCompany] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [stats, setStats] = useState({
    totalMembers: 0,
    newMembers1Day: 0,
    newMembers7Days: 0,
    newMembers30Days: 0,
    onboardingTotal: 0,
    onboardingCompleted: 0,
    onboardingInProgress: 0,
    onboardingCompletionRate: 0,
  });
  const [loading, setLoading] = useState(true);
  const [inviteLinkDialogOpen, setInviteLinkDialogOpen] = useState(false);

  useEffect(() => {
    loadProfile();
    if (userData?.company) {
      setCompany(userData.company);
      setRole('company', undefined, userData.company.id);
      console.log('RoleContext updated with company:', userData.company.id);
      loadStats(userData.company.id);
    }
  }, [userData]);

  const loadProfile = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return;

      setCurrentUserId(user.id);

      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (profileData) {
        setProfile(profileData);
      }
    } catch (error: any) {
      console.error('Error loading profile:', error);
    }
  };

  const loadStats = async (companyId: string) => {
    try {
      const [
        { count: membersCount },
        { count: new1Day },
        { count: new7Days },
        { count: new30Days },
      ] = await Promise.all([
        supabase
          .from('members')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', companyId)
          .eq('is_active', true),
        supabase
          .from('members')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', companyId)
          .eq('is_active', true)
          .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
        supabase
          .from('members')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', companyId)
          .eq('is_active', true)
          .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
        supabase
          .from('members')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', companyId)
          .eq('is_active', true)
          .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
      ]);

      // Load onboarding stats for company members
      const { data: memberUserIds } = await supabase
        .from('members')
        .select('user_id')
        .eq('company_id', companyId)
        .eq('is_active', true);

      const userIds = memberUserIds?.map(m => m.user_id) || [];
      
      const [
        { count: onboardingTotal },
        { count: onboardingCompleted },
      ] = await Promise.all([
        supabase
          .from('user_onboarding')
          .select('*', { count: 'exact', head: true })
          .in('user_id', userIds.length > 0 ? userIds : ['']),
        supabase
          .from('user_onboarding')
          .select('*', { count: 'exact', head: true })
          .in('user_id', userIds.length > 0 ? userIds : [''])
          .eq('is_completed', true),
      ]);

      const onboardingInProgress = (onboardingTotal || 0) - (onboardingCompleted || 0);
      const onboardingCompletionRate = onboardingTotal && onboardingTotal > 0
        ? Math.round((onboardingCompleted || 0) / onboardingTotal * 100)
        : 0;

      setStats({
        totalMembers: membersCount || 0,
        newMembers1Day: new1Day || 0,
        newMembers7Days: new7Days || 0,
        newMembers30Days: new30Days || 0,
        onboardingTotal: onboardingTotal || 0,
        onboardingCompleted: onboardingCompleted || 0,
        onboardingInProgress,
        onboardingCompletionRate,
      });
    } catch (error: any) {
      console.error('Error loading stats:', error);
      toast({
        title: 'Error',
        description: 'Failed to load dashboard statistics',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
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
    <div className="min-h-screen bg-background">
      <PageHeader title="Company Dashboard" description={company?.name || 'Loading...'}>
        <div className="flex items-center gap-3 ml-auto">
          {profile && currentUserId && (
            <Avatar 
              className="cursor-pointer hover:ring-2 hover:ring-primary transition-all" 
              onClick={() => navigate(`/profile/${currentUserId}`)}
            >
              <AvatarImage src={profile.avatar || undefined} />
              <AvatarFallback>
                {profile.first_name?.[0]}{profile.last_name?.[0]}
              </AvatarFallback>
            </Avatar>
          )}
          <Button variant="outline" onClick={() => navigate('/account-settings')}>
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </Button>
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </PageHeader>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 pl-28">
        <RoleNavigation />
        
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-2">
            Welcome, Company {userData?.role === 'owner' ? 'Owner' : 'Admin'}!
          </h2>
          <p className="text-muted-foreground">
            Manage your company profile and team members
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card 
            className="cursor-pointer hover:shadow-lg transition-shadow" 
            onClick={() => navigate('/company/members')}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Team Members</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-8 w-16 animate-pulse bg-muted rounded"></div>
              ) : (
                <>
                  <div className="text-2xl font-bold">{stats.totalMembers}</div>
                  <p className="text-xs text-muted-foreground">
                    +{stats.newMembers1Day} today, +{stats.newMembers7Days} this week, +{stats.newMembers30Days} this month
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Connections</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
              <p className="text-xs text-muted-foreground">Partner companies</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Messages</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
              <p className="text-xs text-muted-foreground">Unread messages</p>
            </CardContent>
          </Card>
        </div>

        {/* Onboarding Stats Section */}
        <Card className="border-none shadow-lg mb-8" data-tour="company-profile">
          <CardHeader>
            <div className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-primary" />
              <CardTitle>Team Onboarding Analytics</CardTitle>
            </div>
            <CardDescription>Track how your team members are completing onboarding</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="h-20 animate-pulse bg-muted rounded"></div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <span className="text-sm">Total Members</span>
                  </div>
                  <div className="text-3xl font-bold">{stats.onboardingTotal}</div>
                  <p className="text-xs text-muted-foreground">Started onboarding</p>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span className="text-sm">Completed</span>
                  </div>
                  <div className="text-3xl font-bold text-green-600">{stats.onboardingCompleted}</div>
                  <p className="text-xs text-muted-foreground">Finished onboarding</p>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-4 w-4 text-orange-600" />
                    <span className="text-sm">In Progress</span>
                  </div>
                  <div className="text-3xl font-bold text-orange-600">{stats.onboardingInProgress}</div>
                  <p className="text-xs text-muted-foreground">Currently onboarding</p>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <TrendingUp className="h-4 w-4 text-blue-600" />
                    <span className="text-sm">Completion Rate</span>
                  </div>
                  <div className="text-3xl font-bold text-blue-600">{stats.onboardingCompletionRate}%</div>
                  <p className="text-xs text-muted-foreground">Overall completion</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Company Management</CardTitle>
            <CardDescription>Manage your company and team</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Button className="w-full" onClick={() => navigate('/company/feed')}>
                <Radio className="w-4 h-4 mr-2" />
                Company Feed
              </Button>
              <Button variant="outline" className="w-full" onClick={() => navigate('/company/members')}>
                <Users className="w-4 h-4 mr-2" />
                Manage Members
              </Button>
              <Button variant="outline" className="w-full" onClick={() => navigate('/company/manage-invitations')}>
                <UserPlus className="w-4 h-4 mr-2" />
                Member Invitations
              </Button>
              <Button variant="outline" className="w-full" onClick={() => navigate('/company/profile')}>
                <Building2 className="w-4 h-4 mr-2" />
                Company Profile
              </Button>
              <Button variant="outline" className="w-full" onClick={() => navigate('/company/email-lists')}>
                <Mail className="w-4 h-4 mr-2" />
                Bulk Email
              </Button>
              <Button variant="outline" className="w-full" onClick={() => navigate('/company/email-analytics')}>
                <BarChart3 className="w-4 h-4 mr-2" />
                Email Analytics
              </Button>
              <Button variant="outline" className="w-full" onClick={() => navigate('/company/event-landing-pages')}>
                <FileText className="w-4 h-4 mr-2" />
                Event Landing Pages
              </Button>
              <Button variant="outline" className="w-full" onClick={() => navigate('/company/coupons')}>
                <TicketPercent className="w-4 h-4 mr-2" />
                Coupon Management
              </Button>
              <Button variant="outline" className="w-full" onClick={() => navigate('/company/settings')}>
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </Button>
              <Button className="w-full" onClick={() => setInviteLinkDialogOpen(true)} disabled={!company}>
                <Link2 className="w-4 h-4 mr-2" />
                Invite
              </Button>
            </div>
          </CardContent>
        </Card>

        {company && (
          <InviteLinkDialog
            open={inviteLinkDialogOpen}
            onOpenChange={setInviteLinkDialogOpen}
            organizationId={company.id}
            organizationType="company"
            organizationName={company.name}
          />
        )}

        {/* Bulk Upload Section */}
        <Card>
          <CardHeader>
            <CardTitle>Bulk Upload</CardTitle>
            <CardDescription>Upload team members using CSV file</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full" onClick={() => navigate('/company/bulk-upload-users')}>
              <Upload className="w-4 h-4 mr-2" />
              Bulk Upload Users
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
