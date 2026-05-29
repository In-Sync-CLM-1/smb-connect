import { useLocation } from 'react-router-dom';
import { useRoleContext } from '@/contexts/RoleContext';
import { useUserRole } from '@/hooks/useUserRole';

export type OwnershipScope = 'admin' | 'association' | 'company';

export interface OwnershipContext {
  scope: OwnershipScope;
  associationId: string | null;
  companyId: string | null;
  basePath: string;
}

export function useOwnershipScope(): OwnershipContext {
  const { pathname } = useLocation();
  const { selectedAssociationId, selectedCompanyId } = useRoleContext();
  const { userData } = useUserRole();

  if (pathname.startsWith('/association/')) {
    return {
      scope: 'association',
      associationId:
        selectedAssociationId ||
        userData?.association_id ||
        userData?.association?.id ||
        null,
      companyId: null,
      basePath: '/association',
    };
  }

  if (pathname.startsWith('/company/')) {
    return {
      scope: 'company',
      associationId: null,
      companyId:
        selectedCompanyId ||
        userData?.company_id ||
        userData?.company?.id ||
        null,
      basePath: '/company',
    };
  }

  return {
    scope: 'admin',
    associationId: null,
    companyId: null,
    basePath: '/admin',
  };
}
