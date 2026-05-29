import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { BackButton } from "@/components/BackButton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, Users, Building2, Activity, GraduationCap, CheckCircle2, Clock, BarChart3, UserCheck, IndianRupee, Calendar } from "lucide-react";
import { toast } from "sonner";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { formatDate } from "@/lib/formatters";
import { useUserRole } from "@/hooks/useUserRole";

interface TimeSeriesData {
  date: string;
  members: number;
  companies: number;
}

interface TopCompany {
  name: string;
  memberCount: number;
}

interface ConnectRequestUser {
  memberId: string;
  name: string;
  totalSent: number;
  pending: number;
  accepted: number;
  rejected: number;
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', 'hsl(var(--muted))'];

const AssociationAnalytics = () => {
  const navigate = useNavigate();
  const { userData } = useUserRole();
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');
  const [associationId, setAssociationId] = useState<string | null>(null);
  
  const [stats, setStats] = useState({
    totalMembers: 0,
    totalCompanies: 0,
    activeUsers: 0,
    pendingInvitations: 0,
    newMembers1Day: 0,
    newMembers7Days: 0,
    newMembers30Days: 0,
    onboardingTotal: 0,
    onboardingCompleted: 0,
    onboardingInProgress: 0,
    onboardingCompletionRate: 0,
    totalPosts: 0,
    totalConnections: 0,
    totalRevenue: 0,
    monthRevenue: 0,
    paidRegistrations: 0,
    avgTicketSize: 0,
  });
  
  const [growthData, setGrowthData] = useState<TimeSeriesData[]>([]);
  const [topCompanies, setTopCompanies] = useState<TopCompany[]>([]);
  const [connectRequestsReport, setConnectRequestsReport] = useState<ConnectRequestUser[]>([]);

  useEffect(() => {
    const initAssociation = async () => {
      if (userData?.association_id) {
        setAssociationId(userData.association_id);
      } else if (userData?.association) {
        setAssociationId(userData.association.id);
      }
    };
    
    initAssociation();
  }, [userData]);

  useEffect(() => {
    if (associationId) {
      loadAnalytics();
    }
  }, [timeRange, associationId]);

  const getDaysAgo = (days: number) => {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date.toISOString();
  };

  const loadAnalytics = async () => {
    if (!associationId) return;
    
    try {
      setLoading(true);
      const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : timeRange === '90d' ? 90 : 365;
      const startDate = timeRange === 'all' ? null : getDaysAgo(days);

      // Load companies in this association
      const { data: companies, error: companiesError } = await supabase
        .from('companies')
        .select('id')
        .eq('association_id', associationId)
        .eq('is_active', true);

      if (companiesError) throw companiesError;
      
      const companyIds = companies?.map(c => c.id) || [];

      // Load overall stats
      const [
        { count: membersCount },
        { count: activeCompaniesCount },
        { count: pendingInvitesCount },
        { count: onboardingTotal },
        { count: onboardingCompleted },
        { count: newMembers1Day },
        { count: newMembers7Days },
        { count: newMembers30Days },
        { count: totalPosts },
        { count: totalConnections }
      ] = await Promise.all([
        supabase.from('members').select('*', { count: 'exact', head: true })
          .in('company_id', companyIds)
          .eq('is_active', true),
        supabase.from('companies').select('*', { count: 'exact', head: true })
          .eq('association_id', associationId)
          .eq('is_active', true),
        supabase.from('member_invitations').select('*', { count: 'exact', head: true })
          .eq('organization_type', 'company')
          .in('organization_id', companyIds)
          .eq('status', 'pending'),
        supabase.from('user_onboarding').select('*', { count: 'exact', head: true })
          .in('user_id', (await supabase.from('members').select('user_id').in('company_id', companyIds)).data?.map(m => m.user_id) || []),
        supabase.from('user_onboarding').select('*', { count: 'exact', head: true })
          .in('user_id', (await supabase.from('members').select('user_id').in('company_id', companyIds)).data?.map(m => m.user_id) || [])
          .eq('is_completed', true),
        supabase.from('members').select('*', { count: 'exact', head: true })
          .in('company_id', companyIds)
          .gte('created_at', getDaysAgo(1)),
        supabase.from('members').select('*', { count: 'exact', head: true })
          .in('company_id', companyIds)
          .gte('created_at', getDaysAgo(7)),
        supabase.from('members').select('*', { count: 'exact', head: true })
          .in('company_id', companyIds)
          .gte('created_at', getDaysAgo(30)),
        supabase.from('posts').select('*', { count: 'exact', head: true })
          .in('user_id', (await supabase.from('members').select('user_id').in('company_id', companyIds)).data?.map(m => m.user_id) || []),
        supabase.from('connections').select('*', { count: 'exact', head: true })
          .in('sender_id', (await supabase.from('members').select('id').in('company_id', companyIds)).data?.map(m => m.id) || [])
          .eq('status', 'accepted')
      ]);

      const onboardingInProgress = (onboardingTotal || 0) - (onboardingCompleted || 0);
      const onboardingCompletionRate = onboardingTotal ? Math.round((onboardingCompleted / onboardingTotal) * 100) : 0;

      // Revenue from paid event registrations under this association
      const { data: lpRows } = await supabase
        .from('event_landing_pages')
        .select('id')
        .eq('association_id', associationId);
      const lpIds = (lpRows || []).map((r: { id: string }) => r.id);

      let totalRevenue = 0;
      let monthRevenue = 0;
      let paidRegistrations = 0;
      if (lpIds.length > 0) {
        const { data: regs } = await supabase
          .from('event_registrations')
          .select('final_amount, created_at')
          .in('landing_page_id', lpIds)
          .gt('final_amount', 0);
        const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        for (const r of (regs || []) as Array<{ final_amount: number | null; created_at: string }>) {
          const amt = Number(r.final_amount || 0);
          totalRevenue += amt;
          paidRegistrations += 1;
          if (r.created_at >= monthAgo) monthRevenue += amt;
        }
      }
      const avgTicketSize = paidRegistrations > 0 ? Math.round(totalRevenue / paidRegistrations) : 0;

      setStats({
        totalMembers: membersCount || 0,
        totalCompanies: activeCompaniesCount || 0,
        activeUsers: membersCount || 0,
        pendingInvitations: pendingInvitesCount || 0,
        newMembers1Day: newMembers1Day || 0,
        newMembers7Days: newMembers7Days || 0,
        newMembers30Days: newMembers30Days || 0,
        onboardingTotal: onboardingTotal || 0,
        onboardingCompleted: onboardingCompleted || 0,
        onboardingInProgress,
        onboardingCompletionRate,
        totalPosts: totalPosts || 0,
        totalConnections: totalConnections || 0,
        totalRevenue,
        monthRevenue,
        paidRegistrations,
        avgTicketSize,
      });

      // Load growth data
      await loadGrowthData(companyIds, startDate);

      // Load top companies
      await loadTopCompanies(companyIds);

      // Load connect requests report
      await loadConnectRequestsReport(companyIds, startDate);

      setLoading(false);
    } catch (error: any) {
      console.error('Error loading analytics:', error);
      toast.error('Failed to load analytics');
      setLoading(false);
    }
  };

  const loadGrowthData = async (companyIds: string[], startDate: string | null) => {
    try {
      const query = supabase
        .from('members')
        .select('created_at')
        .in('company_id', companyIds)
        .order('created_at', { ascending: true });

      if (startDate) {
        query.gte('created_at', startDate);
      }

      const { data: membersData } = await query;

      const companiesQuery = supabase
        .from('companies')
        .select('created_at')
        .eq('association_id', associationId)
        .order('created_at', { ascending: true });

      if (startDate) {
        companiesQuery.gte('created_at', startDate);
      }

      const { data: companiesData } = await companiesQuery;

      // Group by date
      const dataMap = new Map<string, { members: number; companies: number }>();
      
      membersData?.forEach(item => {
        const date = new Date(item.created_at).toLocaleDateString();
        const current = dataMap.get(date) || { members: 0, companies: 0 };
        dataMap.set(date, { ...current, members: current.members + 1 });
      });

      companiesData?.forEach(item => {
        const date = new Date(item.created_at).toLocaleDateString();
        const current = dataMap.get(date) || { members: 0, companies: 0 };
        dataMap.set(date, { ...current, companies: current.companies + 1 });
      });

      const growthArray = Array.from(dataMap.entries())
        .map(([date, counts]) => ({
          date,
          members: counts.members,
          companies: counts.companies,
        }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .slice(-30); // Last 30 data points

      setGrowthData(growthArray);
    } catch (error) {
      console.error('Error loading growth data:', error);
    }
  };

  const loadTopCompanies = async (companyIds: string[]) => {
    try {
      const { data: companiesWithCounts } = await supabase
        .from('companies')
        .select(`
          id,
          name,
          members:members(count)
        `)
        .in('id', companyIds)
        .eq('is_active', true);

      const topCompaniesData = (companiesWithCounts || [])
        .map(company => ({
          name: company.name,
          memberCount: Array.isArray(company.members) ? company.members.length : 0,
        }))
        .sort((a, b) => b.memberCount - a.memberCount)
        .slice(0, 10);

      setTopCompanies(topCompaniesData);
    } catch (error) {
      console.error('Error loading top companies:', error);
    }
  };

  const loadConnectRequestsReport = async (companyIds: string[], startDate: string | null) => {
    try {
      const { data: members } = await supabase
        .from('members')
        .select('id, user_id')
        .in('company_id', companyIds)
        .eq('is_active', true);

      if (!members || members.length === 0) {
        setConnectRequestsReport([]);
        return;
      }

      const memberIds = members.map(m => m.id);

      let query = supabase
        .from('connections')
        .select('sender_id, status')
        .in('sender_id', memberIds);

      if (startDate) {
        query = query.gte('created_at', startDate);
      }

      const { data: connections } = await query;

      if (!connections || connections.length === 0) {
        setConnectRequestsReport([]);
        return;
      }

      const senderMap = new Map<string, { total: number; pending: number; accepted: number; rejected: number }>();
      connections.forEach(conn => {
        const current = senderMap.get(conn.sender_id) || { total: 0, pending: 0, accepted: 0, rejected: 0 };
        current.total++;
        if (conn.status === 'pending') current.pending++;
        else if (conn.status === 'accepted') current.accepted++;
        else if (conn.status === 'rejected') current.rejected++;
        senderMap.set(conn.sender_id, current);
      });

      const sortedSenders = Array.from(senderMap.entries())
        .sort((a, b) => b[1].total - a[1].total)
        .slice(0, 20);

      const memberMap = new Map(members.map(m => [m.id, m.user_id]));
      const userIds = [...new Set(members.map(m => m.user_id))];

      const { data: profiles } = userIds.length > 0
        ? await supabase.from('profiles').select('id, first_name, last_name').in('id', userIds)
        : { data: [] };

      const profileMap = new Map((profiles || []).map(p => [p.id, p]));

      const report = sortedSenders.map(([memberId, counts]) => {
        const userId = memberMap.get(memberId);
        const profile = userId ? profileMap.get(userId) : null;
        const name = profile
          ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Unknown'
          : 'Unknown';
        return {
          memberId,
          name,
          totalSent: counts.total,
          pending: counts.pending,
          accepted: counts.accepted,
          rejected: counts.rejected,
        };
      });

      setConnectRequestsReport(report);
    } catch (error) {
      console.error('Error loading connect requests report:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="container mx-auto p-4 md:p-6 lg:p-8 !pl-20 md:!pl-24 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <BackButton 
              fallbackPath="/association" 
              variant="ghost" 
              size="icon"
              label=""
              className="hover:bg-primary/10"
            />
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                Association Analytics
              </h1>
              <p className="text-muted-foreground">Comprehensive insights and metrics</p>
            </div>
          </div>
        </div>

        {/* Time Range Selector */}
        <div className="flex gap-2">
          <Button
            variant={timeRange === '7d' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTimeRange('7d')}
          >
            7 Days
          </Button>
          <Button
            variant={timeRange === '30d' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTimeRange('30d')}
          >
            30 Days
          </Button>
          <Button
            variant={timeRange === '90d' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTimeRange('90d')}
          >
            90 Days
          </Button>
          <Button
            variant={timeRange === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTimeRange('all')}
          >
            All Time
          </Button>
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="hover:shadow-lg transition-shadow border-primary/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Members</CardTitle>
              <Users className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalMembers}</div>
              <p className="text-xs text-muted-foreground">
                +{stats.newMembers7Days} this week
              </p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow border-primary/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Companies</CardTitle>
              <Building2 className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalCompanies}</div>
              <p className="text-xs text-muted-foreground">
                Active companies
              </p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow border-primary/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Invitations</CardTitle>
              <Activity className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pendingInvitations}</div>
              <p className="text-xs text-muted-foreground">
                Awaiting response
              </p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow border-primary/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Posts</CardTitle>
              <BarChart3 className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalPosts}</div>
              <p className="text-xs text-muted-foreground">
                Member engagement
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Event Revenue */}
        <Card className="border-primary/20">
          <CardHeader>
            <div className="flex items-center gap-2">
              <IndianRupee className="h-5 w-5 text-primary" />
              <CardTitle>Event Revenue</CardTitle>
            </div>
            <CardDescription>Paid event registrations across your association's landing pages</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <IndianRupee className="h-4 w-4 text-green-600" />
                  <span className="text-sm">Total Revenue</span>
                </div>
                <div className="text-3xl font-bold text-green-600">₹{stats.totalRevenue.toLocaleString('en-IN')}</div>
                <p className="text-xs text-muted-foreground">All-time paid registrations</p>
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
                  <UserCheck className="h-4 w-4 text-primary" />
                  <span className="text-sm">Paid Registrations</span>
                </div>
                <div className="text-3xl font-bold">{stats.paidRegistrations}</div>
                <p className="text-xs text-muted-foreground">Successful payments</p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <TrendingUp className="h-4 w-4 text-orange-600" />
                  <span className="text-sm">Avg Ticket Size</span>
                </div>
                <div className="text-3xl font-bold text-orange-600">₹{stats.avgTicketSize.toLocaleString('en-IN')}</div>
                <p className="text-xs text-muted-foreground">Per paid registration</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Growth Trends */}
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Growth Trends
            </CardTitle>
            <CardDescription>Member and company growth over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={growthData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                />
                <YAxis tick={{ fontSize: 12 }} className="text-muted-foreground" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="members" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  name="Members"
                />
                <Line 
                  type="monotone" 
                  dataKey="companies" 
                  stroke="hsl(var(--secondary))" 
                  strokeWidth={2}
                  name="Companies"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Onboarding Analytics */}
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-primary" />
              Member Onboarding Analytics
            </CardTitle>
            <CardDescription>Track member onboarding progress and completion</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Total Members</span>
                </div>
                <div className="text-2xl font-bold">{stats.onboardingTotal}</div>
                <p className="text-xs text-muted-foreground">Started onboarding</p>
              </div>

              <div className="p-4 rounded-lg bg-green-500/5 border border-green-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium">Completed</span>
                </div>
                <div className="text-2xl font-bold text-green-600">{stats.onboardingCompleted}</div>
                <p className="text-xs text-muted-foreground">
                  {stats.onboardingCompletionRate}% completion rate
                </p>
              </div>

              <div className="p-4 rounded-lg bg-orange-500/5 border border-orange-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="h-4 w-4 text-orange-600" />
                  <span className="text-sm font-medium">In Progress</span>
                </div>
                <div className="text-2xl font-bold text-orange-600">{stats.onboardingInProgress}</div>
                <p className="text-xs text-muted-foreground">Currently onboarding</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Top Companies */}
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              Top Companies by Member Count
            </CardTitle>
            <CardDescription>Companies with the most members</CardDescription>
          </CardHeader>
          <CardContent>
            {topCompanies.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={topCompanies} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" tick={{ fontSize: 12 }} />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    width={150}
                    tick={{ fontSize: 12 }}
                    className="text-muted-foreground"
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Bar 
                    dataKey="memberCount" 
                    fill="hsl(var(--primary))" 
                    name="Members"
                    radius={[0, 8, 8, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No company data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity Summary */}
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle>Recent Activity Summary</CardTitle>
            <CardDescription>Member activity in the last 30 days</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 rounded-lg bg-muted/50">
                <div className="text-2xl font-bold text-primary">{stats.newMembers30Days}</div>
                <p className="text-sm text-muted-foreground">New Members</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-muted/50">
                <div className="text-2xl font-bold text-primary">{stats.totalPosts}</div>
                <p className="text-sm text-muted-foreground">Total Posts</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-muted/50">
                <div className="text-2xl font-bold text-primary">{stats.totalConnections}</div>
                <p className="text-sm text-muted-foreground">Connections</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-muted/50">
                <div className="text-2xl font-bold text-primary">{stats.onboardingCompletionRate}%</div>
                <p className="text-sm text-muted-foreground">Completion Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>
        {/* Connect Requests Report */}
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-primary" />
              Connect Requests Report
            </CardTitle>
            <CardDescription>Top 20 members by connect requests sent in the selected period</CardDescription>
          </CardHeader>
          <CardContent>
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
      </div>
    </div>
  );
};

export default AssociationAnalytics;
