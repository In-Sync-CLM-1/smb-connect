import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ArrowLeft, CheckCircle, XCircle, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface AssociationRequest {
  id: string;
  user_id: string;
  name: string;
  description: string;
  contact_email: string;
  contact_phone: string;
  website: string;
  address: string;
  city: string;
  state: string;
  country: string;
  postal_code: string;
  status: string;
  admin_notes: string;
  created_at: string;
}

export default function AdminAssociationRequests() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [requests, setRequests] = useState<AssociationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewDialog, setReviewDialog] = useState<{ request: AssociationRequest | null; action: 'approve' | 'reject' | null }>({
    request: null,
    action: null,
  });
  const [adminNotes, setAdminNotes] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('association_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRequests(data || []);
    } catch (error: any) {
      console.error('Error loading requests:', error);
      toast({
        title: 'Error',
        description: 'Failed to load association requests',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async () => {
    if (!reviewDialog.request || !reviewDialog.action) return;

    try {
      setProcessing(true);
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) throw new Error('Not authenticated');

      if (reviewDialog.action === 'approve') {
        // Create the association
        const { data: newAssociation, error: associationError } = await supabase
          .from('associations')
          .insert({
            name: reviewDialog.request.name,
            description: reviewDialog.request.description,
            contact_email: reviewDialog.request.contact_email,
            contact_phone: reviewDialog.request.contact_phone,
            website: reviewDialog.request.website,
            address: reviewDialog.request.address,
            city: reviewDialog.request.city,
            state: reviewDialog.request.state,
            country: reviewDialog.request.country,
            postal_code: reviewDialog.request.postal_code,
            is_active: true,
          })
          .select()
          .single();

        if (associationError) throw associationError;

        // Make the user an association admin
        const { error: managerError } = await supabase
          .from('association_managers')
          .insert({
            user_id: reviewDialog.request.user_id,
            association_id: newAssociation.id,
            role: 'owner',
            is_active: true,
          });

        if (managerError) throw managerError;
      }

      // Update the request status
      const { error: updateError } = await supabase
        .from('association_requests')
        .update({
          status: reviewDialog.action === 'approve' ? 'approved' : 'rejected',
          admin_notes: adminNotes,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', reviewDialog.request.id);

      if (updateError) throw updateError;

      toast({
        title: 'Success',
        description: `Request ${reviewDialog.action === 'approve' ? 'approved' : 'rejected'} successfully`,
      });

      setReviewDialog({ request: null, action: null });
      setAdminNotes('');
      loadRequests();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to process request',
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case 'approved':
        return <Badge variant="default"><CheckCircle className="w-3 h-3 mr-1" />Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto py-4 md:pl-20">
          <Button
            variant="ghost"
            onClick={() => navigate('/admin')}
            className="mb-2"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </header>

      <main className="container mx-auto py-4 md:py-8 md:pl-20">
        <div className="mb-8">
          <h2 className="text-2xl font-bold">Association Requests</h2>
          <p className="text-muted-foreground">
            {requests.length} total requests
          </p>
        </div>

        <div className="space-y-4">
          {requests.map((request) => (
            <Card key={request.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle>{request.name}</CardTitle>
                    <CardDescription>
                      Submitted {new Date(request.created_at).toLocaleDateString()}
                    </CardDescription>
                  </div>
                  {getStatusBadge(request.status)}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {request.description && (
                    <p className="text-sm text-muted-foreground">{request.description}</p>
                  )}
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <strong>Email:</strong> {request.contact_email}
                    </div>
                    {request.contact_phone && (
                      <div>
                        <strong>Phone:</strong> {request.contact_phone}
                      </div>
                    )}
                    {request.city && (
                      <div>
                        <strong>Location:</strong> {request.city}
                        {request.state && `, ${request.state}`}
                      </div>
                    )}
                    {request.website && (
                      <div>
                        <strong>Website:</strong> {request.website}
                      </div>
                    )}
                  </div>
                  {request.admin_notes && (
                    <div className="mt-4 p-3 bg-muted rounded">
                      <strong className="text-sm">Admin Notes:</strong>
                      <p className="text-sm mt-1">{request.admin_notes}</p>
                    </div>
                  )}
                  {request.status === 'pending' && (
                    <div className="flex gap-2 mt-4">
                      <Button
                        size="sm"
                        onClick={() => setReviewDialog({ request, action: 'approve' })}
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => setReviewDialog({ request, action: 'reject' })}
                      >
                        <XCircle className="w-4 h-4 mr-2" />
                        Reject
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>

      {/* Review Dialog */}
      <Dialog 
        open={!!reviewDialog.request} 
        onOpenChange={(open) => !open && setReviewDialog({ request: null, action: null })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reviewDialog.action === 'approve' ? 'Approve' : 'Reject'} Request
            </DialogTitle>
            <DialogDescription>
              {reviewDialog.action === 'approve' 
                ? 'This will create the association and make the user an association admin.'
                : 'This will reject the association request.'
              }
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label htmlFor="admin_notes">Admin Notes (Optional)</Label>
            <Textarea
              id="admin_notes"
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              placeholder="Add notes for the user..."
              rows={3}
              disabled={processing}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setReviewDialog({ request: null, action: null })}
              disabled={processing}
            >
              Cancel
            </Button>
            <Button
              onClick={handleReview}
              disabled={processing}
              variant={reviewDialog.action === 'approve' ? 'default' : 'destructive'}
            >
              {processing ? 'Processing...' : reviewDialog.action === 'approve' ? 'Approve' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
