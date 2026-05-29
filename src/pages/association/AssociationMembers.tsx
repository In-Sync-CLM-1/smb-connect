import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useUserRole } from '@/hooks/useUserRole';
import { ArrowLeft, Users, TrendingUp, Upload } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { LoginActivityCard, fetchLastLogins } from '@/components/admin/LoginActivityCard';

export default function AssociationMembers() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { userData, loading: userLoading } = useUserRole();
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalMembers: 0,
    onboardedByMe: 0,
  });

  useEffect(() => {
    // Wait for user role to finish loading
    if (userLoading) {
      return;
    }

    const associationId = userData?.association?.id || userData?.association_id;
    
    if (!associationId) {
      toast({
        title: 'Error',
        description: 'No association found for your account',
        variant: 'destructive',
      });
      setLoading(false);
      return;
    }

    loadMembers();
  }, [userData, userLoading]);

  const loadMembers = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      
      const associationId = userData?.association?.id || userData?.association_id;
      
      if (!associationId) {
        throw new Error('No association ID found');
      }
      
      // Get all companies in association
      const { data: companies, error: companiesError } = await supabase
        .from('companies')
        .select('id')
        .eq('association_id', associationId)
        .eq('is_active', true);

      if (companiesError) {
        throw new Error(`Failed to load companies: ${companiesError.message}`);
      }

      if (!companies || companies.length === 0) {
        setLoading(false);
        return;
      }

      const companyIds = companies.map(c => c.id);

      // Get members with profiles and company info
      const { data: membersData, error: membersError } = await supabase
        .from('members')
        .select(`
          *,
          profiles(first_name, last_name, email),
          companies(name)
        `)
        .in('company_id', companyIds)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (membersError) {
        throw new Error(`Failed to load members: ${membersError.message}`);
      }

      const totalMembers = membersData?.length || 0;
      const onboardedByMe = membersData?.filter(m => m.created_by === user?.id).length || 0;

      const lastLogins = await fetchLastLogins((membersData || []).map(m => m.user_id));
      const enriched = (membersData || []).map(m => ({
        ...m,
        last_sign_in_at: lastLogins.get(m.user_id) ?? null,
      }));

      setMembers(enriched);
      setStats({
        totalMembers,
        onboardedByMe,
      });
    } catch (error: any) {
      console.error('Error loading members:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to load members',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto py-4 md:pl-20">
          <Button variant="ghost" onClick={() => navigate('/association/feed')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Feed
          </Button>
        </div>
      </header>

      <main className="container mx-auto py-4 md:py-8 md:pl-20">
        <div className="space-y-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Association Members</h1>
            <p className="text-muted-foreground">
              View and manage members across all companies in {userData?.association?.name}
            </p>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Members</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalMembers}</div>
                <p className="text-xs text-muted-foreground">Across all companies</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Onboarded by You</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.onboardedByMe}</div>
                <p className="text-xs text-muted-foreground">Members you added</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Quick Actions</CardTitle>
                <Upload className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => navigate('/association/bulk-upload-users')}
                >
                  Bulk Upload
                </Button>
              </CardContent>
            </Card>
          </div>

          <LoginActivityCard description="Daily logins by members across your association" />

          {/* Members Table */}
          <Card>
            <CardHeader>
              <CardTitle>All Members</CardTitle>
              <CardDescription>
                Members from all companies in your association
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="h-12 bg-muted animate-pulse rounded" />
                  ))}
                </div>
              ) : members.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No members found
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Joined Date</TableHead>
                      <TableHead>Last Logged In</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {members.map((member) => (
                      <TableRow key={member.id}>
                        <TableCell className="font-medium">
                          {member.profiles?.first_name} {member.profiles?.last_name}
                        </TableCell>
                        <TableCell>{member.profiles?.email}</TableCell>
                        <TableCell>{member.companies?.name || 'N/A'}</TableCell>
                        <TableCell className="capitalize">{member.role}</TableCell>
                        <TableCell>
                          {new Date(member.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {member.last_sign_in_at
                            ? new Date(member.last_sign_in_at).toLocaleString('en-IN', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : 'Never'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
