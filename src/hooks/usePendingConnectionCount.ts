import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function usePendingConnectionCount(currentUserId: string | null) {
  const [pendingCount, setPendingCount] = useState(0);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!currentUserId) {
      setPendingCount(0);
      return;
    }

    const fetchPendingCount = async () => {
      try {
        const { data: memberRows } = await supabase
          .from('members')
          .select('id')
          .eq('user_id', currentUserId)
          .eq('is_active', true)
          .limit(1);

        const memberData = memberRows?.[0] || null;

        if (!memberData) {
          setPendingCount(0);
          return;
        }

        const { count } = await supabase
          .from('connections')
          .select('*', { count: 'exact', head: true })
          .eq('receiver_id', memberData.id)
          .eq('status', 'pending');

        setPendingCount(count || 0);
      } catch (error) {
        console.error('Error fetching pending connection count:', error);
      }
    };

    fetchPendingCount();

    const debouncedFetch = () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(fetchPendingCount, 500);
    };

    const channel = supabase
      .channel('pending-connections')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'connections'
        },
        debouncedFetch
      )
      .subscribe();

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      supabase.removeChannel(channel);
    };
  }, [currentUserId]);

  return pendingCount;
}
