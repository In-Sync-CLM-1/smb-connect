import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle2, XCircle, Building2, Users } from 'lucide-react';
import { toast } from 'sonner';

const registrationSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type RegistrationFormData = z.infer<typeof registrationSchema>;

interface InvitationData {
  valid: boolean;
  email: string;
  first_name?: string;
  last_name?: string;
  organization_name: string;
  organization_id: string;
  organization_type: 'company' | 'association';
  role: string;
  designation?: string;
  department?: string;
  expires_at: string;
  error?: string;
}

export default function AcceptMemberInvitation() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const token = searchParams.get('token');

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
  } = useForm<RegistrationFormData>({
    resolver: zodResolver(registrationSchema),
  });

  useEffect(() => {
    if (!token) {
      setError('Invalid invitation link - missing token');
      setLoading(false);
      return;
    }

    verifyInvitation();
  }, [token]);

  const verifyInvitation = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: functionError } = await supabase
        .rpc('verify_member_invitation' as any, { p_token: token });

      if (functionError) throw functionError;

      if (data.valid) {
        setInvitation(data);
        // Pre-fill name fields if available
        if (data.first_name) setValue('first_name', data.first_name);
        if (data.last_name) setValue('last_name', data.last_name);
      } else {
        setError(data.error || 'Invalid invitation');
      }
    } catch (err: any) {
      console.error('Error verifying invitation:', err);
      setError(err.message || 'Failed to verify invitation');
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (formData: RegistrationFormData) => {
    if (!token) return;

    try {
      setSubmitting(true);

      const { data, error: functionError } = await supabase.functions.invoke(
        'complete-member-invitation',
        {
          body: {
            token,
            password: formData.password,
            first_name: formData.first_name || invitation?.first_name,
            last_name: formData.last_name || invitation?.last_name,
          },
        }
      );

      // Handle edge function errors (including 409 conflicts)
      if (functionError) {
        let errorMessage = 'Failed to complete registration';
        
        if (data && typeof data === 'object') {
          if ('error' in data) {
            errorMessage = data.error as string;
          }
          if ('existing_user' in data && data.existing_user) {
            // User already exists - show specific message
            toast.error('An account with this email already exists', {
              description: 'Please sign in to continue',
              action: {
                label: 'Sign In',
                onClick: () => navigate('/login')
              }
            });
            return;
          }
        }
        
        throw new Error(errorMessage);
      }

      if (data.success) {
        toast.success('Registration completed successfully!');
        
        // Auto-login the user
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: invitation!.email,
          password: formData.password,
        });

        if (signInError) {
          toast.error('Please login with your new credentials');
          navigate('/auth/login');
        } else {
          navigate('/dashboard');
        }
      } else {
        throw new Error(data.error || 'Registration failed');
      }
    } catch (err: any) {
      console.error('Error completing registration:', err);
      toast.error(err.message || 'Failed to complete registration');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/20">
        <Card className="w-full max-w-md">
          <CardContent className="flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !invitation?.valid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/20 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center justify-center mb-4">
              <XCircle className="h-12 w-12 text-destructive" />
            </div>
            <CardTitle className="text-center">Invalid Invitation</CardTitle>
            <CardDescription className="text-center">
              {error || invitation?.error}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertDescription>
                This invitation link may have expired, been revoked, or already been used.
                Please contact your organization administrator for a new invitation.
              </AlertDescription>
            </Alert>
            <Button 
              variant="outline" 
              className="w-full" 
              onClick={() => navigate('/auth/login')}
            >
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const expiresAt = new Date(invitation.expires_at);
  const hoursRemaining = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60)));

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/20 p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <div className="flex items-center justify-center mb-4">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              {invitation.organization_type === 'company' ? (
                <Building2 className="h-8 w-8 text-primary" />
              ) : (
                <Users className="h-8 w-8 text-primary" />
              )}
            </div>
          </div>
          <CardTitle className="text-center text-2xl">Complete Your Registration</CardTitle>
          <CardDescription className="text-center">
            You've been invited to join <strong>{invitation.organization_name}</strong>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-muted/50 rounded-lg p-4 mb-6 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Email:</span>
              <span className="font-medium">{invitation.email}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Role:</span>
              <span className="font-medium capitalize">{invitation.role}</span>
            </div>
            {invitation.designation && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Designation:</span>
                <span className="font-medium">{invitation.designation}</span>
              </div>
            )}
            {invitation.department && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Department:</span>
                <span className="font-medium">{invitation.department}</span>
              </div>
            )}
            <div className="flex justify-between text-sm pt-2 border-t border-border/50">
              <span className="text-muted-foreground">Expires in:</span>
              <span className="font-medium text-warning">
                {hoursRemaining} hour{hoursRemaining !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first_name">First Name</Label>
                <Input
                  id="first_name"
                  {...register('first_name')}
                  placeholder="John"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name">Last Name</Label>
                <Input
                  id="last_name"
                  {...register('last_name')}
                  placeholder="Doe"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                {...register('password')}
                placeholder="Minimum 8 characters"
              />
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                {...register('confirmPassword')}
                placeholder="Re-enter your password"
              />
              {errors.confirmPassword && (
                <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating Account...
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Complete Registration
                </>
              )}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Button variant="link" className="p-0 h-auto" onClick={() => navigate('/auth/login')}>
              Sign in
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
