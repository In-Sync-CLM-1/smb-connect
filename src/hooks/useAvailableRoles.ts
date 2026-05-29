import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AvailableRoles } from '@/contexts/RoleContext';

export function useAvailableRoles() {
  const [availableRoles, setAvailableRoles] = useState<AvailableRoles | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAvailableRoles();
  }, []);

  const loadAvailableRoles = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) {
        setAvailableRoles(null);
        setLoading(false);
        return;
      }

      const roles: AvailableRoles = {
        isAdmin: false,
        isSuperAdmin: false,
        isPlatformAdmin: false,
        associations: [],
        companies: [],
        isMember: false,
      };

      // Run all role checks in parallel
      const [adminResult, assocManagerResult, memberResult] = await Promise.all([
        supabase
          .from('admin_users')
          .select('is_super_admin, is_hidden')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .maybeSingle(),
        supabase
          .from('association_managers')
          .select('association_id, association:associations(id, name)')
          .eq('user_id', user.id)
          .eq('is_active', true),
        supabase
          .from('members')
          .select('id, company_id, role, company:companies(id, name)')
          .eq('user_id', user.id)
          .eq('is_active', true),
      ]);

      const adminData = adminResult.data;
      if (adminData) {
        roles.isAdmin = true;
        roles.isSuperAdmin = adminData.is_super_admin || false;
        roles.isPlatformAdmin = adminData.is_super_admin && (adminData as any).is_hidden === true;
      }

      // Associations
      if (roles.isAdmin) {
        const { data: allAssociations } = await supabase
          .from('associations')
          .select('id, name')
          .eq('is_active', true)
          .order('name');

        roles.associations = allAssociations || [];
      } else {
        const associationManagers = assocManagerResult.data;
        if (associationManagers && associationManagers.length > 0) {
          roles.associations = associationManagers
            .filter(am => am.association)
            .map(am => ({
              id: (am.association as any).id,
              name: (am.association as any).name,
            }));
        }
      }

      // Companies
      if (roles.isAdmin) {
        const { data: allCompanies } = await supabase
          .from('companies')
          .select('id, name')
          .eq('is_active', true)
          .order('name');

        if (allCompanies && allCompanies.length > 0) {
          roles.companies = allCompanies.map(c => ({
            id: c.id,
            name: c.name,
            role: 'admin' as const,
          }));
        }
      } else {
        const memberData = memberResult.data;
        if (memberData && memberData.length > 0) {
          const companyAdmins = memberData.filter(m => ['owner', 'admin'].includes(m.role));
          if (companyAdmins.length > 0) {
            roles.companies = companyAdmins
              .filter(ca => ca.company)
              .map(ca => ({
                id: (ca.company as any).id,
                name: (ca.company as any).name,
                role: ca.role as 'owner' | 'admin',
              }));
          }
        }
      }

      // Member status - already fetched above
      roles.isMember = !!(memberResult.data && memberResult.data.length > 0);

      setAvailableRoles(roles);
      setLoading(false);
    } catch (error) {
      console.error('Error loading available roles:', error);
      setAvailableRoles(null);
      setLoading(false);
    }
  };

  return { availableRoles, loading, refreshRoles: loadAvailableRoles };
}
