import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Building2, Users, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export default function Setup() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center space-y-2">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Building2 className="w-8 h-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-3xl font-bold">Welcome to SMB Connect!</CardTitle>
          <CardDescription className="text-base">
            Your account has been created successfully. To get started, you need to be assigned a role.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-muted/50 p-6 rounded-lg space-y-4">
            <h3 className="font-semibold text-lg">Available Roles:</h3>
            
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 bg-card rounded-lg border">
                <Shield className="w-5 h-5 text-primary mt-0.5" />
                <div>
                  <p className="font-medium">Admin</p>
                  <p className="text-sm text-muted-foreground">Manage all associations, companies, and users</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3 p-3 bg-card rounded-lg border">
                <Building2 className="w-5 h-5 text-primary mt-0.5" />
                <div>
                  <p className="font-medium">Association Admin</p>
                  <p className="text-sm text-muted-foreground">Manage companies within your association</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3 p-3 bg-card rounded-lg border">
                <Building2 className="w-5 h-5 text-primary mt-0.5" />
                <div>
                  <p className="font-medium">Company Admin</p>
                  <p className="text-sm text-muted-foreground">Manage your company and team members</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3 p-3 bg-card rounded-lg border">
                <Users className="w-5 h-5 text-primary mt-0.5" />
                <div>
                  <p className="font-medium">Member</p>
                  <p className="text-sm text-muted-foreground">Connect and collaborate with other members</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 p-4 rounded-lg">
            <p className="text-sm text-yellow-900 dark:text-yellow-200">
              <strong>Next Steps:</strong> Please contact your administrator to assign you a role. 
              Once assigned, you'll be able to access your dashboard and start using the platform.
            </p>
          </div>

          <div className="flex gap-3">
            <Button onClick={handleLogout} variant="outline" className="flex-1">
              Sign Out
            </Button>
            <Button 
              onClick={() => navigate('/dashboard')} 
              className="flex-1"
            >
              Refresh Status
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
