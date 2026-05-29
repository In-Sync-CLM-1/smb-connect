import { useNavigate, useLocation } from 'react-router-dom';
import { useRoleContext } from '@/contexts/RoleContext';
import { useAvailableRoles } from '@/hooks/useAvailableRoles';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { RoleSwitcher } from './RoleSwitcher';
import { 
  Shield, 
  Building2, 
  UserCircle,
  ArrowRight
} from 'lucide-react';

export function RoleNavigation() {
  const navigate = useNavigate();
  const location = useLocation();
  const { availableRoles, loading } = useAvailableRoles();
  const { setRole } = useRoleContext();

  // Don't show on auth pages
  if (location.pathname.startsWith('/auth') || location.pathname === '/') {
    return null;
  }

  // Wait for roles to load
  if (loading || !availableRoles) {
    return null;
  }

  const navigationOptions = [];

  // Add Member View if user is a member
  if (availableRoles.isMember) {
    navigationOptions.push({
      label: 'Member View',
      icon: UserCircle,
      path: '/feed',
      description: 'Browse members and connect',
      onClick: () => {
        setRole('member');
        navigate('/feed');
      }
    });
  }

  // Add Admin Dashboard if user is admin
  if (availableRoles.isAdmin || availableRoles.isSuperAdmin || availableRoles.isPlatformAdmin) {
    navigationOptions.push({
      label: 'Admin Dashboard',
      icon: Shield,
      path: '/admin',
      description: 'Manage platform',
      onClick: () => {
        setRole('admin');
        navigate('/admin');
      }
    });
  }

  // Add Association Dashboard if user manages any associations
  if (availableRoles.associations && availableRoles.associations.length > 0) {
    navigationOptions.push({
      label: 'Association Dashboard',
      icon: Building2,
      path: '/association',
      description: 'Manage association',
      onClick: () => {
        const firstAssociation = availableRoles.associations[0];
        setRole('association', firstAssociation.id);
        navigate('/association');
      }
    });
  }

  // Add Company Dashboard if user manages any companies
  if (availableRoles.companies && availableRoles.companies.length > 0) {
    navigationOptions.push({
      label: 'Company Dashboard',
      icon: Building2,
      path: '/company',
      description: 'Manage company',
      onClick: () => {
        const firstCompany = availableRoles.companies[0];
        setRole('company', undefined, firstCompany.id);
        navigate('/company');
      }
    });
  }

  // Only show if user has multiple roles/views
  if (navigationOptions.length <= 1) {
    return null;
  }

  return (
    <Card className="mb-6">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Switch View</h3>
          <RoleSwitcher />
        </div>
        <div className="flex flex-wrap gap-2">
          {navigationOptions.map((option) => {
            const Icon = option.icon;
            const isActive = location.pathname.startsWith(option.path);
            
            return (
              <Button
                key={option.path}
                variant={isActive ? 'default' : 'outline'}
                size="sm"
                onClick={option.onClick}
                className="flex items-center gap-2"
              >
                <Icon className="h-4 w-4" />
                {option.label}
                {!isActive && <ArrowRight className="h-3 w-3 ml-1" />}
              </Button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
