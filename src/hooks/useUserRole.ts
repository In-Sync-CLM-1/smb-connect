import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useRoleContext } from '@/contexts/RoleContext';

export type UserRole = 'admin' | 'platform-admin' | 'association' | 'company' | 'member' | null;

export function useUserRole() {
  const { selectedRole, selectedAssociationId, selectedCompanyId } = useRoleContext();
  const [role, setRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState<any>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);

  useEffect(() => {
    loadUserRole();
  }, [selectedRole, selectedAssociationId, selectedCompanyId]);

  const loadUserRole = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) {
        setRole(null);
        setLoading(false);
        return;
      }

      // If a role is already selected from context, use that role
      if (selectedRole) {
        // Load the appropriate userData based on selected role
        if (selectedRole === 'admin' || selectedRole === 'platform-admin') {
          const { data: adminData } = await supabase
            .from('admin_users')
            .select('*')
            .eq('user_id', user.id)
            .eq('is_active', true)
            .maybeSingle();

          if (adminData) {
            const isGod = adminData.is_super_admin && (adminData as any).is_hidden === true;
            setRole(selectedRole);
            setUserData({ ...adminData, type: selectedRole });
            setIsSuperAdmin(adminData.is_super_admin || false);
            setIsPlatformAdmin(isGod);
          }
        } else if (selectedRole === 'association') {
          // Query without filtering by association_id - let RLS determine access
          // Get all association manager records for this user
          const { data: associationDataList } = await supabase
            .from('association_managers')
            .select('*, association:associations(*)')
            .eq('user_id', user.id)
            .eq('is_active', true);

          if (associationDataList && associationDataList.length > 0) {
            // If selectedAssociationId is provided, try to find matching association
            // Otherwise, just take the first one
            const associationData = selectedAssociationId 
              ? associationDataList.find(a => a.association_id === selectedAssociationId) || associationDataList[0]
              : associationDataList[0];
              
            setRole('association');
            setUserData({ ...associationData, type: 'association' });
          } else if (selectedAssociationId) {
            // Admin users may not be in association_managers but can still manage associations
            const { data: adminData } = await supabase
              .from('admin_users')
              .select('*')
              .eq('user_id', user.id)
              .eq('is_active', true)
              .maybeSingle();

            if (adminData) {
              const { data: assocData } = await supabase
                .from('associations')
                .select('*')
                .eq('id', selectedAssociationId)
                .maybeSingle();

              if (assocData) {
                setRole('association');
                setUserData({
                  ...adminData,
                  type: 'association',
                  association_id: assocData.id,
                  association: assocData,
                });
                setIsSuperAdmin(adminData.is_super_admin || false);
                setIsPlatformAdmin(adminData.is_super_admin && (adminData as any).is_hidden === true);
              }
            }
          }
        } else if (selectedRole === 'company') {
          // Query without filtering by company_id - let RLS determine access
          // Get the first company where user is owner/admin
          const { data: memberDataList } = await supabase
            .from('members')
            .select('*, company:companies(*, association:associations(*))')
            .eq('user_id', user.id)
            .in('role', ['owner', 'admin'])
            .eq('is_active', true);

          if (memberDataList && memberDataList.length > 0) {
            // If selectedCompanyId provided, try to find matching company
            const memberData = selectedCompanyId 
              ? memberDataList.find(m => m.company_id === selectedCompanyId) || memberDataList[0]
              : memberDataList[0];
              
            setRole('company');
            setUserData({ ...memberData, type: 'company' });
          }
        } else if (selectedRole === 'member') {
          const { data: memberDataList } = await supabase
            .from('members')
            .select('*, company:companies(*, association:associations(*))')
            .eq('user_id', user.id)
            .eq('is_active', true);

          if (memberDataList && memberDataList.length > 0) {
            const companyMember = memberDataList.find(m => m.company_id !== null);
            const memberData = companyMember || memberDataList[0];
            setRole('member');
            setUserData({ ...memberData, type: 'member' });
          }
        }
        setLoading(false);
        return;
      }

      // Default behavior: Check in priority order (for backward compatibility)
      // Check if admin
      const { data: adminData } = await supabase
        .from('admin_users')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (adminData) {
        const isGod = adminData.is_super_admin && (adminData as any).is_hidden === true;
        setRole(isGod ? 'platform-admin' : 'admin');
        setUserData({ ...adminData, type: isGod ? 'platform-admin' : 'admin' });
        setIsSuperAdmin(adminData.is_super_admin || false);
        setIsPlatformAdmin(isGod);
        setLoading(false);
        return;
      }

      // Check if association manager
      const { data: associationDataList } = await supabase
        .from('association_managers')
        .select('*, association:associations(*)')
        .eq('user_id', user.id)
        .eq('is_active', true);

      if (associationDataList && associationDataList.length > 0) {
        const associationData = associationDataList[0];
        setRole('association');
        setUserData({ ...associationData, type: 'association' });
        setLoading(false);
        return;
      }

      // Check if company owner/admin or member
      // Get all member records and filter appropriately
      const { data: memberDataList } = await supabase
        .from('members')
        .select('*, company:companies(*, association:associations(*))')
        .eq('user_id', user.id)
        .eq('is_active', true);

      if (memberDataList && memberDataList.length > 0) {
        // Filter to get the most relevant member record
        // Priority: company-affiliated member > standalone member
        const companyMember = memberDataList.find(m => m.company_id !== null);
        const memberData = companyMember || memberDataList[0];
        
        // If member has company and is owner/admin, set as company role
        if (memberData.company_id && ['owner', 'admin'].includes(memberData.role)) {
          setRole('company');
          setUserData({ ...memberData, type: 'company' });
          setLoading(false);
          return;
        }
        
        // Otherwise, set as member (with or without company)
        setRole('member');
        setUserData({ ...memberData, type: 'member' });
        setLoading(false);
        return;
      }

      // New user with no role
      setRole(null);
      setLoading(false);
    } catch (error) {
      console.error('Error loading user role:', error);
      setRole(null);
      setLoading(false);
    }
  };

  return { role, loading, userData, refreshRole: loadUserRole, isSuperAdmin, isPlatformAdmin };
}
