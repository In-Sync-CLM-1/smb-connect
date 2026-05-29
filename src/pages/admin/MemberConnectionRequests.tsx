import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { BackButton } from '@/components/BackButton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, Search, Download, Users, Clock, CheckCircle, XCircle, Link2 } from 'lucide-react';
import { format } from 'date-fns';

interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  avatar: string | null;
}

interface Member {
  id: string;
  user_id: string;
  company: { name: string } | null;
}

interface ConnectionRow {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: string;
  message: string | null;
  created_at: string;
  responded_at: string | null;
  sender: Member & { profile: Profile | null };
  receiver: Member & { profile: Profile | null };
}

interface LeaderboardEntry {
  memberId: string;
  name: string;
  company: string;
  avatar: string | null;
  totalSent: number;
  accepted: number;
  pending: number;
  rejected: number;
}

const STATUS_OPTIONS = ['all', 'pending', 'accepted', 'rejected', 'blocked'] as const;

export default function MemberConnectionRequests() {
  const [connections, setConnections] = useState<ConnectionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    loadConnections();
  }, []);

  const loadConnections = async () => {
    try {
      setLoading(true);

      const { data: connectionsData, error } = await supabase
        .from('connections')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (!connectionsData || connectionsData.length === 0) {
        setConnections([]);
        return;
      }

      // Batch-fetch members
      const allMemberIds = Array.from(new Set(
        connectionsData.flatMap(c => [c.sender_id, c.receiver_id])
      ));
      const { data: membersData } = await supabase
        .from('members')
        .select('id, user_id, company:companies(name)')
        .in('id', allMemberIds);

      const membersById = (membersData || []).reduce<Record<string, any>>((acc, m) => {
        acc[m.id] = m;
        return acc;
      }, {});

      // Batch-fetch profiles
      const allUserIds = Array.from(new Set((membersData || []).map((m: any) => m.user_id)));
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, avatar')
        .in('id', allUserIds);

      const profilesByUserId = (profilesData || []).reduce<Record<string, Profile>>((acc, p) => {
        acc[p.id] = p;
        return acc;
      }, {});

      const assembled: ConnectionRow[] = connectionsData.map(conn => {
        const senderMember = membersById[conn.sender_id];
        const receiverMember = membersById[conn.receiver_id];
        return {
          ...conn,
          sender: {
            ...(senderMember || { id: conn.sender_id, user_id: '', company: null }),
            profile: senderMember ? (profilesByUserId[senderMember.user_id] ?? null) : null,
          },
          receiver: {
            ...(receiverMember || { id: conn.receiver_id, user_id: '', company: null }),
            profile: receiverMember ? (profilesByUserId[receiverMember.user_id] ?? null) : null,
          },
        };
      });

      setConnections(assembled);
    } catch (err: any) {
      console.error('Error loading connections:', err);
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(() => ({
    total: connections.length,
    pending: connections.filter(c => c.status === 'pending').length,
    accepted: connections.filter(c => c.status === 'accepted').length,
    rejected: connections.filter(c => c.status === 'rejected').length,
    blocked: connections.filter(c => c.status === 'blocked').length,
  }), [connections]);

  // Leaderboard: top senders
  const leaderboard = useMemo<LeaderboardEntry[]>(() => {
    const byMember: Record<string, LeaderboardEntry> = {};
    connections.forEach(conn => {
      const sid = conn.sender_id;
      if (!byMember[sid]) {
        const name = conn.sender.profile
          ? `${conn.sender.profile.first_name} ${conn.sender.profile.last_name}`
          : 'Unknown';
        byMember[sid] = {
          memberId: sid,
          name,
          company: conn.sender.company?.name ?? '',
          avatar: conn.sender.profile?.avatar ?? null,
          totalSent: 0,
          accepted: 0,
          pending: 0,
          rejected: 0,
        };
      }
      byMember[sid].totalSent++;
      if (conn.status === 'accepted') byMember[sid].accepted++;
      else if (conn.status === 'pending') byMember[sid].pending++;
      else if (conn.status === 'rejected') byMember[sid].rejected++;
    });
    return Object.values(byMember)
      .sort((a, b) => b.totalSent - a.totalSent)
      .slice(0, 20);
  }, [connections]);

  const filtered = useMemo(() => {
    return connections.filter(conn => {
      if (statusFilter !== 'all' && conn.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const senderName = `${conn.sender.profile?.first_name ?? ''} ${conn.sender.profile?.last_name ?? ''}`.toLowerCase();
        const receiverName = `${conn.receiver.profile?.first_name ?? ''} ${conn.receiver.profile?.last_name ?? ''}`.toLowerCase();
        const senderCompany = (conn.sender.company?.name ?? '').toLowerCase();
        const receiverCompany = (conn.receiver.company?.name ?? '').toLowerCase();
        if (
          !senderName.includes(q) &&
          !receiverName.includes(q) &&
          !senderCompany.includes(q) &&
          !receiverCompany.includes(q)
        ) return false;
      }
      return true;
    });
  }, [connections, statusFilter, search]);

  const exportCSV = () => {
    const headers = ['Sender Name', 'Sender Company', 'Receiver Name', 'Receiver Company', 'Status', 'Message', 'Sent At', 'Responded At'];
    const rows = filtered.map(c => [
      `${c.sender.profile?.first_name ?? ''} ${c.sender.profile?.last_name ?? ''}`.trim(),
      c.sender.company?.name ?? '',
      `${c.receiver.profile?.first_name ?? ''} ${c.receiver.profile?.last_name ?? ''}`.trim(),
      c.receiver.company?.name ?? '',
      c.status,
      c.message ?? '',
      format(new Date(c.created_at), 'yyyy-MM-dd HH:mm:ss'),
      c.responded_at ? format(new Date(c.responded_at), 'yyyy-MM-dd HH:mm:ss') : '',
    ].map(v => v.includes(',') || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v));

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `member-connections-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportLeaderboardCSV = () => {
    const headers = ['#', 'Member Name', 'Company', 'Total Sent', 'Accepted', 'Pending', 'Rejected'];
    const rows = leaderboard.map((e, i) => [
      String(i + 1), e.name, e.company,
      String(e.totalSent), String(e.accepted), String(e.pending), String(e.rejected),
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `connect-requests-report-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':   return <Badge variant="secondary">Pending</Badge>;
      case 'accepted':  return <Badge className="bg-green-600 text-white">Accepted</Badge>;
      case 'rejected':  return <Badge variant="destructive">Rejected</Badge>;
      case 'blocked':   return <Badge variant="outline" className="border-orange-500 text-orange-600">Blocked</Badge>;
      default:          return <Badge variant="outline">{status}</Badge>;
    }
  };

  const MemberCell = ({ member }: { member: ConnectionRow['sender'] }) => {
    const name = member.profile
      ? `${member.profile.first_name} ${member.profile.last_name}`
      : 'Unknown';
    const initials = member.profile
      ? `${member.profile.first_name?.[0] ?? ''}${member.profile.last_name?.[0] ?? ''}`
      : '?';
    return (
      <div className="flex items-center gap-2">
        <Avatar className="h-7 w-7">
          <AvatarImage src={member.profile?.avatar ?? undefined} />
          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
        </Avatar>
        <div>
          <p className="text-sm font-medium leading-none">{name}</p>
          {member.company && (
            <p className="text-xs text-muted-foreground">{member.company.name}</p>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="container mx-auto p-6 pt-20 !pl-20 md:!pl-24 space-y-6">
      <div className="mb-4 relative z-[60]">
        <BackButton fallbackPath="/admin/actions" />
      </div>

      <div>
        <h1 className="text-2xl font-bold">Member Connection Requests</h1>
        <p className="text-muted-foreground text-sm">All connection requests across the platform</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <Link2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pending}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Accepted</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.accepted}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rejected / Blocked</CardTitle>
            <XCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.rejected + stats.blocked}</div>
          </CardContent>
        </Card>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Tabs defaultValue="report">
          <TabsList>
            <TabsTrigger value="report">Connect Requests Report</TabsTrigger>
            <TabsTrigger value="all">All Requests</TabsTrigger>
          </TabsList>

          {/* ── LEADERBOARD TAB ── */}
          <TabsContent value="report" className="space-y-4 pt-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    Connect Requests Report
                  </CardTitle>
                  <CardDescription>Top 20 users by connect requests sent (all time)</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={exportLeaderboardCSV} disabled={leaderboard.length === 0}>
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                {leaderboard.length === 0 ? (
                  <p className="text-center py-12 text-muted-foreground">No connection requests found.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">#</TableHead>
                        <TableHead>Member Name</TableHead>
                        <TableHead className="text-center text-green-600">Total Sent</TableHead>
                        <TableHead className="text-center text-green-600">Accepted</TableHead>
                        <TableHead className="text-center text-orange-500">Pending</TableHead>
                        <TableHead className="text-center text-destructive">Rejected</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {leaderboard.map((entry, i) => {
                        const initials = entry.name !== 'Unknown'
                          ? entry.name.split(' ').map(n => n[0]).join('').slice(0, 2)
                          : '?';
                        return (
                          <TableRow key={entry.memberId}>
                            <TableCell className="font-medium text-muted-foreground">{i + 1}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Avatar className="h-7 w-7">
                                  <AvatarImage src={entry.avatar ?? undefined} />
                                  <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="text-sm font-medium">{entry.name}</p>
                                  {entry.company && (
                                    <p className="text-xs text-muted-foreground">{entry.company}</p>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-center font-semibold text-green-600">{entry.totalSent}</TableCell>
                            <TableCell className="text-center text-green-600">{entry.accepted}</TableCell>
                            <TableCell className="text-center text-orange-500">{entry.pending}</TableCell>
                            <TableCell className="text-center text-destructive">{entry.rejected}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── ALL REQUESTS TAB ── */}
          <TabsContent value="all" className="space-y-4 pt-2">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or company..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map(s => (
                    <SelectItem key={s} value={s} className="capitalize">
                      {s === 'all' ? 'All Statuses' : s.charAt(0).toUpperCase() + s.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={exportCSV} disabled={filtered.length === 0}>
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>

            {filtered.length === 0 ? (
              <Card>
                <CardContent className="py-16 text-center text-muted-foreground">
                  {search || statusFilter !== 'all' ? 'No connections match your filters.' : 'No connection requests found.'}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Sender</TableHead>
                        <TableHead>Receiver</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Message</TableHead>
                        <TableHead>Sent</TableHead>
                        <TableHead>Responded</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map(conn => (
                        <TableRow key={conn.id}>
                          <TableCell><MemberCell member={conn.sender} /></TableCell>
                          <TableCell><MemberCell member={conn.receiver} /></TableCell>
                          <TableCell>{getStatusBadge(conn.status)}</TableCell>
                          <TableCell className="max-w-[200px]">
                            {conn.message ? (
                              <span className="text-sm text-muted-foreground truncate block" title={conn.message}>
                                {conn.message}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                            {format(new Date(conn.created_at), 'MMM d, yyyy')}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                            {conn.responded_at ? format(new Date(conn.responded_at), 'MMM d, yyyy') : '—'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
            <p className="text-xs text-muted-foreground">
              Showing {filtered.length} of {stats.total} connection requests
            </p>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
