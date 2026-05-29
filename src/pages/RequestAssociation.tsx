import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Building2, CheckCircle, Clock, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const requestSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  description: z.string().optional(),
  contact_email: z.string().email('Invalid email address'),
  contact_phone: z.string().optional(),
  website: z.string().url('Invalid URL').optional().or(z.literal('')),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().default('India'),
  postal_code: z.string().optional(),
});

type RequestFormData = z.infer<typeof requestSchema>;

export default function RequestAssociation() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [existingRequests, setExistingRequests] = useState<any[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(true);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RequestFormData>({
    resolver: zodResolver(requestSchema),
  });

  useEffect(() => {
    loadExistingRequests();
  }, []);

  const loadExistingRequests = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return;

      const { data, error } = await supabase
        .from('association_requests')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setExistingRequests(data || []);
    } catch (error: any) {
      console.error('Error loading requests:', error);
    } finally {
      setLoadingRequests(false);
    }
  };

  const onSubmit = async (data: RequestFormData) => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('association_requests')
        .insert([{
          user_id: user.id,
          name: data.name,
          description: data.description,
          contact_email: data.contact_email,
          contact_phone: data.contact_phone,
          website: data.website,
          address: data.address,
          city: data.city,
          state: data.state,
          country: data.country,
          postal_code: data.postal_code,
          status: 'pending',
        }]);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Your association request has been submitted for review',
      });

      loadExistingRequests();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to submit request',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
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

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto py-4 md:pl-20">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-2xl font-bold">Request Association</h1>
              <p className="text-sm text-muted-foreground">
                Submit a request to create your association
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto py-4 md:py-8 md:pl-20 max-w-4xl">
        {/* Existing Requests */}
        {!loadingRequests && existingRequests.length > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Your Requests</CardTitle>
              <CardDescription>Track the status of your association requests</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {existingRequests.map((request) => (
                <div key={request.id} className="flex items-start justify-between p-4 border rounded-lg">
                  <div className="space-y-1">
                    <div className="font-medium">{request.name}</div>
                    <div className="text-sm text-muted-foreground">
                      Submitted {new Date(request.created_at).toLocaleDateString()}
                    </div>
                    {request.admin_notes && (
                      <div className="text-sm mt-2 p-2 bg-muted rounded">
                        <strong>Admin Notes:</strong> {request.admin_notes}
                      </div>
                    )}
                  </div>
                  <div>{getStatusBadge(request.status)}</div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Request Form */}
        <Card>
          <CardHeader>
            <CardTitle>New Association Request</CardTitle>
            <CardDescription>
              Fill in the details below. An admin will review your request.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <Label htmlFor="name">Association Name *</Label>
                <Input {...register('name')} id="name" disabled={loading} />
                {errors.name && (
                  <p className="text-sm text-destructive mt-1">{errors.name.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea {...register('description')} id="description" disabled={loading} rows={3} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="contact_email">Contact Email *</Label>
                  <Input {...register('contact_email')} id="contact_email" type="email" disabled={loading} />
                  {errors.contact_email && (
                    <p className="text-sm text-destructive mt-1">{errors.contact_email.message}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="contact_phone">Contact Phone</Label>
                  <Input {...register('contact_phone')} id="contact_phone" type="tel" disabled={loading} />
                </div>
              </div>

              <div>
                <Label htmlFor="website">Website</Label>
                <Input {...register('website')} id="website" type="url" placeholder="https://" disabled={loading} />
                {errors.website && (
                  <p className="text-sm text-destructive mt-1">{errors.website.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="address">Address</Label>
                <Input {...register('address')} id="address" disabled={loading} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="city">City</Label>
                  <Input {...register('city')} id="city" disabled={loading} />
                </div>
                <div>
                  <Label htmlFor="state">State</Label>
                  <Input {...register('state')} id="state" disabled={loading} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="country">Country</Label>
                  <Input {...register('country')} id="country" disabled={loading} />
                </div>
                <div>
                  <Label htmlFor="postal_code">Postal Code</Label>
                  <Input {...register('postal_code')} id="postal_code" disabled={loading} />
                </div>
              </div>

              <div className="flex gap-4">
                <Button type="submit" disabled={loading}>
                  {loading ? 'Submitting...' : 'Submit Request'}
                </Button>
                <Button type="button" variant="outline" onClick={() => navigate('/dashboard')}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
