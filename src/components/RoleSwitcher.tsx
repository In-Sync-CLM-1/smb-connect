import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useRoleContext } from '@/contexts/RoleContext';
import { useAvailableRoles } from '@/hooks/useAvailableRoles';
import { RoleSelectionDialog } from './RoleSelectionDialog';
import { RefreshCw, Shield, Users, Building2, User } from 'lucide-react';
import { UserRole } from '@/hooks/useUserRole';
import { useNavigate } from 'react-router-dom';

export const RoleSwitcher = () => {
  const [showDialog, setShowDialog] = useState(false);
  const { selectedRole, setRole } = useRoleContext();
  const { availableRoles } = useAvailableRoles();
  const navigate = useNavigate();

  if (!availableRoles) return null;

  // Count total available roles
  const totalRoles = 
    (availableRoles.isAdmin ? 1 : 0) +
    availableRoles.associations.length +
    availableRoles.companies.length +
    (availableRoles.isMember ? 1 : 0);

  // Only show switcher if user has multiple roles
  if (totalRoles <= 1) return null;

  const getRoleLabel = () => {
    if (!selectedRole) return 'Select Role';
    
    switch (selectedRole) {
      case 'platform-admin':
        return 'Platform Admin';
      case 'admin':
        return availableRoles.isSuperAdmin ? 'Super Admin' : 'Admin';
      case 'association':
        return 'Association Manager';
      case 'company':
        return 'Company Admin';
      case 'member':
        return 'Member';
      default:
        return 'Unknown Role';
    }
  };

  const getRoleIcon = () => {
    switch (selectedRole) {
      case 'platform-admin':
      case 'admin':
        return Shield;
      case 'association':
        return Users;
      case 'company':
        return Building2;
      case 'member':
        return User;
      default:
        return RefreshCw;
    }
  };

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

  const Icon = getRoleIcon();

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setShowDialog(true)}
        className="gap-2"
      >
        <Icon className="h-4 w-4" />
        <span className="hidden sm:inline">{getRoleLabel()}</span>
        <RefreshCw className="h-3 w-3" />
      </Button>

      <RoleSelectionDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        availableRoles={availableRoles}
        onSelectRole={handleRoleSelect}
      />
    </>
  );
};
