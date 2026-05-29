import { useState } from 'react';
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
import { ArrowLeft } from 'lucide-react';

const associationSchema = z.object({
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

type AssociationFormData = z.infer<typeof associationSchema>;

export default function CreateAssociation() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AssociationFormData>({
    resolver: zodResolver(associationSchema),
    defaultValues: {
      country: 'India',
    },
  });

  const onSubmit = async (data: AssociationFormData) => {
    try {
      setLoading(true);

      const { error } = await supabase
        .from('associations')
        .insert([{
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
          is_active: true,
        }]);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Association created successfully',
      });
      navigate('/admin/associations');
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create association',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 pl-20">
          <Button
            variant="ghost"
            onClick={() => navigate('/admin/associations')}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Associations
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 pl-20 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Create New Association</CardTitle>
            <CardDescription>Add a new association to the platform</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <Label htmlFor="name">Name *</Label>
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

              <div className="flex gap-4 pt-4">
                <Button type="submit" disabled={loading}>
                  {loading ? 'Creating...' : 'Create Association'}
                </Button>
                <Button type="button" variant="outline" onClick={() => navigate('/admin/associations')}>
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
