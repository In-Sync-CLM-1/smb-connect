import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { CreateMemberInvitationDialog } from '@/components/admin/CreateMemberInvitationDialog';
import { BulkInviteMembersDialog } from '@/components/admin/BulkInviteMembersDialog';
import { InviteLinkSection } from '@/components/InviteLinkSection';
import { BackButton } from '@/components/BackButton';
import { Loader2, MoreVertical, RefreshCw, Ban, Mail, Calendar, User } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface Invitation {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  organization_id: string;
  organization_type: string;
  role: string;
  designation?: string;
  department?: string;
  status: string;
  created_at: string;
  expires_at: string;
  accepted_at?: string;
  revoked_at?: string;
}

export default function MemberInvitations() {
  const { user } = useAuth();
  const { role, userData } = useUserRole();
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    if (user && role && (role === 'admin' || role === 'platform-admin' || 
        (role === 'association' && userData?.association_id) || 
        (role === 'company' && userData?.company_id))) {
      loadInvitations();
    }
  }, [user, role, userData?.association_id, userData?.company_id]);

  const loadInvitations = async () => {
    if (!role) {
      console.log('No role available yet, skipping invitation load');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      let query = supabase
        .from('member_invitations' as any)
        .select('*')
        .order('created_at', { ascending: false });

      // Filter based on user role
      if (role === 'association') {
        if (!userData?.association_id) {
          console.log('No association_id available');
          setLoading(false);
          return;
        }
        query = query
          .eq('organization_type', 'association')
          .eq('organization_id', userData.association_id);
      } else if (role === 'company') {
        if (!userData?.company_id) {
          console.log('No company_id available');
          setLoading(false);
          return;
        }
        query = query
          .eq('organization_type', 'company')
          .eq('organization_id', userData.company_id);
      }
      // For admin roles, no filter needed (will fetch all)

      const { data, error } = await query;

      if (error) {
        console.error('Database error:', error);
        throw error;
      }
      
      console.log('Loaded invitations:', data?.length);
      setInvitations((data as any) || []);
    } catch (error: any) {
      console.error('Error loading invitations:', error);
      toast.error('Failed to load invitations: ' + (error.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async (invitationId: string) => {
    try {
      setActionLoading(invitationId);

      const { data, error } = await supabase.functions.invoke(
        'resend-member-invitation',
        {
          body: { invitation_id: invitationId },
        }
      );

      if (error) throw error;

      if (data.success) {
        toast.success('Invitation resent successfully');
        loadInvitations();
      }
    } catch (error: any) {
      console.error('Error resending invitation:', error);
      toast.error(error.message || 'Failed to resend invitation');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRevoke = async (invitationId: string) => {
    try {
      setActionLoading(invitationId);

      const { data, error } = await supabase
        .rpc('revoke_member_invitation' as any, {
          p_invitation_id: invitationId,
          p_reason: 'Revoked by admin',
        });

      if (error) throw error;

      if (data?.success) {
        toast.success('Invitation revoked successfully');
        loadInvitations();
      } else {
        toast.error(data?.error || 'Failed to revoke invitation');
      }
    } catch (error: any) {
      console.error('Error revoking invitation:', error);
      toast.error(error.message || 'Failed to revoke invitation');
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusBadge = (status: string, expiresAt: string) => {
    const isExpired = new Date(expiresAt) < new Date() && status === 'pending';
    
    if (isExpired) {
      return <Badge variant="secondary">Expired</Badge>;
    }

    switch (status) {
      case 'pending':
        return <Badge variant="default">Pending</Badge>;
      case 'accepted':
        return <Badge className="bg-green-500">Accepted</Badge>;
      case 'revoked':
        return <Badge variant="destructive">Revoked</Badge>;
      case 'expired':
        return <Badge variant="secondary">Expired</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const organizationId = role === 'association' ? userData?.association_id : userData?.company_id;
  const organizationType = role === 'association' ? 'association' : 'company';
  const fallbackPath = role === 'association' ? '/association' : role === 'company' ? '/company' : '/dashboard';

  return (
    <div className="container mx-auto p-6 pt-20 !pl-20 md:!pl-24 space-y-6">
      <div className="mb-6 relative z-[60]">
        <BackButton fallbackPath={fallbackPath} />
      </div>
      {organizationId && (
        <InviteLinkSection
          organizationId={organizationId}
          organizationType={organizationType as 'association' | 'company'}
        />
      )}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Member Invitations</CardTitle>
              <CardDescription>
                Manage pending and completed member invitations
              </CardDescription>
            </div>
            {organizationId && (
              <div className="flex gap-2">
                <BulkInviteMembersDialog
                  organizationId={organizationId}
                  organizationType={organizationType as 'company' | 'association'}
                  onSuccess={loadInvitations}
                />
                <CreateMemberInvitationDialog
                  organizationId={organizationId}
                  organizationType={organizationType as 'company' | 'association'}
                  onSuccess={loadInvitations}
                />
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {invitations.length === 0 ? (
            <div className="text-center py-12">
              <Mail className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No invitations yet</h3>
              <p className="text-muted-foreground mb-4">
                Start inviting members to join your organization
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invitations.map((invitation) => (
                    <TableRow key={invitation.id}>
                      <TableCell className="font-medium">{invitation.email}</TableCell>
                      <TableCell>
                        {invitation.first_name} {invitation.last_name}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {invitation.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(invitation.status, invitation.expires_at)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(invitation.created_at), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(invitation.expires_at), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell className="text-right">
                        {invitation.status === 'pending' && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={actionLoading === invitation.id}
                              >
                                {actionLoading === invitation.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <MoreVertical className="h-4 w-4" />
                                )}
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleResend(invitation.id)}>
                                <RefreshCw className="mr-2 h-4 w-4" />
                                Resend
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleRevoke(invitation.id)}
                                className="text-destructive"
                              >
                                <Ban className="mr-2 h-4 w-4" />
                                Revoke
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
