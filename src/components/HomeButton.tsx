import { useNavigate } from 'react-router-dom';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useUserRole } from '@/hooks/useUserRole';
import { useRoleContext } from '@/contexts/RoleContext';
import logo from '@/assets/smb-connect-logo.png';

export const HomeButton = () => {
  const navigate = useNavigate();
  const { role } = useUserRole();
  const { selectedRole } = useRoleContext();
  
  const activeRole = selectedRole || role;

  const getHomePath = () => {
    switch(activeRole) {
      case 'admin':
      case 'platform-admin':
        return '/admin';
      case 'association':
        return '/association';
      case 'company':
        return '/company';
      case 'member':
        return '/feed';
      default:
        return '/dashboard';
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => navigate(getHomePath())}
            className="fixed top-3 left-3 z-50 md:top-4 md:left-4"
          >
            <img 
              src={logo} 
              alt="SMB Connect" 
              className="h-8 md:h-10 w-auto rounded-lg shadow-sm"
            />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">
          <p>Go to {activeRole === 'admin' || activeRole === 'platform-admin' ? 'Admin Dashboard' : activeRole === 'association' ? 'Association Dashboard' : activeRole === 'company' ? 'Company Dashboard' : activeRole === 'member' ? 'Feed' : 'Dashboard'}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
