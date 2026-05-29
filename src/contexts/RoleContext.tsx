import React, { createContext, useContext, useState, ReactNode } from 'react';
import { UserRole } from '@/hooks/useUserRole';

export interface AvailableRoles {
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isPlatformAdmin: boolean;
  associations: { id: string; name: string }[];
  companies: { id: string; name: string; role: 'owner' | 'admin' }[];
  isMember: boolean;
}

interface RoleContextType {
  selectedRole: UserRole | null;
  selectedAssociationId: string | null;
  selectedCompanyId: string | null;
  availableRoles: AvailableRoles | null;
  setRole: (role: UserRole, associationId?: string, companyId?: string) => void;
  clearRole: () => void;
  setAvailableRoles: (roles: AvailableRoles) => void;
}

const RoleContext = createContext<RoleContextType | undefined>(undefined);

export const RoleProvider = ({ children }: { children: ReactNode }) => {
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [selectedAssociationId, setSelectedAssociationId] = useState<string | null>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [availableRoles, setAvailableRolesState] = useState<AvailableRoles | null>(null);

  const setRole = (role: UserRole, associationId?: string, companyId?: string) => {
    setSelectedRole(role);
    setSelectedAssociationId(associationId || null);
    setSelectedCompanyId(companyId || null);
  };

  const clearRole = () => {
    setSelectedRole(null);
    setSelectedAssociationId(null);
    setSelectedCompanyId(null);
    setAvailableRolesState(null);
  };

  const setAvailableRoles = (roles: AvailableRoles) => {
    setAvailableRolesState(roles);
  };

  return (
    <RoleContext.Provider
      value={{
        selectedRole,
        selectedAssociationId,
        selectedCompanyId,
        availableRoles,
        setRole,
        clearRole,
        setAvailableRoles,
      }}
    >
      {children}
    </RoleContext.Provider>
  );
};

export const useRoleContext = () => {
  const context = useContext(RoleContext);
  if (context === undefined) {
    throw new Error('useRoleContext must be used within a RoleProvider');
  }
  return context;
};
