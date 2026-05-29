import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useUserRole } from '@/hooks/useUserRole';
import { ArrowLeft, Send, Mail, Trash2 } from 'lucide-react';
import { BulkInviteCompaniesDialog } from '@/components/admin/BulkInviteCompaniesDialog';
import { InviteLinkSection } from '@/components/InviteLinkSection';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

export default function AssociationInvitations() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { userData, loading: userLoading } = useUserRole();
  const [invitations, setInvitations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [associationId, setAssociationId] = useState<string | null>(null);
  const [associationName, setAssociationName] = useState<string>('');
  const [formData, setFormData] = useState({
    companyName: '',
    email: '',
  });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedInvitation, setSelectedInvitation] = useState<any>(null);

  useEffect(() => {
    const initializeAssociation = async () => {
      if (userLoading) return;

      // For platform-admin or admin users without association context, get first association
      if ((userData?.type === 'platform-admin' || userData?.type === 'admin') && !userData?.association?.id) {
        try {
          const { data: associations, error } = await supabase
            .from('associations')
            .select('id, name')
            .eq('is_active', true)
            .limit(1)
            .single();

          if (!error && associations) {
            setAssociationId(associations.id);
            setAssociationName(associations.name);
          }
        } catch (error) {
          console.error('Error fetching association:', error);
        }
      } else if (userData?.association?.id) {
        setAssociationId(userData.association.id);
        setAssociationName(userData.association.name || '');
      }
    };

    initializeAssociation();
  }, [userData, userLoading]);

  useEffect(() => {
    if (associationId) {
      loadInvitations();
    }
  }, [associationId]);

  // Show loading state while user data is being fetched
  if (userLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const loadInvitations = async () => {
    if (!associationId) return;
    
    try {
      const { data, error } = await supabase
        .from('company_invitations')
        .select('*')
        .eq('association_id', associationId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInvitations(data || []);
    } catch (error: any) {
      console.error('Error loading invitations:', error);
      toast({
        title: 'Error',
        description: 'Failed to load invitations',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSendInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.companyName || !formData.email) {
      toast({
        title: 'Error',
        description: 'Please fill in all fields',
        variant: 'destructive',
      });
      return;
    }

    if (!associationId) {
      toast({
        title: 'Error',
        description: 'Association not found',
        variant: 'destructive',
      });
      return;
    }

    setSending(true);

    try {
      // Get current user for invited_by field
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      
      // Generate unique token
      const token = crypto.randomUUID();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

      // Create invitation record
      const { data: invitation, error: invitationError } = await supabase
        .from('company_invitations')
        .insert({
          association_id: associationId,
          company_name: formData.companyName,
          email: formData.email,
          token,
          expires_at: expiresAt.toISOString(),
          status: 'pending',
          invited_by: user?.id,
        })
        .select()
        .single();

      if (invitationError) throw invitationError;

      // Get association manager email for reply-to
      const { data: profile } = await supabase
        .from('profiles')
        .select('first_name, last_name')
        .eq('id', user?.id)
        .single();

      // Send invitation email using edge function
      const { data: emailData, error: emailError } = await supabase.functions.invoke('send-company-invitation', {
        body: {
          invitationId: invitation.id,
          companyName: formData.companyName,
          recipientEmail: formData.email,
          invitedByName: profile ? `${profile.first_name} ${profile.last_name}` : 'Association Admin',
          invitedByEmail: user?.email || '',
          associationName: associationName,
          token,
        },
      });

      if (emailError) {
        throw new Error(`Failed to send email: ${emailError.message}`);
      }

      // Check if the edge function returned an error in the response
      if (emailData?.error) {
        throw new Error(emailData.error);
      }

      toast({
        title: 'Success',
        description: 'Invitation sent successfully! The recipient will receive an email shortly.',
      });

      // Reset form and reload invitations
      setFormData({ companyName: '', email: '' });
      loadInvitations();
    } catch (error: any) {
      console.error('Error sending invitation:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to send invitation',
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  const handleDeleteInvitation = async () => {
    if (!selectedInvitation) return;

    setDeleting(selectedInvitation.id);
    
    try {
      const { error } = await supabase
        .from('company_invitations')
        .delete()
        .eq('id', selectedInvitation.id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Invitation deleted successfully',
      });

      loadInvitations();
    } catch (error: any) {
      console.error('Error deleting invitation:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete invitation',
        variant: 'destructive',
      });
    } finally {
      setDeleting(null);
      setDeleteDialogOpen(false);
      setSelectedInvitation(null);
    }
  };

  const openDeleteDialog = (invitation: any) => {
    setSelectedInvitation(invitation);
    setDeleteDialogOpen(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-50">Pending</Badge>;
      case 'accepted':
        return <Badge variant="outline" className="bg-green-50">Accepted</Badge>;
      case 'expired':
        return <Badge variant="outline" className="bg-red-50">Expired</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto py-4 md:pl-20">
          <Button variant="ghost" onClick={() => navigate('/association')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </header>

      <main className="container mx-auto py-4 md:py-8 md:pl-20">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Invite Link */}
          {associationId && (
            <InviteLinkSection
              organizationId={associationId}
              organizationType="association"
            />
          )}

          {/* Send Invitation Form */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Send className="w-5 h-5" />
                    Send Company Invitation
                  </CardTitle>
                  <CardDescription>
                    Invite companies to join {userData?.association?.name}
                  </CardDescription>
                </div>
                {associationId && (
                  <BulkInviteCompaniesDialog
                    associationId={associationId}
                    onSuccess={loadInvitations}
                  />
                )}
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSendInvitation} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="companyName">Company Name</Label>
                  <Input
                    id="companyName"
                    value={formData.companyName}
                    onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                    placeholder="Enter company name"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="company@example.com"
                    required
                  />
                </div>
                <Button type="submit" disabled={sending || userLoading}>
                  <Mail className="w-4 h-4 mr-2" />
                  {sending ? 'Sending...' : 'Send Invitation'}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Invitations List */}
          <Card>
            <CardHeader>
              <CardTitle>Invitation History</CardTitle>
              <CardDescription>
                View all company invitations and their status
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-12 bg-muted animate-pulse rounded" />
                  ))}
                </div>
              ) : invitations.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No invitations sent yet
                </div>
              ) : (
                  <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Company Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Sent Date</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invitations.map((invitation) => (
                      <TableRow key={invitation.id}>
                        <TableCell className="font-medium">
                          {invitation.company_name}
                        </TableCell>
                        <TableCell>{invitation.email}</TableCell>
                        <TableCell>{getStatusBadge(invitation.status)}</TableCell>
                        <TableCell>
                          {new Date(invitation.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openDeleteDialog(invitation)}
                            disabled={deleting === invitation.id}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Invitation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the invitation for{' '}
              <span className="font-semibold">{selectedInvitation?.company_name}</span>?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteInvitation}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
