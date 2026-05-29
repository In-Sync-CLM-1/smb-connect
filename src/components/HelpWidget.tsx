import { useEffect, useState } from 'react';
import { useRoleContext } from '@/contexts/RoleContext';
import { supabase } from '@/integrations/supabase/client';

export const HelpWidget = () => {
  const { selectedRole, availableRoles } = useRoleContext();
  const [isAdmin, setIsAdmin] = useState(false);

  // Determine admin status from context OR direct DB check (survives page refresh)
  useEffect(() => {
    const contextIsAdmin =
      selectedRole === 'admin' ||
      selectedRole === 'platform-admin' ||
      availableRoles?.isAdmin ||
      availableRoles?.isPlatformAdmin;

    if (contextIsAdmin) {
      setIsAdmin(true);
      return;
    }

    // Context is empty (page refresh) — check DB directly
    if (!selectedRole && !availableRoles) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session?.user) return;
        supabase
          .from('admin_users')
          .select('id')
          .eq('user_id', session.user.id)
          .eq('is_active', true)
          .maybeSingle()
          .then(({ data }) => setIsAdmin(!!data));
      });
    } else {
      setIsAdmin(false);
    }
  }, [selectedRole, availableRoles]);

  // Inject or remove the help widget script
  useEffect(() => {
    if (!isAdmin) {
      const el = document.getElementById('help-widget-script');
      if (el) el.remove();
      // Clean up widget elements created by the external script
      document.getElementById('insync-help-fab')?.remove();
      document.getElementById('insync-help-overlay')?.remove();
      document.getElementById('insync-help-dialog')?.remove();
      return;
    }

    const existingScript = document.getElementById('help-widget-script');
    if (existingScript) return;

    const script = document.createElement('script');
    script.id = 'help-widget-script';
    script.src = 'https://crm.in-sync.co.in/help-widget.js';
    script.setAttribute('data-source', 'smb-connect');
    document.body.appendChild(script);

    return () => {
      document.getElementById('help-widget-script')?.remove();
      document.getElementById('insync-help-fab')?.remove();
      document.getElementById('insync-help-overlay')?.remove();
      document.getElementById('insync-help-dialog')?.remove();
    };
  }, [isAdmin]);

  return null;
};
