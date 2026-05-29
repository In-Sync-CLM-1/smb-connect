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

const functionarySchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  designation: z.string().min(2, 'Designation is required'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().optional(),
  bio: z.string().optional(),
  display_order: z.string().optional(),
});

type FunctionaryFormData = z.infer<typeof functionarySchema>;

interface AddFunctionaryDialogProps {
  associationId: string;
  functionary: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function AddFunctionaryDialog({ 
  associationId,
  functionary,
  open, 
  onOpenChange, 
  onSuccess 
}: AddFunctionaryDialogProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FunctionaryFormData>({
    resolver: zodResolver(functionarySchema),
    defaultValues: functionary ? {
      name: functionary.name,
      designation: functionary.designation,
      email: functionary.email || '',
      phone: functionary.phone || '',
      bio: functionary.bio || '',
      display_order: functionary.display_order?.toString() || '0',
    } : {
      display_order: '0',
    },
  });

  const onSubmit = async (data: FunctionaryFormData) => {
    try {
      setLoading(true);

      const functionaryData = {
        association_id: associationId,
        name: data.name,
        designation: data.designation,
        email: data.email || null,
        phone: data.phone || null,
        bio: data.bio || null,
        display_order: data.display_order ? parseInt(data.display_order) : 0,
        is_active: true,
      };

      if (functionary) {
        // Update existing
        const { error } = await supabase
          .from('key_functionaries')
          .update(functionaryData)
          .eq('id', functionary.id);

        if (error) throw error;
      } else {
        // Create new
        const { error } = await supabase
          .from('key_functionaries')
          .insert(functionaryData);

        if (error) throw error;
      }

      toast({
        title: 'Success',
        description: `Functionary ${functionary ? 'updated' : 'added'} successfully`,
      });
      
      reset();
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save functionary',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{functionary ? 'Edit' : 'Add'} Functionary</DialogTitle>
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
            <Label htmlFor="designation">Designation *</Label>
            <Input {...register('designation')} id="designation" placeholder="President, Secretary, etc." disabled={loading} />
            {errors.designation && (
              <p className="text-sm text-destructive mt-1">{errors.designation.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="email">Email</Label>
            <Input {...register('email')} id="email" type="email" disabled={loading} />
            {errors.email && (
              <p className="text-sm text-destructive mt-1">{errors.email.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="phone">Phone</Label>
            <Input {...register('phone')} id="phone" type="tel" disabled={loading} />
          </div>

          <div>
            <Label htmlFor="bio">Bio</Label>
            <Textarea {...register('bio')} id="bio" rows={3} disabled={loading} />
          </div>

          <div>
            <Label htmlFor="display_order">Display Order</Label>
            <Input {...register('display_order')} id="display_order" type="number" placeholder="0" disabled={loading} />
            <p className="text-xs text-muted-foreground mt-1">Lower numbers appear first</p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : functionary ? 'Update' : 'Add'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
