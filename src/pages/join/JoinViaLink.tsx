import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Loader2, Building2, Users, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';

interface LinkDetails {
  valid: boolean;
  id: string;
  organization_id: string;
  organization_type: 'association' | 'company';
  organization_name: string;
  organization_logo: string | null;
  role: string;
  use_count: number;
  max_uses: number | null;
  expires_at: string | null;
  error?: string;
}

export default function JoinViaLink() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [details, setDetails] = useState<LinkDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);
  const [alreadyMember, setAlreadyMember] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('Invalid invite link');
      setLoading(false);
      return;
    }
    fetchDetails();
  }, [token]);

  const fetchDetails = async () => {
    try {
      setLoading(true);
      const { data, error: rpcError } = await supabase.rpc(
        'get_invite_link_details' as any,
        { p_token: token }
      );

      if (rpcError) throw rpcError;

      if (data.valid) {
        setDetails(data as LinkDetails);
      } else {
        setError(data.error || 'Invalid invite link');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load invite details');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!user) return;
    try {
      setJoining(true);
      const { data, error: rpcError } = await supabase.rpc(
        'accept_invite_link' as any,
        { p_token: token }
      );

      if (rpcError) throw rpcError;

      if (data.already_member) {
        setAlreadyMember(true);
        return;
      }

      if (!data.success) throw new Error(data.error);

      setJoined(true);
      toast.success(`You've joined ${data.organization_name}!`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to join');
    } finally {
      setJoining(false);
    }
  };

  const goToDashboard = () => navigate('/select-role');

  if (authLoading || loading) {
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

  if (error || !details?.valid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/20 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center justify-center mb-4">
              <XCircle className="h-12 w-12 text-destructive" />
            </div>
            <CardTitle className="text-center">Invalid Invite Link</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertDescription>
                {error || 'This invite link is invalid, expired, or has been disabled.'}
              </AlertDescription>
            </Alert>
            <Button variant="outline" className="w-full" onClick={() => navigate('/auth/login')}>
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const OrgIcon = details.organization_type === 'company' ? Building2 : Users;

  if (joined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/20 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center justify-center mb-4">
              <CheckCircle2 className="h-12 w-12 text-green-500" />
            </div>
            <CardTitle className="text-center">You're in!</CardTitle>
            <CardDescription className="text-center">
              You've successfully joined <strong>{details.organization_name}</strong>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={goToDashboard}>
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (alreadyMember) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/20 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center justify-center mb-4">
              <CheckCircle2 className="h-12 w-12 text-green-500" />
            </div>
            <CardTitle className="text-center">Already a Member</CardTitle>
            <CardDescription className="text-center">
              You're already a member of <strong>{details.organization_name}</strong>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={goToDashboard}>
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/20 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center justify-center mb-4">
            {details.organization_logo ? (
              <img
                src={details.organization_logo}
                alt={details.organization_name}
                className="h-16 w-16 rounded-full object-cover"
              />
            ) : (
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <OrgIcon className="h-8 w-8 text-primary" />
              </div>
            )}
          </div>
          <CardTitle className="text-center text-2xl">You're Invited</CardTitle>
          <CardDescription className="text-center">
            Join <strong>{details.organization_name}</strong>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Organization</span>
              <span className="font-medium">{details.organization_name}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Type</span>
              <span className="font-medium capitalize">{details.organization_type}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Role</span>
              <Badge variant="outline" className="capitalize">{details.role}</Badge>
            </div>
            {details.use_count > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Members joined</span>
                <span className="font-medium">{details.use_count}</span>
              </div>
            )}
          </div>

          {user ? (
            <Button className="w-full" onClick={handleJoin} disabled={joining}>
              {joining ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Joining...
                </>
              ) : (
                <>
                  <OrgIcon className="mr-2 h-4 w-4" />
                  Join {details.organization_name}
                </>
              )}
            </Button>
          ) : (
            <div className="space-y-3">
              <Button
                className="w-full"
                onClick={() => navigate(`/auth/register?redirect=/join/${token}`)}
              >
                Create Account & Join
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                Already have an account?{' '}
                <button
                  className="text-primary hover:underline font-medium"
                  onClick={() => navigate(`/auth/login?redirect=/join/${token}`)}
                >
                  Sign in
                </button>
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
