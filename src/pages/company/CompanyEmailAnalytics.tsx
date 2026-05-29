import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Mail, Send, CheckCircle, Eye, MousePointer, AlertCircle, Ban, TrendingUp } from 'lucide-react';
import { BackButton } from '@/components/BackButton';
import { Progress } from '@/components/ui/progress';
import { useUserRole } from '@/hooks/useUserRole';
import { useRoleContext } from '@/contexts/RoleContext';

interface OverallStats {
  totalCampaigns: number;
  totalRecipients: number;
  totalSent: number;
  totalDelivered: number;
  totalOpened: number;
  totalClicked: number;
  totalBounced: number;
  totalComplained: number;
  deliveryRate: number;
  avgOpenRate: number;
  avgClickRate: number;
  avgBounceRate: number;
}

interface CampaignDetail {
  id: string;
  subject: string;
  sender_name: string;
  sender_email: string;
  sent_at: string;
  total_recipients: number;
  total_sent: number;
  total_delivered: number;
  total_opened: number;
  total_clicked: number;
  total_bounced: number;
  total_complained: number;
  open_rate: number;
  click_rate: number;
  bounce_rate: number;
}

export default function CompanyEmailAnalytics() {
  const { userData } = useUserRole();
  const { selectedCompanyId } = useRoleContext();
  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [stats, setStats] = useState<OverallStats>({
    totalCampaigns: 0,
    totalRecipients: 0,
    totalSent: 0,
    totalDelivered: 0,
    totalOpened: 0,
    totalClicked: 0,
    totalBounced: 0,
    totalComplained: 0,
    deliveryRate: 0,
    avgOpenRate: 0,
    avgClickRate: 0,
    avgBounceRate: 0,
  });
  const [campaigns, setCampaigns] = useState<CampaignDetail[]>([]);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');

  useEffect(() => {
    if (selectedCompanyId) {
      setCompanyId(selectedCompanyId);
    } else if (userData?.company?.id) {
      setCompanyId(userData.company.id);
    }
  }, [selectedCompanyId, userData]);

  useEffect(() => {
    if (companyId) {
      loadAnalytics();
    }
  }, [companyId, timeRange]);

  const loadAnalytics = async () => {
    if (!companyId) return;

    try {
      setLoading(true);
      
      let query = supabase
        .from('email_campaigns')
        .select('*')
        .eq('company_id', companyId)
        .order('sent_at', { ascending: false });

      if (timeRange !== 'all') {
        const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        query = query.gte('sent_at', startDate.toISOString());
      }

      const { data: campaignsData, error } = await query;

      if (error) throw error;

      setCampaigns(campaignsData || []);

      const totalCampaigns = campaignsData?.length || 0;
      const totalRecipients = campaignsData?.reduce((sum, c) => sum + (c.total_recipients || 0), 0) || 0;
      const totalSent = campaignsData?.reduce((sum, c) => sum + (c.total_sent || 0), 0) || 0;
      const totalDelivered = campaignsData?.reduce((sum, c) => sum + (c.total_delivered || 0), 0) || 0;
      const totalOpened = campaignsData?.reduce((sum, c) => sum + (c.total_opened || 0), 0) || 0;
      const totalClicked = campaignsData?.reduce((sum, c) => sum + (c.total_clicked || 0), 0) || 0;
      const totalBounced = campaignsData?.reduce((sum, c) => sum + (c.total_bounced || 0), 0) || 0;
      const totalComplained = campaignsData?.reduce((sum, c) => sum + (c.total_complained || 0), 0) || 0;

      const deliveryRate = totalSent > 0 ? (totalDelivered / totalSent) * 100 : 0;
      const avgOpenRate = totalDelivered > 0 ? (totalOpened / totalDelivered) * 100 : 0;
      const avgClickRate = totalOpened > 0 ? (totalClicked / totalOpened) * 100 : 0;
      const avgBounceRate = totalSent > 0 ? (totalBounced / totalSent) * 100 : 0;

      setStats({
        totalCampaigns,
        totalRecipients,
        totalSent,
        totalDelivered,
        totalOpened,
        totalClicked,
        totalBounced,
        totalComplained,
        deliveryRate,
        avgOpenRate,
        avgClickRate,
        avgBounceRate,
      });
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 !pl-20 md:!pl-24 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <BackButton />
          <div>
            <h1 className="text-3xl font-bold">Email Campaign Analytics</h1>
            <p className="text-muted-foreground">Track your email campaign performance</p>
          </div>
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

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Campaigns</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalCampaigns}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.totalRecipients.toLocaleString()} total recipients
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Emails Sent</CardTitle>
            <Send className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalSent.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.totalDelivered.toLocaleString()} confirmed delivered
            </p>
            {stats.totalSent > stats.totalDelivered && (
              <p className="text-xs text-amber-600 mt-1">
                {(stats.totalSent - stats.totalDelivered).toLocaleString()} pending confirmation
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Engagement</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalOpened.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.totalClicked.toLocaleString()} clicks
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Issues</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalBounced.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.totalComplained} complaints
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Delivery Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold mb-2">{stats.deliveryRate.toFixed(1)}%</div>
            <Progress value={stats.deliveryRate} className="h-2" />
            <p className="text-xs text-muted-foreground mt-2">
              {stats.totalDelivered.toLocaleString()} of {stats.totalSent.toLocaleString()} sent
            </p>
            {stats.totalSent > stats.totalDelivered && (
              <p className="text-xs text-amber-600 mt-1">
                Note: Delivery confirmations update via webhooks
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Open Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold mb-2">
              {stats.totalDelivered > 0 ? stats.avgOpenRate.toFixed(1) : '—'}%
            </div>
            <Progress value={stats.avgOpenRate} className="h-2" />
            <p className="text-xs text-muted-foreground mt-2">
              {stats.totalOpened.toLocaleString()} of {stats.totalDelivered.toLocaleString()} delivered
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <MousePointer className="h-4 w-4" />
              Click Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold mb-2">
              {stats.totalOpened > 0 ? stats.avgClickRate.toFixed(1) : '—'}%
            </div>
            <Progress value={stats.avgClickRate} className="h-2" />
            <p className="text-xs text-muted-foreground mt-2">
              {stats.totalClicked.toLocaleString()} of {stats.totalOpened.toLocaleString()} opened
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Ban className="h-4 w-4" />
              Bounce Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold mb-2">{stats.avgBounceRate.toFixed(1)}%</div>
            <Progress value={stats.avgBounceRate} className="h-2" />
            <p className="text-xs text-muted-foreground mt-2">
              {stats.totalBounced.toLocaleString()} of {stats.totalSent.toLocaleString()} sent
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Campaign Performance Details</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading analytics...</div>
          ) : campaigns.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No campaigns found in this time period
            </div>
          ) : (
            <div className="space-y-4">
              {campaigns.map((campaign) => (
                <div key={campaign.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg">{campaign.subject}</h3>
                      <p className="text-sm text-muted-foreground">
                        From: {campaign.sender_name} ({campaign.sender_email})
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Sent: {new Date(campaign.sent_at).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 pt-2 border-t">
                    <div className="text-center">
                      <div className="text-lg font-bold">{campaign.total_recipients}</div>
                      <div className="text-xs text-muted-foreground">Recipients</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-blue-600">{campaign.total_sent}</div>
                      <div className="text-xs text-muted-foreground">Sent</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-green-600">{campaign.total_delivered}</div>
                      <div className="text-xs text-muted-foreground">Delivered</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-purple-600">{campaign.total_opened}</div>
                      <div className="text-xs text-muted-foreground">Opened</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-cyan-600">{campaign.total_clicked}</div>
                      <div className="text-xs text-muted-foreground">Clicked</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-red-600">{campaign.total_bounced}</div>
                      <div className="text-xs text-muted-foreground">Bounced</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-orange-600">{campaign.total_complained}</div>
                      <div className="text-xs text-muted-foreground">Complaints</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold">{((campaign.open_rate || 0) as number).toFixed(1)}%</div>
                      <div className="text-xs text-muted-foreground">Open Rate</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
