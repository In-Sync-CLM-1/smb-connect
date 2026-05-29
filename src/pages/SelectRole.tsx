import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRoleContext } from '@/contexts/RoleContext';
import { useAvailableRoles } from '@/hooks/useAvailableRoles';
import { RoleSelectionDialog } from '@/components/RoleSelectionDialog';
import { UserRole } from '@/hooks/useUserRole';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import logo from '@/assets/smb-connect-logo.png';

export default function SelectRole() {
  const navigate = useNavigate();
  const { setRole, setAvailableRoles: setContextRoles } = useRoleContext();
  const { availableRoles, loading } = useAvailableRoles();
  const [showDialog, setShowDialog] = useState(false);

  useEffect(() => {
    if (!loading && availableRoles) {
      setContextRoles(availableRoles);
      
      // Count total available roles
      const totalRoles = 
        (availableRoles.isAdmin ? 1 : 0) +
        availableRoles.associations.length +
        availableRoles.companies.length +
        (availableRoles.isMember ? 1 : 0);

      if (totalRoles === 0) {
        // No roles - redirect to member feed (new users should see the feed, not request forms)
        navigate('/feed');
      } else if (totalRoles === 1) {
        // Only one role - auto-select and navigate
        if (availableRoles.isAdmin) {
          const role = availableRoles.isPlatformAdmin ? 'platform-admin' : 'admin';
          setRole(role);
          navigate('/admin');
        } else if (availableRoles.associations.length > 0) {
          setRole('association', availableRoles.associations[0].id);
          navigate('/association');
        } else if (availableRoles.companies.length > 0) {
          setRole('company', undefined, availableRoles.companies[0].id);
          navigate('/company');
        } else if (availableRoles.isMember) {
          setRole('member');
          navigate('/feed');
        }
      } else {
        // Multiple roles - show dialog
        setShowDialog(true);
      }
    }
  }, [loading, availableRoles, navigate, setRole, setContextRoles]);

  const handleRoleSelect = (role: UserRole, associationId?: string, companyId?: string) => {
    setRole(role, associationId, companyId);
    
    // Navigate to appropriate dashboard
    switch (role) {
      case 'admin':
      case 'platform-admin':
        navigate('/admin');
        break;
      case 'association':
        navigate('/association');
        break;
      case 'company':
        navigate('/company');
        break;
      case 'member':
        navigate('/feed');
        break;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!availableRoles) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <img src={logo} alt="SMB Connect" className="h-16 mx-auto mb-4" />
            <CardTitle>No Roles Available</CardTitle>
            <CardDescription>
              Your account doesn't have any active roles. Please contact your administrator.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <img src={logo} alt="SMB Connect" className="h-16 mx-auto mb-4" />
          <CardTitle>Select Your Role</CardTitle>
          <CardDescription>
            You have access to multiple roles. Choose how you want to access the platform.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground">
            Loading role selection...
          </div>
        </CardContent>
      </Card>

      {availableRoles && (
        <RoleSelectionDialog
          open={showDialog}
          onOpenChange={(open) => {
            if (!open) {
              // Don't allow closing without selection
              return;
            }
            setShowDialog(open);
          }}
          availableRoles={availableRoles}
          onSelectRole={handleRoleSelect}
          loading={loading}
        />
      )}
    </div>
  );
}
