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

export default function CompanyMembers() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { userData } = useUserRole();
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalMembers: 0,
    onboardedByMe: 0,
  });

  useEffect(() => {
    if (userData?.company?.id) {
      loadMembers();
    }
  }, [userData]);

  const loadMembers = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      
      // Get members with profiles
      const { data: membersData, error } = await supabase
        .from('members')
        .select(`
          *,
          profiles:user_id (first_name, last_name, email)
        `)
        .eq('company_id', userData?.company?.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

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
        description: 'Failed to load members',
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
          <Button variant="ghost" onClick={() => navigate('/company')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </header>

      <main className="container mx-auto py-4 md:py-8 md:pl-20">
        <div className="space-y-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Company Members</h1>
            <p className="text-muted-foreground">
              View and manage your team at {userData?.company?.name}
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
                <p className="text-xs text-muted-foreground">In your company</p>
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
                  onClick={() => navigate('/company/bulk-upload-users')}
                >
                  Bulk Upload
                </Button>
              </CardContent>
            </Card>
          </div>

          <LoginActivityCard description="Daily logins by members in your company" />

          {/* Members Table */}
          <Card>
            <CardHeader>
              <CardTitle>Team Members</CardTitle>
              <CardDescription>
                All active members in your company
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
                      <TableHead>Role</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Designation</TableHead>
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
                        <TableCell className="capitalize">{member.role}</TableCell>
                        <TableCell>{member.department || 'N/A'}</TableCell>
                        <TableCell>{member.designation || 'N/A'}</TableCell>
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
