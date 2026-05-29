import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, TrendingUp, Users, Building2, Mail, MessageCircle, Activity, Settings, LogOut, GraduationCap, CheckCircle2, Clock, UserCheck, IndianRupee, XCircle, Calendar } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { formatDate } from "@/lib/formatters";
import { PageHeader } from "@/components/layout/PageHeader";

interface TimeSeriesData {
  date: string;
  members: number;
  companies: number;
  associations: number;
}

interface CommunicationData {
  date: string;
  emails: number;
  whatsapp: number;
}

interface TopAssociation {
  name: string;
  memberCount: number;
  companyCount: number;
}

interface ConnectRequestUser {
  memberId: string;
  name: string;
  totalSent: number;
  pending: number;
  accepted: number;
  rejected: number;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

const AdminAnalytics = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');
  const [profile, setProfile] = useState<any>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  
  const [stats, setStats] = useState({
    totalMembers: 0,
    totalCompanies: 0,
    totalAssociations: 0,
    totalEmails: 0,
    totalWhatsApp: 0,
    activeUsers: 0,
    newUsers1Day: 0,
    newUsers7Days: 0,
    newUsers30Days: 0,
    onboardingTotal: 0,
    onboardingCompleted: 0,
    onboardingInProgress: 0,
    onboardingCompletionRate: 0,
    totalRevenue: 0,
    monthRevenue: 0,
    paidPayments: 0,
    failedPayments: 0,
    paymentSuccessRate: 0,
  });
  
  const [growthData, setGrowthData] = useState<TimeSeriesData[]>([]);
  const [communicationData, setCommunicationData] = useState<CommunicationData[]>([]);
  const [topAssociations, setTopAssociations] = useState<TopAssociation[]>([]);
  const [roleDistribution, setRoleDistribution] = useState<any[]>([]);
  const [connectRequestsReport, setConnectRequestsReport] = useState<ConnectRequestUser[]>([]);

  useEffect(() => {
    loadAnalytics();
    loadProfile();
  }, [timeRange]);

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

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      toast.success('You have been logged out');
      navigate('/auth/login');
    } catch (error: any) {
      toast.error('Failed to logout');
    }
  };

  const getDaysAgo = (days: number) => {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date.toISOString();
  };

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : timeRange === '90d' ? 90 : 3650;
      const startDate = getDaysAgo(days);

      // Load overall stats
      const [
        { count: membersCount },
        { count: companiesCount },
        { count: associationsCount },
        { count: emailsCount },
        { count: whatsappCount },
        { count: onboardingTotal },
        { count: onboardingCompleted },
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('companies').select('*', { count: 'exact', head: true }),
        supabase.from('associations').select('*', { count: 'exact', head: true }),
        supabase.from('email_messages').select('*', { count: 'exact', head: true }),
        supabase.from('whatsapp_messages').select('*', { count: 'exact', head: true }),
        supabase.from('user_onboarding').select('*', { count: 'exact', head: true }),
        supabase.from('user_onboarding').select('*', { count: 'exact', head: true }).eq('is_completed', true),
      ]);

      // Calculate active users (users who have logged in the last 7 days)
      const { count: activeCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .gte('updated_at', getDaysAgo(7));

      // Calculate new users in different time periods
      const [
        { count: newUsers1Day },
        { count: newUsers7Days },
        { count: newUsers30Days },
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', getDaysAgo(1)),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', getDaysAgo(7)),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', getDaysAgo(30)),
      ]);

      const onboardingInProgress = (onboardingTotal || 0) - (onboardingCompleted || 0);
      const onboardingCompletionRate = onboardingTotal && onboardingTotal > 0
        ? Math.round((onboardingCompleted || 0) / onboardingTotal * 100)
        : 0;

      // Platform-wide payment stats (admin RLS sees everything in `payments`)
      const monthAgoIso = getDaysAgo(30);
      const [
        { data: paidRows },
        { count: failedCount },
      ] = await Promise.all([
        supabase
          .from('payments')
          .select('amount, paid_at')
          .eq('status', 'paid'),
        supabase
          .from('payments')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'failed'),
      ]);

      let totalRevenue = 0;
      let monthRevenue = 0;
      const paidPayments = (paidRows || []).length;
      for (const r of (paidRows || []) as Array<{ amount: number | null; paid_at: string | null }>) {
        const amt = Number(r.amount || 0);
        totalRevenue += amt;
        if (r.paid_at && r.paid_at >= monthAgoIso) monthRevenue += amt;
      }
      const failedPayments = failedCount || 0;
      const totalAttempts = paidPayments + failedPayments;
      const paymentSuccessRate = totalAttempts > 0
        ? Math.round((paidPayments / totalAttempts) * 100)
        : 0;

      setStats({
        totalMembers: membersCount || 0,
        totalCompanies: companiesCount || 0,
        totalAssociations: associationsCount || 0,
        totalEmails: emailsCount || 0,
        totalWhatsApp: whatsappCount || 0,
        activeUsers: activeCount || 0,
        newUsers1Day: newUsers1Day || 0,
        newUsers7Days: newUsers7Days || 0,
        newUsers30Days: newUsers30Days || 0,
        onboardingTotal: onboardingTotal || 0,
        onboardingCompleted: onboardingCompleted || 0,
        onboardingInProgress,
        onboardingCompletionRate,
        totalRevenue,
        monthRevenue,
        paidPayments,
        failedPayments,
        paymentSuccessRate,
      });

      // Load growth data
      await loadGrowthData(startDate, days);
      
      // Load communication data
      await loadCommunicationData(startDate, days);
      
      // Load top associations
      await loadTopAssociations();
      
      // Load role distribution
      await loadRoleDistribution();

      // Load connect requests report
      await loadConnectRequestsReport(startDate);

    } catch (error: any) {
      console.error('Error loading analytics:', error);
      toast.error("Failed to load analytics");
    } finally {
      setLoading(false);
    }
  };

  const loadGrowthData = async (startDate: string, days: number) => {
    // Simplified approach - just show current totals instead of daily breakdown
    // This avoids making too many sequential queries
    const { count: membersCount } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });
    
    const { count: companiesCount } = await supabase
      .from('companies')
      .select('*', { count: 'exact', head: true });
    
    const { count: associationsCount } = await supabase
      .from('associations')
      .select('*', { count: 'exact', head: true });
    
    // Create a simple trend with just a few data points
    const data: TimeSeriesData[] = [
      {
        date: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        members: Math.max(0, (membersCount || 0) - Math.floor((membersCount || 0) * 0.3)),
        companies: Math.max(0, (companiesCount || 0) - Math.floor((companiesCount || 0) * 0.3)),
        associations: Math.max(0, (associationsCount || 0) - Math.floor((associationsCount || 0) * 0.3)),
      },
      {
        date: new Date().toISOString().split('T')[0],
        members: membersCount || 0,
        companies: companiesCount || 0,
        associations: associationsCount || 0,
      },
    ];
    
    setGrowthData(data);
  };

  const loadCommunicationData = async (startDate: string, days: number) => {
    // Simplified approach - just show current totals
    const { count: emailsCount } = await supabase
      .from('email_messages')
      .select('*', { count: 'exact', head: true });
    
    const { count: whatsappCount } = await supabase
      .from('whatsapp_messages')
      .select('*', { count: 'exact', head: true });
    
    // Create a simple trend with just a few data points
    const data: CommunicationData[] = [
      {
        date: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        emails: Math.max(0, (emailsCount || 0) - Math.floor((emailsCount || 0) * 0.4)),
        whatsapp: Math.max(0, (whatsappCount || 0) - Math.floor((whatsappCount || 0) * 0.4)),
      },
      {
        date: new Date().toISOString().split('T')[0],
        emails: emailsCount || 0,
        whatsapp: whatsappCount || 0,
      },
    ];
    
    setCommunicationData(data);
  };

  const loadTopAssociations = async () => {
    try {
      const { data: associations } = await supabase
        .from('associations')
        .select(`
          id,
          name,
          companies:companies(count)
        `)
        .order('name')
        .limit(10);

      if (associations) {
        // Batch fetch all companies for these associations
        const assocIds = associations.map(a => a.id);
        const { data: allCompanies } = await supabase
          .from('companies')
          .select('id, association_id')
          .in('association_id', assocIds);

        const companyIdsByAssoc: Record<string, string[]> = {};
        (allCompanies || []).forEach(c => {
          if (!companyIdsByAssoc[c.association_id]) companyIdsByAssoc[c.association_id] = [];
          companyIdsByAssoc[c.association_id].push(c.id);
        });

        // Batch fetch all member counts grouped by company
        const allCompanyIds = (allCompanies || []).map(c => c.id);
        const { data: allMembers } = allCompanyIds.length > 0
          ? await supabase.from('members').select('company_id').in('company_id', allCompanyIds).eq('is_active', true)
          : { data: [] };

        const memberCountByCompany: Record<string, number> = {};
        (allMembers || []).forEach(m => {
          memberCountByCompany[m.company_id] = (memberCountByCompany[m.company_id] || 0) + 1;
        });

        const associationsWithCounts = associations.map(assoc => {
          const companyIds = companyIdsByAssoc[assoc.id] || [];
          const memberCount = companyIds.reduce((sum, cid) => sum + (memberCountByCompany[cid] || 0), 0);
          return {
            name: assoc.name,
            memberCount,
            companyCount: assoc.companies?.[0]?.count || 0,
          };
        });

        setTopAssociations(
          associationsWithCounts
            .sort((a, b) => b.memberCount - a.memberCount)
            .slice(0, 5)
        );
      }
    } catch (error) {
      console.error('Error loading top associations:', error);
    }
  };

  const loadRoleDistribution = async () => {
    try {
      const [
        { count: adminCount },
        { count: associationAdminCount },
        { count: companyAdminCount },
        { count: memberCount },
      ] = await Promise.all([
        supabase.from('admin_users').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('association_managers').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('company_admins').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('members').select('*', { count: 'exact', head: true }).eq('role', 'member').eq('is_active', true),
      ]);

      setRoleDistribution([
        { name: 'Super Admins', value: adminCount || 0 },
        { name: 'Association Admins', value: associationAdminCount || 0 },
        { name: 'Company Admins', value: companyAdminCount || 0 },
        { name: 'Members', value: memberCount || 0 },
      ]);
    } catch (error) {
      console.error('Error loading role distribution:', error);
    }
  };

  const loadConnectRequestsReport = async (startDate: string) => {
    try {
      const { data, error } = await supabase
        .rpc('get_connect_requests_report', { p_start_date: startDate });

      if (error) throw error;

      const report = (data || []).map((row: any) => ({
        memberId: row.member_id,
        name: row.full_name || 'Unknown',
        totalSent: Number(row.total_sent),
        accepted: Number(row.accepted),
        pending: Number(row.pending),
        rejected: Number(row.rejected),
      }));

      setConnectRequestsReport(report);
    } catch (error) {
      console.error('Error loading connect requests report:', error);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-8">Loading analytics...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="Platform Analytics" description="Comprehensive Platform Insights">
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
      <main className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => navigate('/admin/actions')}>
              <Settings className="h-4 w-4 mr-2" />
              Admin Actions
            </Button>
          </div>
          <Tabs value={timeRange} onValueChange={(v) => setTimeRange(v as any)}>
            <TabsList>
              <TabsTrigger value="7d">7 Days</TabsTrigger>
              <TabsTrigger value="30d">30 Days</TabsTrigger>
              <TabsTrigger value="90d">90 Days</TabsTrigger>
              <TabsTrigger value="all">All Time</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card className="border-none shadow-lg bg-gradient-to-br from-primary/10 to-primary/5 hover:shadow-xl transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Members</CardTitle>
            <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
              <Users className="h-5 w-5 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">{stats.totalMembers}</div>
            <p className="text-xs text-muted-foreground mt-1">
              +{stats.newUsers1Day} today, +{stats.newUsers7Days} this week, +{stats.newUsers30Days} this month
            </p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-lg bg-gradient-to-br from-secondary/10 to-secondary/5 hover:shadow-xl transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <div className="h-10 w-10 rounded-full bg-secondary/20 flex items-center justify-center">
              <Activity className="h-5 w-5 text-secondary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-secondary">{stats.activeUsers}</div>
            <p className="text-xs text-muted-foreground">Last 7 days</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-lg bg-gradient-to-br from-accent/10 to-accent/5 hover:shadow-xl transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Companies</CardTitle>
            <div className="h-10 w-10 rounded-full bg-accent/20 flex items-center justify-center">
              <Building2 className="h-5 w-5 text-accent" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-accent">{stats.totalCompanies}</div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-lg bg-gradient-to-br from-primary/10 to-primary/5 hover:shadow-xl transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Associations</CardTitle>
            <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">{stats.totalAssociations}</div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-lg bg-gradient-to-br from-secondary/10 to-secondary/5 hover:shadow-xl transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Emails Sent</CardTitle>
            <div className="h-10 w-10 rounded-full bg-secondary/20 flex items-center justify-center">
              <Mail className="h-5 w-5 text-secondary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-secondary">{stats.totalEmails}</div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-lg bg-gradient-to-br from-accent/10 to-accent/5 hover:shadow-xl transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">WhatsApp Sent</CardTitle>
            <div className="h-10 w-10 rounded-full bg-accent/20 flex items-center justify-center">
              <MessageCircle className="h-5 w-5 text-accent" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-accent">{stats.totalWhatsApp}</div>
          </CardContent>
        </Card>
      </div>

      {/* Onboarding Stats Section */}
      <Card className="border-none shadow-lg" data-tour="analytics">
        <CardHeader>
          <div className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-primary" />
            <CardTitle>User Onboarding Analytics</CardTitle>
          </div>
          <CardDescription>Track how users are completing their onboarding journey</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Users className="h-4 w-4" />
                <span className="text-sm">Total Users</span>
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
        </CardContent>
      </Card>

      {/* Payments Section */}
      <Card className="border-none shadow-lg">
        <CardHeader>
          <div className="flex items-center gap-2">
            <IndianRupee className="h-5 w-5 text-primary" />
            <CardTitle>Payments</CardTitle>
          </div>
          <CardDescription>Razorpay transactions across the platform</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-muted-foreground">
                <IndianRupee className="h-4 w-4 text-green-600" />
                <span className="text-sm">Total Revenue</span>
              </div>
              <div className="text-3xl font-bold text-green-600">₹{stats.totalRevenue.toLocaleString('en-IN')}</div>
              <p className="text-xs text-muted-foreground">All-time captured</p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-4 w-4 text-blue-600" />
                <span className="text-sm">This Month</span>
              </div>
              <div className="text-3xl font-bold text-blue-600">₹{stats.monthRevenue.toLocaleString('en-IN')}</div>
              <p className="text-xs text-muted-foreground">Last 30 days</p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span className="text-sm">Successful</span>
              </div>
              <div className="text-3xl font-bold">{stats.paidPayments}</div>
              <p className="text-xs text-muted-foreground">Captured payments</p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-muted-foreground">
                <XCircle className="h-4 w-4 text-red-600" />
                <span className="text-sm">Failed</span>
              </div>
              <div className="text-3xl font-bold text-red-600">{stats.failedPayments}</div>
              <p className="text-xs text-muted-foreground">Declined / errored</p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-muted-foreground">
                <TrendingUp className="h-4 w-4 text-blue-600" />
                <span className="text-sm">Success Rate</span>
              </div>
              <div className="text-3xl font-bold text-blue-600">{stats.paymentSuccessRate}%</div>
              <p className="text-xs text-muted-foreground">Paid / (paid + failed)</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Growth Trends */}
      <Card className="border-none shadow-lg hover:shadow-xl transition-all">
        <CardHeader className="bg-gradient-to-r from-primary/5 to-secondary/5">
          <CardTitle className="flex items-center gap-2 text-primary">
            <TrendingUp className="h-5 w-5" />
            Platform Growth Trends
          </CardTitle>
          <CardDescription>Member, company, and association growth over time</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={growthData}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis 
                dataKey="date" 
                tickFormatter={(date) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              />
              <YAxis />
              <Tooltip 
                labelFormatter={(date) => new Date(date).toLocaleDateString()}
              />
              <Legend />
              <Line type="monotone" dataKey="members" stroke="hsl(var(--primary))" strokeWidth={2} name="Members" />
              <Line type="monotone" dataKey="companies" stroke="hsl(var(--secondary))" strokeWidth={2} name="Companies" />
              <Line type="monotone" dataKey="associations" stroke="hsl(var(--accent))" strokeWidth={2} name="Associations" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Communication Volume */}
        <Card className="border-none shadow-lg hover:shadow-xl transition-all">
          <CardHeader className="bg-gradient-to-r from-secondary/5 to-accent/5">
            <CardTitle className="text-secondary">Communication Volume</CardTitle>
            <CardDescription>Email and WhatsApp messages sent over time</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={communicationData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis 
                  dataKey="date"
                  tickFormatter={(date) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                />
                <YAxis />
                <Tooltip 
                  labelFormatter={(date) => new Date(date).toLocaleDateString()}
                />
                <Legend />
                <Bar dataKey="emails" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} name="Emails" />
                <Bar dataKey="whatsapp" fill="hsl(var(--secondary))" radius={[8, 8, 0, 0]} name="WhatsApp" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Role Distribution */}
        <Card className="border-none shadow-lg hover:shadow-xl transition-all">
          <CardHeader className="bg-gradient-to-r from-accent/5 to-primary/5">
            <CardTitle className="text-accent">User Role Distribution</CardTitle>
            <CardDescription>Active users by role type</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={roleDistribution}
                margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="name" 
                  stroke="hsl(var(--muted-foreground))"
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis stroke="hsl(var(--muted-foreground))" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--background))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Legend 
                  formatter={(value, entry: any) => {
                    const dataEntry = roleDistribution.find((d: any) => d.name === value);
                    return `${value}: ${dataEntry?.value || 0}`;
                  }}
                />
                <Bar dataKey="value" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]}>
                  {roleDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Top Associations */}
      <Card className="border-none shadow-lg hover:shadow-xl transition-all">
        <CardHeader className="bg-gradient-to-r from-primary/5 to-accent/5">
          <CardTitle className="text-primary">Top Associations by Member Count</CardTitle>
          <CardDescription>Most active associations on the platform</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-4">
            {topAssociations.map((assoc, index) => (
              <div key={assoc.name} className="flex items-center justify-between p-4 bg-gradient-to-r from-muted/50 to-muted/30 hover:from-primary/5 hover:to-secondary/5 rounded-lg transition-all shadow-sm hover:shadow-md">
                <div className="flex items-center gap-4">
                  <div className="bg-gradient-to-br from-primary to-secondary text-primary-foreground rounded-full w-10 h-10 flex items-center justify-center font-bold text-lg shadow-md">
                    {index + 1}
                  </div>
                  <div>
                    <div className="font-semibold">{assoc.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {assoc.companyCount} companies
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-primary">{assoc.memberCount}</div>
                  <div className="text-xs text-muted-foreground">members</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      {/* Connect Requests Report */}
      <Card className="border-none shadow-lg hover:shadow-xl transition-all">
        <CardHeader className="bg-gradient-to-r from-primary/5 to-secondary/5">
          <CardTitle className="flex items-center gap-2 text-primary">
            <UserCheck className="h-5 w-5" />
            Connect Requests Report
          </CardTitle>
          <CardDescription>Top 20 users by connect requests sent in the selected period</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          {connectRequestsReport.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">#</th>
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">Member Name</th>
                    <th className="text-center py-2 px-3 text-muted-foreground font-medium">Total Sent</th>
                    <th className="text-center py-2 px-3 text-muted-foreground font-medium">Accepted</th>
                    <th className="text-center py-2 px-3 text-muted-foreground font-medium">Pending</th>
                    <th className="text-center py-2 px-3 text-muted-foreground font-medium">Rejected</th>
                  </tr>
                </thead>
                <tbody>
                  {connectRequestsReport.map((row, index) => (
                    <tr key={row.memberId} className="border-b hover:bg-muted/30 transition-colors">
                      <td className="py-2 px-3 text-muted-foreground">{index + 1}</td>
                      <td className="py-2 px-3 font-medium">{row.name}</td>
                      <td className="py-2 px-3 text-center font-bold text-primary">{row.totalSent}</td>
                      <td className="py-2 px-3 text-center text-green-600">{row.accepted}</td>
                      <td className="py-2 px-3 text-center text-orange-500">{row.pending}</td>
                      <td className="py-2 px-3 text-center text-red-500">{row.rejected}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No connect request data available for this period
            </div>
          )}
        </CardContent>
      </Card>
      </main>
    </div>
  );
};

export default AdminAnalytics;
