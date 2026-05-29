import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, Users, Shield, LogOut, Settings, FileText, Plus, Upload, Mail, MessageCircle, BarChart3, Calendar, UserPlus, Rss, Ticket, Database, Link2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { RoleSwitcher } from '@/components/RoleSwitcher';
import { BackButton } from '@/components/BackButton';

export default function AdminActions() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [stats, setStats] = useState({
    totalAssociations: 0,
    totalCompanies: 0,
    totalUsers: 0,
    pendingAssociationRequests: 0,
    pendingCompanyRequests: 0
  });
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    loadStats();
    loadProfile();
  }, []);

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

  const loadStats = async () => {
    try {
      // Load all counts in parallel
      const [
        { count: associationsCount },
        { count: companiesCount },
        { count: usersCount },
        { count: associationRequestsCount },
        { count: companyRequestsCount },
      ] = await Promise.all([
        supabase.from('associations').select('*', { count: 'exact', head: true }),
        supabase.from('companies').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('association_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('company_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      ]);

      setStats({
        totalAssociations: associationsCount || 0,
        totalCompanies: companiesCount || 0,
        totalUsers: usersCount || 0,
        pendingAssociationRequests: associationRequestsCount || 0,
        pendingCompanyRequests: companyRequestsCount || 0
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
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto py-4 md:pl-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BackButton fallbackPath="/dashboard" variant="ghost" />
            <div>
              <h1 className="text-2xl font-bold">Admin Actions</h1>
              <p className="text-sm text-muted-foreground">Manage Platform Resources</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <RoleSwitcher />
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
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto py-4 md:py-8 md:pl-20">
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-2">Quick Actions</h2>
          <p className="text-muted-foreground">
            Create and manage platform resources
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card 
            className="cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => navigate('/admin/associations')}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Associations</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-8 w-16 animate-pulse bg-muted rounded"></div>
              ) : (
                <>
                  <div className="text-2xl font-bold">{stats.totalAssociations}</div>
                  <p className="text-xs text-muted-foreground">Across platform</p>
                </>
              )}
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => navigate('/admin/companies')}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Companies</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-8 w-16 animate-pulse bg-muted rounded"></div>
              ) : (
                <>
                  <div className="text-2xl font-bold">{stats.totalCompanies}</div>
                  <p className="text-xs text-muted-foreground">All companies</p>
                </>
              )}
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => navigate('/admin/users')}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-8 w-16 animate-pulse bg-muted rounded"></div>
              ) : (
                <>
                  <div className="text-2xl font-bold">{stats.totalUsers}</div>
                  <p className="text-xs text-muted-foreground">Platform users</p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Admin Actions</CardTitle>
            <CardDescription>Manage platform resources</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Button 
                className="w-full relative" 
                onClick={() => navigate('/admin/requests')}
                variant={stats.pendingAssociationRequests > 0 ? 'default' : 'outline'}
              >
                <FileText className="w-4 h-4 mr-2" />
                Association Requests
                {stats.pendingAssociationRequests > 0 && (
                  <Badge className="ml-2 bg-destructive text-destructive-foreground">
                    {stats.pendingAssociationRequests}
                  </Badge>
                )}
              </Button>
              <Button 
                className="w-full relative" 
                onClick={() => navigate('/admin/company-requests')}
                variant={stats.pendingCompanyRequests > 0 ? 'default' : 'outline'}
              >
                <FileText className="w-4 h-4 mr-2" />
                Company Requests
                {stats.pendingCompanyRequests > 0 && (
                  <Badge className="ml-2 bg-destructive text-destructive-foreground">
                    {stats.pendingCompanyRequests}
                  </Badge>
                )}
              </Button>
              <Button variant="outline" className="w-full" onClick={() => navigate('/admin/associations')}>
                <Building2 className="w-4 h-4 mr-2" />
                Manage Associations
              </Button>
              <Button variant="outline" className="w-full" onClick={() => navigate('/admin/companies')}>
                <Building2 className="w-4 h-4 mr-2" />
                Manage Companies
              </Button>
              <Button variant="outline" className="w-full" onClick={() => navigate('/admin/users')}>
                <Users className="w-4 h-4 mr-2" />
                Manage Users
              </Button>
              <Button variant="outline" className="w-full" onClick={() => navigate('/admin/invitations')}>
                <UserPlus className="w-4 h-4 mr-2" />
                Member Invitations
              </Button>
              <Button variant="outline" className="w-full" onClick={() => navigate('/admin/email-lists')}>
                <Mail className="w-4 h-4 mr-2" />
                Email Lists
              </Button>
              <Button variant="outline" className="w-full" onClick={() => navigate('/admin/whatsapp-lists')}>
                <MessageCircle className="w-4 h-4 mr-2" />
                WhatsApp Lists
              </Button>
              <Button variant="outline" className="w-full" onClick={() => navigate('/admin/email-analytics')}>
                <BarChart3 className="w-4 h-4 mr-2" />
                Email Analytics
              </Button>
              <Button variant="outline" className="w-full" onClick={() => navigate('/admin')}>
                <BarChart3 className="w-4 h-4 mr-2" />
                Analytics Dashboard
              </Button>
              <Button variant="outline" className="w-full" onClick={() => navigate('/calendar')}>
                <Calendar className="w-4 h-4 mr-2" />
                Event Calendar
              </Button>
              <Button variant="outline" className="w-full" onClick={() => navigate('/admin/event-landing-pages')}>
                <FileText className="w-4 h-4 mr-2" />
                Event Landing Pages
              </Button>
              <Button variant="outline" className="w-full" onClick={() => navigate('/admin/coupons')}>
                <Ticket className="w-4 h-4 mr-2" />
                Coupon Management
              </Button>
              <Button variant="outline" className="w-full" onClick={() => navigate('/feed')}>
                <Rss className="w-4 h-4 mr-2" />
                Member Feed
              </Button>
              <Button variant="outline" className="w-full" onClick={() => navigate('/admin/member-connections')}>
                <Link2 className="w-4 h-4 mr-2" />
                Connection Requests
              </Button>
              <Button variant="outline" className="w-full" onClick={() => navigate('/admin/data-export')}>
                <Database className="w-4 h-4 mr-2" />
                Data Export
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Create Actions */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Quick Create</CardTitle>
            <CardDescription>Add new records to the platform</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button className="w-full" onClick={() => navigate('/admin/create-association')}>
                <Plus className="w-4 h-4 mr-2" />
                Create Association
              </Button>
              <Button className="w-full" onClick={() => navigate('/admin/create-company')}>
                <Plus className="w-4 h-4 mr-2" />
                Create Company
              </Button>
              <Button className="w-full" onClick={() => navigate('/admin/create-user')}>
                <Plus className="w-4 h-4 mr-2" />
                Create User
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Bulk Upload Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Bulk Upload</CardTitle>
            <CardDescription>Upload CSV files to create multiple records</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button variant="outline" className="w-full" onClick={() => navigate('/admin/bulk-upload-associations')}>
                <Upload className="w-4 h-4 mr-2" />
                Bulk Upload Associations
              </Button>
              <Button variant="outline" className="w-full" onClick={() => navigate('/admin/bulk-upload-companies')}>
                <Upload className="w-4 h-4 mr-2" />
                Bulk Upload Companies
              </Button>
              <Button variant="outline" className="w-full" onClick={() => navigate('/admin/bulk-upload-users')}>
                <Upload className="w-4 h-4 mr-2" />
                Bulk Upload Users
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
