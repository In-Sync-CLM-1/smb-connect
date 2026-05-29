import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserRole } from '@/hooks/useUserRole';
import { useRoleContext } from '@/contexts/RoleContext';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { BackButton } from '@/components/BackButton';
import { AdminOnboarding } from '@/components/onboarding/AdminOnboarding';
import { AssociationOnboarding } from '@/components/onboarding/AssociationOnboarding';
import { CompanyOnboarding } from '@/components/onboarding/CompanyOnboarding';
import { MemberOnboarding } from '@/components/onboarding/MemberOnboarding';
import AdminAnalytics from './admin/AdminAnalytics';
import AssociationDashboard from './association/AssociationDashboard';
import CompanyDashboard from './company/CompanyDashboard';
import MemberDashboard from './member/MemberDashboard';

export default function Dashboard() {
  const { role, loading, refreshRole } = useUserRole();
  const { selectedRole } = useRoleContext();
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect to role selection if no role is selected
    if (!loading && !selectedRole && !role) {
      navigate('/select-role');
    }
  }, [loading, role, selectedRole, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center flex-col gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        <p className="text-muted-foreground">Loading your dashboard...</p>
      </div>
    );
  }

  // Show refresh option if no role is found
  if (!role) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-lg text-muted-foreground">No role assigned yet</p>
          <Button onClick={refreshRole}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh Status
          </Button>
        </div>
      </div>
    );
  }

  // Route to appropriate dashboard based on role
    switch (role) {
      case 'admin':
      case 'platform-admin':
        return (
          <>
            <AdminOnboarding />
            <AdminAnalytics />
          </>
        );
      case 'association':
      return (
        <>
          <AssociationOnboarding />
          <AssociationDashboard />
        </>
      );
    case 'company':
      return (
        <>
          <CompanyOnboarding />
          <CompanyDashboard />
        </>
      );
    case 'member':
      navigate('/feed');
      return <MemberOnboarding />;
    default:
      return null;
  }
}
