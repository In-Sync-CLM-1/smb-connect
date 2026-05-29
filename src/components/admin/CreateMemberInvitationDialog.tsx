import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, UserPlus, Mail } from 'lucide-react';
import { toast } from 'sonner';

const invitationSchema = z.object({
  email: z.string().email('Invalid email address'),
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  role: z.enum(['member', 'admin', 'owner']),
  designation: z.string().optional(),
  department: z.string().optional(),
});

type InvitationFormData = z.infer<typeof invitationSchema>;

interface CreateMemberInvitationDialogProps {
  organizationId: string;
  organizationType: 'company' | 'association';
  onSuccess?: () => void;
}

export function CreateMemberInvitationDialog({
  organizationId,
  organizationType,
  onSuccess,
}: CreateMemberInvitationDialogProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
  } = useForm<InvitationFormData>({
    resolver: zodResolver(invitationSchema),
    defaultValues: {
      role: 'member',
    },
  });

  const selectedRole = watch('role');

  const onSubmit = async (data: InvitationFormData) => {
    if (!user) return;

    try {
      setSubmitting(true);

      const { data: result, error } = await supabase.functions.invoke(
        'create-member-invitation',
        {
          body: {
            email: data.email,
            first_name: data.first_name,
            last_name: data.last_name,
            organization_id: organizationId,
            organization_type: organizationType,
            role: data.role,
            designation: data.designation,
            department: data.department,
          },
        }
      );

      // Handle edge function errors (including 409 conflicts)
      if (error) {
        // Try to get the specific error message from the response
        let errorMessage = 'Failed to send invitation';
        
        if (result && typeof result === 'object' && 'error' in result) {
          errorMessage = result.error;
        } else if (error.message) {
          errorMessage = error.message;
        }
        
        toast.error(errorMessage);
        return;
      }

      if (result && result.success) {
        toast.success('Invitation sent successfully!', {
          description: `An email has been sent to ${data.email}`,
        });
        reset();
        setOpen(false);
        onSuccess?.();
      } else if (result && result.error) {
        toast.error(result.error);
      } else {
        toast.error('Failed to send invitation');
      }
    } catch (err: any) {
      console.error('Error creating invitation:', err);
      toast.error(err.message || 'Failed to send invitation');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="mr-2 h-4 w-4" />
          Invite Member
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Invite New Member</DialogTitle>
          <DialogDescription>
            Send an invitation email to add a new member to your organization.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email Address *</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                className="pl-10"
                placeholder="member@example.com"
                {...register('email')}
              />
            </div>
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="first_name">First Name *</Label>
              <Input
                id="first_name"
                placeholder="John"
                {...register('first_name')}
              />
              {errors.first_name && (
                <p className="text-sm text-destructive">{errors.first_name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="last_name">Last Name *</Label>
              <Input
                id="last_name"
                placeholder="Doe"
                {...register('last_name')}
              />
              {errors.last_name && (
                <p className="text-sm text-destructive">{errors.last_name.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Role *</Label>
            <Select
              value={selectedRole}
              onValueChange={(value) => setValue('role', value as any)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="member">Member</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="owner">Owner</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="designation">Designation</Label>
            <Input
              id="designation"
              placeholder="Software Engineer"
              {...register('designation')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="department">Department</Label>
            <Input
              id="department"
              placeholder="Engineering"
              {...register('department')}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setOpen(false);
                reset();
              }}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="mr-2 h-4 w-4" />
                  Send Invitation
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
