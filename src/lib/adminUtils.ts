import { supabase } from '@/integrations/supabase/client';

/**
 * Utility to fetch hidden admin user IDs for filtering
 * Used to exclude platform admins from public listings
 */
export async function getHiddenAdminIds(): Promise<string[]> {
  const { data, error } = await supabase
    .from('admin_users')
    .select('user_id')
    .eq('is_hidden', true)
    .eq('is_active', true);
  
  if (error) {
    console.error('Error fetching hidden admin IDs:', error);
    return [];
  }
  
  return data?.map(a => a.user_id) || [];
}

/**
 * Check if the current user is a hidden (platform) admin
 */
export async function isCurrentUserHiddenAdmin(): Promise<boolean> {
  const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
  if (!user) return false;

  const { data } = await supabase
    .from('admin_users')
    .select('is_hidden, is_active')
    .eq('user_id', user.id)
    .maybeSingle();

  return data?.is_hidden === true && data?.is_active === true;
}
