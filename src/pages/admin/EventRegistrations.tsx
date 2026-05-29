import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useOwnershipScope } from '@/hooks/useOwnershipScope';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ArrowLeft, Download, Search, Eye, Loader2, BarChart3, Users, TrendingUp, GraduationCap, CheckCircle2, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { Json } from '@/integrations/supabase/types';

interface Registration {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  status: string;
  created_at: string;
  registration_data: Json;
  original_amount: number | null;
  discount_amount: number | null;
  final_amount: number | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  event_coupons: {
    code: string;
  } | null;
}

interface LandingPage {
  id: string;
  title: string;
  slug: string;
}

const EventRegistrations = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { userId } = useAuth();
  const scope = useOwnershipScope();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRegistration, setSelectedRegistration] = useState<Registration | null>(null);
  const [utmSourceFilter, setUtmSourceFilter] = useState<string>('all');
  const [utmMediumFilter, setUtmMediumFilter] = useState<string>('all');
  const [utmCampaignFilter, setUtmCampaignFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState('registrations');
  const [onboardingSearch, setOnboardingSearch] = useState('');
  const [onboardingFilter, setOnboardingFilter] = useState<'all' | 'completed' | 'pending'>('all');

  const { data: landingPage, isLoading: isLoadingPage } = useQuery({
    queryKey: ['landing-page', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('event_landing_pages')
        .select('id, title, slug')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as LandingPage;
    },
    enabled: !!id && !!userId,
  });

  const { data: registrations, isLoading: isLoadingRegistrations } = useQuery({
    queryKey: ['event-registrations', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('event_registrations')
        .select(`
          id,
          first_name,
          last_name,
          email,
          phone,
          status,
          created_at,
          registration_data,
          original_amount,
          discount_amount,
          final_amount,
          utm_source,
          utm_medium,
          utm_campaign,
          event_coupons (
            code
          )
        `)
        .eq('landing_page_id', id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as unknown as Registration[];
    },
    enabled: !!id && !!userId,
  });

  // Map of registration_id → payment row, for the Payment column
  const { data: paymentByRegistration } = useQuery({
    queryKey: ['event-registration-payments', id, registrations?.length ?? 0],
    queryFn: async () => {
      const regIds = (registrations ?? []).map(r => r.id);
      if (regIds.length === 0) return {} as Record<string, { status: string; razorpay_payment_id: string | null; amount: number | null; paid_at: string | null }>;
      const { data, error } = await supabase
        .from('payments')
        .select('reference_id, status, razorpay_payment_id, amount, paid_at')
        .eq('purpose', 'event_registration')
        .in('reference_id', regIds);
      if (error) throw error;
      const map: Record<string, { status: string; razorpay_payment_id: string | null; amount: number | null; paid_at: string | null }> = {};
      for (const row of (data ?? []) as Array<{ reference_id: string; status: string; razorpay_payment_id: string | null; amount: number | null; paid_at: string | null }>) {
        map[row.reference_id] = {
          status: row.status,
          razorpay_payment_id: row.razorpay_payment_id,
          amount: row.amount,
          paid_at: row.paid_at,
        };
      }
      return map;
    },
    enabled: !!id && !!userId && (registrations?.length ?? 0) > 0,
  });

  interface OnboardingRow {
    registration_id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone: string | null;
    registered_at: string;
    onboarding_completed: boolean;
    onboarding_completed_at: string | null;
  }

  const { data: onboardingData, isLoading: isLoadingOnboarding } = useQuery({
    queryKey: ['event-onboarding', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('get_event_onboarding_report', { p_landing_page_id: id });
      if (error) throw error;
      return (data || []) as OnboardingRow[];
    },
    enabled: !!id && !!userId,
  });

  const onboardingStats = useMemo(() => {
    const total = onboardingData?.length ?? 0;
    const completed = onboardingData?.filter(r => r.onboarding_completed).length ?? 0;
    return { total, completed, pending: total - completed };
  }, [onboardingData]);

  const filteredOnboarding = useMemo(() => {
    return (onboardingData ?? []).filter(row => {
      if (onboardingFilter === 'completed' && !row.onboarding_completed) return false;
      if (onboardingFilter === 'pending' && row.onboarding_completed) return false;
      if (onboardingSearch) {
        const q = onboardingSearch.toLowerCase();
        if (
          !`${row.first_name} ${row.last_name}`.toLowerCase().includes(q) &&
          !row.email.toLowerCase().includes(q)
        ) return false;
      }
      return true;
    });
  }, [onboardingData, onboardingFilter, onboardingSearch]);

  const exportOnboardingCSV = () => {
    const headers = ['First Name', 'Last Name', 'Email', 'Phone', 'Registered At', 'Onboarding Completed', 'Completed At'];
    const rows = filteredOnboarding.map(r => [
      r.first_name, r.last_name, r.email, r.phone ?? '',
      format(new Date(r.registered_at), 'yyyy-MM-dd HH:mm:ss'),
      r.onboarding_completed ? 'Yes' : 'No',
      r.onboarding_completed_at ? format(new Date(r.onboarding_completed_at), 'yyyy-MM-dd HH:mm:ss') : '',
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `onboarding-${landingPage?.slug ?? id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Get unique UTM values for filters
  const utmOptions = useMemo(() => {
    const sources = new Set<string>();
    const mediums = new Set<string>();
    const campaigns = new Set<string>();
    
    registrations?.forEach(reg => {
      if (reg.utm_source) sources.add(reg.utm_source);
      if (reg.utm_medium) mediums.add(reg.utm_medium);
      if (reg.utm_campaign) campaigns.add(reg.utm_campaign);
    });
    
    return {
      sources: Array.from(sources).sort(),
      mediums: Array.from(mediums).sort(),
      campaigns: Array.from(campaigns).sort(),
    };
  }, [registrations]);

  // Calculate UTM analytics
  const utmAnalytics = useMemo(() => {
    if (!registrations) return null;
    
    const bySource: Record<string, { count: number; revenue: number }> = {};
    const byMedium: Record<string, { count: number; revenue: number }> = {};
    const byCampaign: Record<string, { count: number; revenue: number }> = {};
    let totalRevenue = 0;
    
    registrations.forEach(reg => {
      const revenue = reg.final_amount || 0;
      totalRevenue += revenue;
      
      const source = reg.utm_source || 'Direct / Unknown';
      const medium = reg.utm_medium || 'None';
      const campaign = reg.utm_campaign || 'None';
      
      if (!bySource[source]) bySource[source] = { count: 0, revenue: 0 };
      bySource[source].count++;
      bySource[source].revenue += revenue;
      
      if (!byMedium[medium]) byMedium[medium] = { count: 0, revenue: 0 };
      byMedium[medium].count++;
      byMedium[medium].revenue += revenue;
      
      if (!byCampaign[campaign]) byCampaign[campaign] = { count: 0, revenue: 0 };
      byCampaign[campaign].count++;
      byCampaign[campaign].revenue += revenue;
    });
    
    return {
      bySource: Object.entries(bySource).map(([name, data]) => ({ name, ...data })).sort((a, b) => b.count - a.count),
      byMedium: Object.entries(byMedium).map(([name, data]) => ({ name, ...data })).sort((a, b) => b.count - a.count),
      byCampaign: Object.entries(byCampaign).map(([name, data]) => ({ name, ...data })).sort((a, b) => b.count - a.count),
      totalRevenue,
      totalRegistrations: registrations.length,
    };
  }, [registrations]);

  const filteredRegistrations = registrations?.filter((reg) => {
    // Text search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesSearch = (
        reg.first_name.toLowerCase().includes(query) ||
        reg.last_name.toLowerCase().includes(query) ||
        reg.email.toLowerCase().includes(query) ||
        (reg.phone && reg.phone.toLowerCase().includes(query))
      );
      if (!matchesSearch) return false;
    }
    
    // UTM filters
    if (utmSourceFilter !== 'all' && reg.utm_source !== utmSourceFilter) return false;
    if (utmMediumFilter !== 'all' && reg.utm_medium !== utmMediumFilter) return false;
    if (utmCampaignFilter !== 'all' && reg.utm_campaign !== utmCampaignFilter) return false;
    
    return true;
  });

  const flattenRegistrationData = (reg: Registration): Record<string, string> => {
    const flat: Record<string, string> = {
      'First Name': reg.first_name,
      'Last Name': reg.last_name,
      'Email': reg.email,
      'Phone': reg.phone || '',
      'Status': reg.status,
      'Registered At': format(new Date(reg.created_at), 'yyyy-MM-dd HH:mm:ss'),
      'Original Amount': reg.original_amount?.toString() || '',
      'Discount Amount': reg.discount_amount?.toString() || '',
      'Final Amount': reg.final_amount?.toString() || '',
      'Coupon Code': reg.event_coupons?.code || '',
      'UTM Source': reg.utm_source || '',
      'UTM Medium': reg.utm_medium || '',
      'UTM Campaign': reg.utm_campaign || '',
    };

    // Flatten registration_data JSONB
    if (reg.registration_data && typeof reg.registration_data === 'object') {
      const data = reg.registration_data as Record<string, unknown>;
      Object.entries(data).forEach(([key, value]) => {
        // Skip keys that are already in standard fields
        if (['first_name', 'last_name', 'email', 'phone'].includes(key.toLowerCase())) {
          return;
        }
        flat[key] = String(value ?? '');
      });
    }

    return flat;
  };

  const exportToCSV = () => {
    if (!registrations || registrations.length === 0) return;

    // Get all unique keys across all registrations
    const allKeys = new Set<string>();
    registrations.forEach((reg) => {
      const flat = flattenRegistrationData(reg);
      Object.keys(flat).forEach((key) => allKeys.add(key));
    });

    const headers = Array.from(allKeys);
    const rows = registrations.map((reg) => {
      const flat = flattenRegistrationData(reg);
      return headers.map((header) => {
        const value = flat[header] || '';
        // Escape quotes and wrap in quotes if contains comma or quote
        if (value.includes(',') || value.includes('"') || value.includes('\n')) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      });
    });

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `registrations-${landingPage?.slug || id}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default" className="bg-green-600">Completed</Badge>;
      case 'pending':
        return <Badge variant="secondary">Pending</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const isLoading = isLoadingPage || isLoadingRegistrations;

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-6xl">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate(`${scope.basePath}/event-landing-pages`)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <PageHeader
            title={`Registrations: ${landingPage?.title || 'Loading...'}`}
            description={`${filteredRegistrations?.length || 0} total registrations`}
          />
        </div>
      </div>

      {/* Summary Cards */}
      {utmAnalytics && (
        <div className="grid gap-4 md:grid-cols-3 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Registrations</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{utmAnalytics.totalRegistrations}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">₹{utmAnalytics.totalRevenue.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">UTM Sources</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{utmAnalytics.bySource.length}</div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="registrations">Registrations</TabsTrigger>
          <TabsTrigger value="analytics">📊 UTM Analytics</TabsTrigger>
          <TabsTrigger value="onboarding">🎓 Onboarding Funnel</TabsTrigger>
        </TabsList>

        <TabsContent value="registrations" className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              {utmOptions.sources.length > 0 && (
                <Select value={utmSourceFilter} onValueChange={setUtmSourceFilter}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Source" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sources</SelectItem>
                    {utmOptions.sources.map(source => (
                      <SelectItem key={source} value={source}>{source}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {utmOptions.mediums.length > 0 && (
                <Select value={utmMediumFilter} onValueChange={setUtmMediumFilter}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Medium" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Mediums</SelectItem>
                    {utmOptions.mediums.map(medium => (
                      <SelectItem key={medium} value={medium}>{medium}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {utmOptions.campaigns.length > 0 && (
                <Select value={utmCampaignFilter} onValueChange={setUtmCampaignFilter}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Campaign" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Campaigns</SelectItem>
                    {utmOptions.campaigns.map(campaign => (
                      <SelectItem key={campaign} value={campaign}>{campaign}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Button
                onClick={exportToCSV}
                disabled={!registrations || registrations.length === 0}
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : !filteredRegistrations || filteredRegistrations.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">
                  {searchQuery || utmSourceFilter !== 'all' || utmMediumFilter !== 'all' || utmCampaignFilter !== 'all' 
                    ? 'No registrations match your filters' 
                    : 'No registrations yet'}
                </p>
              </CardContent>
            </Card>
          ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Coupon</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Registered</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRegistrations.map((reg) => (
                  <TableRow key={reg.id}>
                    <TableCell className="font-medium">
                      {reg.first_name} {reg.last_name}
                    </TableCell>
                    <TableCell>{reg.email}</TableCell>
                    <TableCell>{reg.phone || '-'}</TableCell>
                    <TableCell>
                      {reg.utm_source ? (
                        <Badge variant="secondary" className="text-xs">
                          {reg.utm_source}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {reg.event_coupons?.code ? (
                        <Badge variant="outline" className="text-xs">
                          {reg.event_coupons.code}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {reg.final_amount !== null ? (
                        <div className="text-sm">
                          <span className="font-medium">₹{reg.final_amount.toLocaleString()}</span>
                          {reg.discount_amount && reg.discount_amount > 0 && (
                            <span className="text-green-600 text-xs ml-1">
                              (-₹{reg.discount_amount.toLocaleString()})
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const payment = paymentByRegistration?.[reg.id];
                        if (payment) {
                          if (payment.status === 'paid') {
                            return (
                              <Badge
                                variant="outline"
                                className="bg-green-50 text-green-700 border-green-200"
                                title={payment.razorpay_payment_id || ''}
                              >
                                Paid
                              </Badge>
                            );
                          }
                          if (payment.status === 'failed') {
                            return (
                              <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                                Failed
                              </Badge>
                            );
                          }
                          return (
                            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                              {payment.status}
                            </Badge>
                          );
                        }
                        // No payment row → free registration (or paid via process-event-registration before payments existed)
                        if ((reg.final_amount ?? 0) === 0) {
                          return (
                            <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200">
                              Free
                            </Badge>
                          );
                        }
                        return <span className="text-muted-foreground text-xs">—</span>;
                      })()}
                    </TableCell>
                    <TableCell>{getStatusBadge(reg.status)}</TableCell>
                    <TableCell>
                      {format(new Date(reg.created_at), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedRegistration(reg)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Details
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
          )}
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          {utmAnalytics && (
            <>
              {/* By Source */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Registrations by Source</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Source</TableHead>
                        <TableHead className="text-right">Registrations</TableHead>
                        <TableHead className="text-right">Revenue</TableHead>
                        <TableHead className="text-right">% of Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {utmAnalytics.bySource.map(item => (
                        <TableRow key={item.name}>
                          <TableCell className="font-medium">{item.name}</TableCell>
                          <TableCell className="text-right">{item.count}</TableCell>
                          <TableCell className="text-right">₹{item.revenue.toLocaleString()}</TableCell>
                          <TableCell className="text-right">
                            {((item.count / utmAnalytics.totalRegistrations) * 100).toFixed(1)}%
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* By Medium */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Registrations by Medium</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Medium</TableHead>
                        <TableHead className="text-right">Registrations</TableHead>
                        <TableHead className="text-right">Revenue</TableHead>
                        <TableHead className="text-right">% of Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {utmAnalytics.byMedium.map(item => (
                        <TableRow key={item.name}>
                          <TableCell className="font-medium">{item.name}</TableCell>
                          <TableCell className="text-right">{item.count}</TableCell>
                          <TableCell className="text-right">₹{item.revenue.toLocaleString()}</TableCell>
                          <TableCell className="text-right">
                            {((item.count / utmAnalytics.totalRegistrations) * 100).toFixed(1)}%
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* By Campaign */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Registrations by Campaign</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Campaign</TableHead>
                        <TableHead className="text-right">Registrations</TableHead>
                        <TableHead className="text-right">Revenue</TableHead>
                        <TableHead className="text-right">% of Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {utmAnalytics.byCampaign.map(item => (
                        <TableRow key={item.name}>
                          <TableCell className="font-medium">{item.name}</TableCell>
                          <TableCell className="text-right">{item.count}</TableCell>
                          <TableCell className="text-right">₹{item.revenue.toLocaleString()}</TableCell>
                          <TableCell className="text-right">
                            {((item.count / utmAnalytics.totalRegistrations) * 100).toFixed(1)}%
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* ── ONBOARDING FUNNEL TAB ── */}
        <TabsContent value="onboarding" className="space-y-4">
          {/* Summary cards */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Registrants</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{onboardingStats.total}</div>
                <p className="text-xs text-muted-foreground">Completed registration</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Completed Onboarding</CardTitle>
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{onboardingStats.completed}</div>
                <p className="text-xs text-muted-foreground">
                  {onboardingStats.total > 0
                    ? `${Math.round((onboardingStats.completed / onboardingStats.total) * 100)}% conversion`
                    : '—'}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pending Onboarding</CardTitle>
                <Clock className="h-4 w-4 text-orange-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-500">{onboardingStats.pending}</div>
                <p className="text-xs text-muted-foreground">Yet to complete</p>
              </CardContent>
            </Card>
          </div>

          {/* Filters + export */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or email..."
                value={onboardingSearch}
                onChange={e => setOnboardingSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={onboardingFilter} onValueChange={v => setOnboardingFilter(v as any)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Registrants</SelectItem>
                <SelectItem value="completed">Completed Onboarding</SelectItem>
                <SelectItem value="pending">Pending Onboarding</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={exportOnboardingCSV} disabled={filteredOnboarding.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>

          {isLoadingOnboarding ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredOnboarding.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                {onboardingSearch || onboardingFilter !== 'all'
                  ? 'No registrants match your filters.'
                  : 'No completed registrants found.'}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Registered</TableHead>
                      <TableHead>Onboarding</TableHead>
                      <TableHead>Completed At</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOnboarding.map(row => (
                      <TableRow key={row.registration_id}>
                        <TableCell className="font-medium">{row.first_name} {row.last_name}</TableCell>
                        <TableCell>{row.email}</TableCell>
                        <TableCell>{row.phone ?? '—'}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(row.registered_at), 'MMM d, yyyy')}
                        </TableCell>
                        <TableCell>
                          {row.onboarding_completed
                            ? <Badge className="bg-green-600 text-white">Completed</Badge>
                            : <Badge variant="secondary">Pending</Badge>}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {row.onboarding_completed_at
                            ? format(new Date(row.onboarding_completed_at), 'MMM d, yyyy')
                            : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
          <p className="text-xs text-muted-foreground">
            Showing {filteredOnboarding.length} of {onboardingStats.total} registrants
          </p>
        </TabsContent>
      </Tabs>

      <Dialog open={!!selectedRegistration} onOpenChange={() => setSelectedRegistration(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Registration Details</DialogTitle>
            <DialogDescription>
              {selectedRegistration?.first_name} {selectedRegistration?.last_name} - {selectedRegistration?.email}
            </DialogDescription>
          </DialogHeader>
          {selectedRegistration && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Name</p>
                  <p>{selectedRegistration.first_name} {selectedRegistration.last_name}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Email</p>
                  <p>{selectedRegistration.email}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Phone</p>
                  <p>{selectedRegistration.phone || '-'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Status</p>
                  <p>{getStatusBadge(selectedRegistration.status)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Registered At</p>
                  <p>{format(new Date(selectedRegistration.created_at), 'MMM d, yyyy h:mm a')}</p>
                </div>
                {selectedRegistration.event_coupons?.code && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Coupon Used</p>
                    <Badge variant="outline">{selectedRegistration.event_coupons.code}</Badge>
                  </div>
                )}
              </div>

              {(selectedRegistration.utm_source || selectedRegistration.utm_medium || selectedRegistration.utm_campaign) && (
                <div className="border-t pt-4">
                  <p className="text-sm font-medium text-muted-foreground mb-2">📊 Tracking Info</p>
                  <div className="grid grid-cols-3 gap-4 bg-muted/50 rounded-lg p-3">
                    <div>
                      <p className="text-sm text-muted-foreground">Source</p>
                      <p className="font-medium">{selectedRegistration.utm_source || '-'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Medium</p>
                      <p className="font-medium">{selectedRegistration.utm_medium || '-'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Campaign</p>
                      <p className="font-medium">{selectedRegistration.utm_campaign || '-'}</p>
                    </div>
                  </div>
                </div>
              )}

              {(selectedRegistration.original_amount !== null || selectedRegistration.final_amount !== null) && (
                <div className="border-t pt-4">
                  <p className="text-sm font-medium text-muted-foreground mb-2">Payment Details</p>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Original</p>
                      <p>₹{selectedRegistration.original_amount?.toLocaleString() || '0'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Discount</p>
                      <p className="text-green-600">-₹{selectedRegistration.discount_amount?.toLocaleString() || '0'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Final</p>
                      <p className="font-semibold">₹{selectedRegistration.final_amount?.toLocaleString() || '0'}</p>
                    </div>
                  </div>
                </div>
              )}

              {selectedRegistration.registration_data && 
                typeof selectedRegistration.registration_data === 'object' &&
                Object.keys(selectedRegistration.registration_data).length > 0 && (
                <div className="border-t pt-4">
                  <p className="text-sm font-medium text-muted-foreground mb-2">Custom Form Fields</p>
                  <div className="grid grid-cols-2 gap-4">
                    {Object.entries(selectedRegistration.registration_data as Record<string, unknown>)
                      .filter(([key]) => !['first_name', 'last_name', 'email', 'phone'].includes(key.toLowerCase()))
                      .map(([key, value]) => (
                        <div key={key}>
                          <p className="text-sm font-medium text-muted-foreground capitalize">
                            {key.replace(/_/g, ' ')}
                          </p>
                          <p>{String(value ?? '-')}</p>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EventRegistrations;
