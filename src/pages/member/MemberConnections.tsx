import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ArrowLeft, Check, X, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { MobileNavigation } from '@/components/layout/MobileNavigation';

interface ConnectionWithDetails {
  id: string;
  status: string;
  message: string | null;
  created_at: string;
  sender: {
    id: string;
    user_id: string;
    profile: {
      first_name: string;
      last_name: string;
      avatar: string | null;
    };
    company: {
      name: string;
    } | null;
  };
  receiver: {
    id: string;
    user_id: string;
    profile: {
      first_name: string;
      last_name: string;
      avatar: string | null;
    };
    company: {
      name: string;
    } | null;
  };
}

export default function MemberConnections() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [currentMemberId, setCurrentMemberId] = useState<string | null>(null);
  const [connections, setConnections] = useState<ConnectionWithDetails[]>([]);
  const [pendingReceived, setPendingReceived] = useState<ConnectionWithDetails[]>([]);
  const [pendingSent, setPendingSent] = useState<ConnectionWithDetails[]>([]);

  // First, get the current user's member ID
  useEffect(() => {
    const loadCurrentMember = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return;

      const { data: memberDataArr } = await supabase
        .from('members')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .limit(1);
      const memberData = memberDataArr?.[0] || null;

      if (memberData) {
        setCurrentMemberId(memberData.id);
      }
    };

    loadCurrentMember();
  }, []);

  // Load connections when currentMemberId is available
  useEffect(() => {
    if (currentMemberId) {
      loadConnections();
    }
  }, [currentMemberId]);

  const loadConnections = async () => {
    try {
      setLoading(true);
      if (!currentMemberId) return;

      // First get connections using the correct member ID
      const { data: connectionsData, error: connectionsError } = await supabase
        .from('connections')
        .select('*')
        .or(`sender_id.eq.${currentMemberId},receiver_id.eq.${currentMemberId}`);

      if (connectionsError) throw connectionsError;

      // Batch fetch all member IDs involved in connections
      const allMemberIds = Array.from(new Set(
        (connectionsData || []).flatMap(conn => [conn.sender_id, conn.receiver_id])
      ));

      const { data: allMembers } = await supabase
        .from('members')
        .select('id, user_id, company:companies(name)')
        .in('id', allMemberIds);

      const membersById = (allMembers || []).reduce((acc: Record<string, any>, m: any) => {
        acc[m.id] = m;
        return acc;
      }, {} as Record<string, any>);

      // Batch fetch all profiles for these members
      const allUserIds = Array.from(new Set((allMembers || []).map(m => m.user_id)));

      const { data: allProfiles } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, avatar')
        .in('id', allUserIds);

      const profilesByUserId = (allProfiles || []).reduce((acc: Record<string, any>, p: any) => {
        acc[p.id] = p;
        return acc;
      }, {} as Record<string, any>);

      // Assemble connections with details (no per-connection queries)
      const connectionsWithDetails = (connectionsData || []).map(conn => {
        const senderMember = membersById[conn.sender_id];
        const receiverMember = membersById[conn.receiver_id];
        return {
          ...conn,
          sender: {
            ...senderMember,
            profile: senderMember ? profilesByUserId[senderMember.user_id] : null,
          },
          receiver: {
            ...receiverMember,
            profile: receiverMember ? profilesByUserId[receiverMember.user_id] : null,
          },
        };
      });

      const allConnections = connectionsWithDetails as ConnectionWithDetails[];
      
      // Accepted connections
      setConnections(allConnections.filter(c => c.status === 'accepted'));
      
      // Pending received (where I'm the receiver) - use currentMemberId
      setPendingReceived(
        allConnections.filter(c => c.status === 'pending' && c.receiver.id === currentMemberId)
      );
      
      // Pending sent (where I'm the sender) - use currentMemberId
      setPendingSent(
        allConnections.filter(c => c.status === 'pending' && c.sender.id === currentMemberId)
      );
    } catch (error: any) {
      console.error('Error loading connections:', error);
      toast({
        title: 'Error',
        description: 'Failed to load connections',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (connectionId: string) => {
    try {
      const { error } = await supabase
        .from('connections')
        .update({ status: 'accepted', responded_at: new Date().toISOString() })
        .eq('id', connectionId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Connection request accepted',
      });
      loadConnections();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to accept connection',
        variant: 'destructive',
      });
    }
  };

  const handleReject = async (connectionId: string) => {
    try {
      const { error } = await supabase
        .from('connections')
        .update({ status: 'rejected', responded_at: new Date().toISOString() })
        .eq('id', connectionId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Connection request rejected',
      });
      loadConnections();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to reject connection',
        variant: 'destructive',
      });
    }
  };

  const handleCancelRequest = async (connectionId: string) => {
    try {
      const { error } = await supabase
        .from('connections')
        .delete()
        .eq('id', connectionId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Connection request cancelled',
      });
      loadConnections();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to cancel request',
        variant: 'destructive',
      });
    }
  };

  const renderConnectionCard = (conn: ConnectionWithDetails, showActions?: 'accept' | 'cancel') => {
    // Use currentMemberId to determine the other person
    const otherPerson = conn.sender.id === currentMemberId ? conn.receiver : conn.sender;
    const fullName = `${otherPerson.profile.first_name} ${otherPerson.profile.last_name}`;
    const initials = `${otherPerson.profile.first_name[0]}${otherPerson.profile.last_name[0]}`;

    return (
      <Card 
        key={conn.id} 
        className="hover:shadow-lg transition-shadow cursor-pointer"
        onClick={() => navigate(`/profile/${otherPerson.user_id}`)}
      >
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <Avatar className="w-12 h-12">
              <AvatarImage src={otherPerson.profile.avatar || undefined} />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h3 className="font-semibold">{fullName}</h3>
              {otherPerson.company && (
                <p className="text-sm text-muted-foreground">{otherPerson.company.name}</p>
              )}
              {conn.message && (
                <p className="text-sm text-muted-foreground mt-2 italic">"{conn.message}"</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                {new Date(conn.created_at).toLocaleDateString()}
              </p>
            </div>
            {showActions && (
              <div 
                className="flex gap-2"
                onClick={(e) => e.stopPropagation()}
              >
                {showActions === 'accept' && (
                  <>
                    <Button size="sm" onClick={() => handleAccept(conn.id)}>
                      <Check className="w-4 h-4 mr-1" />
                      Accept
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleReject(conn.id)}>
                      <X className="w-4 h-4 mr-1" />
                      Reject
                    </Button>
                  </>
                )}
                {showActions === 'cancel' && (
                  <Button size="sm" variant="outline" onClick={() => handleCancelRequest(conn.id)}>
                    Cancel
                  </Button>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <header className="border-b bg-card">
        <div className="container mx-auto py-3 md:py-4 md:pl-20">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h1 className="text-lg md:text-xl font-bold">My Connections</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto py-4 md:py-8 md:pl-20">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">My Connections</h1>
            <p className="text-muted-foreground">Manage your professional network</p>
          </div>
          <Button onClick={() => navigate('/members')}>
            <Users className="w-4 h-4 mr-2" />
            Find Members
          </Button>
        </div>

        <Tabs defaultValue="connections" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="connections">
              Connections ({connections.length})
            </TabsTrigger>
            <TabsTrigger value="received">
              Requests ({pendingReceived.length})
            </TabsTrigger>
            <TabsTrigger value="sent">
              Sent ({pendingSent.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="connections" className="space-y-4 mt-6">
            {loading ? (
              <p>Loading...</p>
            ) : connections.length === 0 ? (
              <Card>
                <CardContent className="pt-6 text-center">
                  <p className="text-muted-foreground">No connections yet. Start connecting with other members!</p>
                </CardContent>
              </Card>
            ) : (
              connections.map(conn => renderConnectionCard(conn))
            )}
          </TabsContent>

          <TabsContent value="received" className="space-y-4 mt-6">
            {loading ? (
              <p>Loading...</p>
            ) : pendingReceived.length === 0 ? (
              <Card>
                <CardContent className="pt-6 text-center">
                  <p className="text-muted-foreground">No pending requests</p>
                </CardContent>
              </Card>
            ) : (
              pendingReceived.map(conn => renderConnectionCard(conn, 'accept'))
            )}
          </TabsContent>

          <TabsContent value="sent" className="space-y-4 mt-6">
            {loading ? (
              <p>Loading...</p>
            ) : pendingSent.length === 0 ? (
              <Card>
                <CardContent className="pt-6 text-center">
                  <p className="text-muted-foreground">No pending sent requests</p>
                </CardContent>
              </Card>
            ) : (
              pendingSent.map(conn => renderConnectionCard(conn, 'cancel'))
            )}
          </TabsContent>
        </Tabs>
      </main>
      
      <MobileNavigation />
    </div>
  );
}
