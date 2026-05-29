import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, Users, MessageSquare, TrendingUp, LogOut, Building, Settings, Calendar, IndianRupee } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useUserRole } from '@/hooks/useUserRole';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface RegisteredEvent {
  id: string;
  created_at: string;
  final_amount: number | null;
  landing_page: {
    id: string;
    title: string;
    slug: string;
    event_date: string | null;
    event_venue: string | null;
  } | null;
}

export default function MemberDashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { userData } = useUserRole();
  const [profile, setProfile] = useState<any>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [registeredEvents, setRegisteredEvents] = useState<RegisteredEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);

  useEffect(() => {
    loadProfile();
  }, []);

  useEffect(() => {
    if (currentUserId) {
      loadRegisteredEvents(currentUserId, profile?.email);
    }
  }, [currentUserId, profile?.email]);

  const loadRegisteredEvents = async (userId: string, email?: string) => {
    try {
      // Match either user_id (set during fulfillment) or email (fallback for older rows)
      const filters = email
        ? `user_id.eq.${userId},email.eq.${email}`
        : `user_id.eq.${userId}`;
      const { data, error } = await supabase
        .from('event_registrations')
        .select(`
          id,
          created_at,
          final_amount,
          landing_page:event_landing_pages (
            id,
            title,
            slug,
            event_date,
            event_venue
          )
        `)
        .or(filters)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setRegisteredEvents((data ?? []) as unknown as RegisteredEvent[]);
    } catch (err) {
      console.error('Error loading registered events:', err);
    } finally {
      setEventsLoading(false);
    }
  };

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

      // Load member data to check company affiliation (use limit(1) to handle duplicate member records)
      const { data: memberDataArr } = await supabase
        .from('members')
        .select('*, company:companies(*)')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .limit(1);
      const memberData = memberDataArr?.[0] || null;

      if (memberData?.company) {
        // Member has a company
        setProfile((prev: any) => ({ ...prev, company: memberData.company }));
      }
    } catch (error: any) {
      console.error('Error loading profile:', error);
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
        <div className="container mx-auto py-4 pl-14 md:pl-20 lg:pl-24 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-2xl font-bold">SMB Connect</h1>
              <p className="text-sm text-muted-foreground">Member Dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
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
      <main className="container mx-auto py-4 md:py-8 pl-14 md:pl-20 lg:pl-24">
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-2">
            Welcome back, {profile?.first_name || 'User'}!
          </h2>
          <p className="text-muted-foreground">
            {profile?.company 
              ? `You're part of ${profile.company.name}` 
              : 'Independent member - Connect with others in your network'}
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Companies</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
              <p className="text-xs text-muted-foreground">In your network</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Connections</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
              <p className="text-xs text-muted-foreground">Active connections</p>
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

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Growth</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">+0%</div>
              <p className="text-xs text-muted-foreground">From last month</p>
            </CardContent>
          </Card>
        </div>

        {/* Your Registered Events */}
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              <CardTitle>Your Registered Events</CardTitle>
            </div>
            <CardDescription>Events you've signed up for, with payment details</CardDescription>
          </CardHeader>
          <CardContent>
            {eventsLoading ? (
              <div className="space-y-3">
                {[1, 2].map(i => (
                  <div key={i} className="h-16 animate-pulse bg-muted rounded" />
                ))}
              </div>
            ) : registeredEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">
                You haven't registered for any events yet. Browse events to find one to join.
              </p>
            ) : (
              <div className="space-y-3">
                {registeredEvents.map(reg => {
                  const lp = reg.landing_page;
                  const paid = (reg.final_amount ?? 0) > 0;
                  return (
                    <div
                      key={reg.id}
                      className="flex items-center justify-between gap-4 p-3 border rounded-lg hover:bg-muted/40 transition-colors cursor-pointer"
                      onClick={() => lp?.slug && window.open(`/event/${lp.slug}`, '_blank')}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-medium truncate">{lp?.title ?? 'Event'}</div>
                        <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                          {lp?.event_date && (
                            <span className="inline-flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(lp.event_date).toLocaleDateString('en-IN', {
                                day: 'numeric', month: 'short', year: 'numeric',
                              })}
                            </span>
                          )}
                          {lp?.event_venue && <span>{lp.event_venue}</span>}
                          <span>Registered {new Date(reg.created_at).toLocaleDateString('en-IN', {
                            day: 'numeric', month: 'short',
                          })}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        {paid ? (
                          <>
                            <div className="font-semibold text-green-600 inline-flex items-center">
                              <IndianRupee className="h-3.5 w-3.5" />{(reg.final_amount as number).toLocaleString('en-IN')}
                            </div>
                            <div className="text-[10px] uppercase tracking-wide text-green-600 font-medium">Paid</div>
                          </>
                        ) : (
                          <div className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Free</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Explore SMB Connect</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Button className="w-full" onClick={() => navigate('/feed')}>
                <MessageSquare className="w-4 h-4 mr-2" />
                Member Feed
              </Button>
              <Button variant="outline" className="w-full" onClick={() => navigate('/messages')}>
                <MessageSquare className="w-4 h-4 mr-2" />
                Messages
              </Button>
              <Button variant="outline" className="w-full" onClick={() => navigate('/members')}>
                <Users className="w-4 h-4 mr-2" />
                Find Members
              </Button>
              <Button variant="outline" className="w-full" onClick={() => navigate('/member/browse-companies')}>
                <Building2 className="w-4 h-4 mr-2" />
                Browse Companies
              </Button>
              <Button variant="outline" className="w-full" onClick={() => navigate('/member/browse-associations')}>
                <Building className="w-4 h-4 mr-2" />
                Browse Associations
              </Button>
              <Button variant="outline" className="w-full" onClick={() => navigate('/connections')}>
                <Users className="w-4 h-4 mr-2" />
                My Connections
              </Button>
              <Button variant="outline" className="w-full" onClick={() => navigate(`/profile/${userData?.user_id}`)}>
                <Users className="w-4 h-4 mr-2" />
                My Profile
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
