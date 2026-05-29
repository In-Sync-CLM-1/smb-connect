import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import logo from '@/assets/smb-connect-logo.jpg';

const signupSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string().min(8, 'Confirm password is required'),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type SignupFormData = z.infer<typeof signupSchema>;

interface InvitationData {
  id: string;
  company_name: string;
  email: string;
  association_id: string;
  status: string;
  expires_at: string;
  association?: {
    name: string;
  };
}

export default function AcceptInvitation() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
  });

  useEffect(() => {
    loadInvitation();
  }, [token]);

  const loadInvitation = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!token) {
        setError('Invalid invitation link. Token is missing.');
        return;
      }

      // Check current user
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      setCurrentUser(user);

      // Verify invitation via RPC (bypasses RLS via SECURITY DEFINER)
      const { data: verifyData, error: verifyError } = await supabase
        .rpc('verify_company_invitation' as any, { p_token: token });

      if (verifyError || !verifyData?.valid) {
        setError(verifyData?.error || 'Invitation not found or invalid.');
        return;
      }

      const inviteData = {
        ...verifyData.invitation,
        association: verifyData.invitation.association_name ? {
          name: verifyData.invitation.association_name
        } : undefined
      };

      setInvitation(inviteData);

      // If user is logged in with matching email, auto-accept
      if (user && user.email === inviteData.email) {
        await acceptInvitation(inviteData, user.id);
      } else if (user && user.email !== inviteData.email) {
        setError(`This invitation is for ${inviteData.email}, but you're logged in as ${user.email}. Please log out and try again.`);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load invitation details.');
    } finally {
      setLoading(false);
    }
  };

  const acceptInvitation = async (inviteData: InvitationData, userId: string) => {
    try {
      setSubmitting(true);

      // Call edge function to handle company creation (bypasses RLS)
      const { data, error: acceptError } = await supabase.functions.invoke(
        'accept-company-invitation',
        {
          body: { 
            token,
            userId 
          }
        }
      );

      if (acceptError || !data?.success) {
        throw new Error(data?.error || acceptError?.message || 'Failed to accept invitation');
      }

      toast({
        title: 'Success!',
        description: 'Company created successfully. Welcome to SMB Connect!',
      });

      // Redirect to company dashboard
      navigate('/company');
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to accept invitation.',
        variant: 'destructive',
      });
      setSubmitting(false);
    }
  };

  const onSignupSubmit = async (formData: SignupFormData) => {
    if (!invitation) return;

    try {
      setSubmitting(true);

      // Sign up new user
      const { data: authData, error: signupError } = await supabase.auth.signUp({
        email: invitation.email,
        password: formData.password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            first_name: formData.firstName,
            last_name: formData.lastName,
          },
        },
      });

      if (signupError) throw signupError;
      if (!authData.user) throw new Error('Failed to create user account.');

      // Accept invitation
      await acceptInvitation(invitation, authData.user.id);
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to create account.',
        variant: 'destructive',
      });
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Loading invitation...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <img src={logo} alt="SMB Connect" className="h-16 object-contain" />
            </div>
            <CardTitle>Invitation Error</CardTitle>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
            <div className="mt-6 text-center">
              <Link to="/auth/login">
                <Button variant="outline">Go to Login</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitting) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Setting up your company...</p>
        </div>
      </div>
    );
  }

  // User needs to sign up
  if (!currentUser && invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <img src={logo} alt="SMB Connect" className="h-16 object-contain" />
            </div>
            <CardTitle>Company Invitation</CardTitle>
            <CardDescription>
              You've been invited to join <strong>{invitation.company_name}</strong>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert className="mb-6">
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Association:</strong> {invitation.association?.name || 'N/A'}<br />
                <strong>Company:</strong> {invitation.company_name}<br />
                <strong>Email:</strong> {invitation.email}
              </AlertDescription>
            </Alert>

            <form onSubmit={handleSubmit(onSignupSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  {...register('firstName')}
                  id="firstName"
                  placeholder="John"
                  disabled={submitting}
                />
                {errors.firstName && (
                  <p className="text-sm text-destructive">{errors.firstName.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  {...register('lastName')}
                  id="lastName"
                  placeholder="Doe"
                  disabled={submitting}
                />
                {errors.lastName && (
                  <p className="text-sm text-destructive">{errors.lastName.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Email (from invitation)</Label>
                <Input value={invitation.email} disabled className="bg-muted" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  {...register('password')}
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  disabled={submitting}
                />
                {errors.password && (
                  <p className="text-sm text-destructive">{errors.password.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  {...register('confirmPassword')}
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  disabled={submitting}
                />
                {errors.confirmPassword && (
                  <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? 'Creating Account...' : 'Accept Invitation & Create Account'}
              </Button>
            </form>

            <div className="mt-4 text-center text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link to={`/auth/login?redirect=/accept-invitation?token=${token}`} className="text-primary hover:underline">
                Sign in
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
}
