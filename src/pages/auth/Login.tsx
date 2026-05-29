import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/hooks/useAuth';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';
import logo from '@/assets/smb-connect-logo.jpg';
import heroImage from '@/assets/login-hero.png';
import { PolicyFooterLinks } from '@/components/PolicyLayout';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

type LoginFormData = z.infer<typeof loginSchema>;
type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { user } = useAuth();

  const rawRedirect = searchParams.get('redirect');
  const safeRedirect = rawRedirect && rawRedirect.startsWith('/') && !rawRedirect.startsWith('//')
    ? rawRedirect
    : null;
  
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const {
    register: registerForgot,
    handleSubmit: handleSubmitForgot,
    formState: { errors: forgotErrors },
    reset: resetForgotForm,
    setValue: setForgotValue,
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  // Auto-fill email field from login form when forgot password dialog opens
  useEffect(() => {
    if (showForgotPassword) {
      const loginEmail = (document.getElementById('email') as HTMLInputElement)?.value;
      if (loginEmail) {
        setForgotValue('email', loginEmail);
      } else if (user?.email) {
        setForgotValue('email', user.email);
      }
    }
  }, [showForgotPassword, user?.email, setForgotValue]);

  const onSubmit = async (data: LoginFormData) => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signInWithPassword({
        email: data.email.trim().toLowerCase(),
        password: data.password,
      });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'You have been logged in successfully',
      });

      navigate(safeRedirect ?? '/select-role');
    } catch (error: any) {
      const raw = (error?.message || '').toLowerCase();
      const friendly = raw.includes('invalid login credentials')
        ? 'Email or password is incorrect. If you signed up with Google, use "Continue with Google". Otherwise use "Forgot password?" to reset.'
        : raw.includes('email not confirmed')
        ? 'Please confirm your email address before signing in. Check your inbox for the confirmation link.'
        : error?.message || 'Failed to login';

      toast({
        title: 'Error',
        description: friendly,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}${safeRedirect ?? '/select-role'}`,
        },
      });

      if (error) throw error;
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to sign in with Google',
        variant: 'destructive',
      });
      setLoading(false);
    }
  };

  const handleForgotPassword = async (data: ForgotPasswordFormData) => {
    try {
      setLoading(true);
      
      // Call custom edge function to send OTP
      const { error } = await supabase.functions.invoke('send-password-otp', {
        body: { email: data.email }
      });

      if (error) throw error;

      setResetEmailSent(true);
      toast({
        title: 'Verification Code Sent',
        description: 'A 6-digit verification code has been sent to your email via Resend. It should arrive within seconds. Check your spam folder if you don\'t see it.',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to send verification code',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCloseForgotPassword = () => {
    setShowForgotPassword(false);
    setResetEmailSent(false);
    resetForgotForm();
  };

  return (
    <div className="min-h-screen relative flex items-center justify-end p-4 lg:p-8">
      {/* Background Image */}
      <div className="absolute inset-0 z-0">
        <img 
          src={heroImage} 
          alt="SMB Connect Network" 
          className="w-full h-full object-cover object-left"
        />
      </div>
      
      {/* Login Form Container */}
      <Card className="w-full max-w-md relative z-10 bg-background/95 backdrop-blur-sm lg:mr-16">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <img src={logo} alt="SMB Connect" className="h-16 object-contain" />
          </div>
          <CardTitle className="text-2xl font-bold">Welcome to SMB Connect</CardTitle>
          <CardDescription>
            Sign in to your account to continue
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                {...register('email')}
                id="email"
                type="email"
                placeholder="you@company.com"
                disabled={loading}
                icon={<Mail className="h-4 w-4" />}
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  {...register('password')}
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  disabled={loading}
                  icon={<Lock className="h-4 w-4" />}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password.message}</p>
              )}
            </div>

            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={() => setShowForgotPassword(true)}
                className="text-sm text-primary hover:underline"
              >
                Forgot password?
              </button>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>

          <div className="relative my-4">
            <Separator />
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">
              OR
            </span>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={handleGoogleSignIn}
            disabled={loading}
          >
            <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Continue with Google
          </Button>
        </CardContent>
        <CardFooter className="flex flex-col space-y-2">
          <div className="text-sm text-center text-muted-foreground">
            Don't have an account?{' '}
            <Link to="/auth/register" className="text-primary hover:underline">
              Register here
            </Link>
          </div>
          <div className="pt-2 w-full border-t">
            <div className="pt-3">
              <PolicyFooterLinks />
            </div>
          </div>
        </CardFooter>
      </Card>

      {/* Forgot Password Dialog */}
      <Dialog open={showForgotPassword} onOpenChange={handleCloseForgotPassword}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              {resetEmailSent
                ? "Check your email for the 6-digit verification code. It should arrive in seconds!"
                : "Enter your email address and we'll send you a 6-digit verification code instantly via Resend."}
            </DialogDescription>
          </DialogHeader>

          {!resetEmailSent ? (
            <form onSubmit={handleSubmitForgot(handleForgotPassword)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="forgot-email">Email</Label>
                <Input
                  {...registerForgot('email')}
                  id="forgot-email"
                  type="email"
                  placeholder="you@company.com"
                  disabled={loading}
                />
                {forgotErrors.email && (
                  <p className="text-sm text-destructive">{forgotErrors.email.message}</p>
                )}
              </div>

              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCloseForgotPassword}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? 'Sending...' : 'Send Verification Code'}
                </Button>
              </DialogFooter>
            </form>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground text-center">
                Check your email for the 6-digit code, then click below to reset your password.
              </p>
              <DialogFooter className="flex-col gap-2 sm:gap-2">
                <Button
                  onClick={() => {
                    const email = (document.getElementById('forgot-email') as HTMLInputElement)?.value;
                    handleCloseForgotPassword();
                    navigate('/reset-password', { state: { email } });
                  }}
                  className="w-full"
                >
                  Enter Verification Code
                </Button>
                <Button
                  variant="outline"
                  onClick={handleCloseForgotPassword}
                  className="w-full"
                >
                  Close
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
