import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

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

interface EditAssociationDialogProps {
  association: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function EditAssociationDialog({ 
  association, 
  open, 
  onOpenChange, 
  onSuccess 
}: EditAssociationDialogProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AssociationFormData>({
    resolver: zodResolver(associationSchema),
    defaultValues: {
      name: association.name,
      description: association.description || '',
      contact_email: association.contact_email,
      contact_phone: association.contact_phone || '',
      website: association.website || '',
      address: association.address || '',
      city: association.city || '',
      state: association.state || '',
      country: association.country || 'India',
      postal_code: association.postal_code || '',
    },
  });

  const onSubmit = async (data: AssociationFormData) => {
    try {
      setLoading(true);
      const { error } = await supabase
        .from('associations')
        .update(data)
        .eq('id', association.id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Association updated successfully',
      });
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update association',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Association</DialogTitle>
        </DialogHeader>
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

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
