import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

type ConnectionStatus = 'none' | 'pending' | 'connected';

/**
 * Custom hook to manage user connections
 * Consolidates connection checking and management logic
 */
export function useConnection(currentUserId: string | null, targetUserId: string | null) {
  const [status, setStatus] = useState<ConnectionStatus>('none');
  const [loading, setLoading] = useState(true);
  const [currentMemberId, setCurrentMemberId] = useState<string | null>(null);
  const [targetMemberId, setTargetMemberId] = useState<string | null>(null);

  useEffect(() => {
    if (currentUserId && targetUserId && currentUserId !== targetUserId) {
      checkConnectionStatus();
    } else {
      setLoading(false);
    }
  }, [currentUserId, targetUserId]);

  const checkConnectionStatus = async () => {
    if (!currentUserId || !targetUserId) return;

    try {
      setLoading(true);

      // Get both members (use limit(1) to handle duplicate member records)
      const [{ data: currentMembers }, { data: otherMembers }] = await Promise.all([
        supabase.from('members').select('id').eq('user_id', currentUserId).eq('is_active', true).limit(1),
        supabase.from('members').select('id').eq('user_id', targetUserId).eq('is_active', true).limit(1),
      ]);
      const currentMember = currentMembers?.[0] || null;
      const otherMember = otherMembers?.[0] || null;

      if (!currentMember || !otherMember) {
        setLoading(false);
        return;
      }

      setCurrentMemberId(currentMember.id);
      setTargetMemberId(otherMember.id);

      // Check connection status
      const { data: connection } = await supabase
        .from('connections')
        .select('id, status')
        .or(
          `and(sender_id.eq.${currentMember.id},receiver_id.eq.${otherMember.id}),` +
          `and(sender_id.eq.${otherMember.id},receiver_id.eq.${currentMember.id})`
        )
        .maybeSingle();

      if (connection) {
        setStatus(connection.status === 'accepted' ? 'connected' : 'pending');
      } else {
        setStatus('none');
      }
    } catch (error) {
      console.error('Error checking connection:', error);
    } finally {
      setLoading(false);
    }
  };

  const sendConnectionRequest = async (message?: string) => {
    if (!currentMemberId || !targetMemberId) {
      return { error: new Error('Member IDs not available') };
    }

    try {
      const { error } = await supabase.from('connections').insert({
        sender_id: currentMemberId,
        receiver_id: targetMemberId,
        message: message || null,
        status: 'pending',
      });

      if (error) throw error;

      await checkConnectionStatus();
      return { error: null };
    } catch (err) {
      return { error: err as Error };
    }
  };

  const acceptConnection = async (connectionId: string) => {
    try {
      const { error } = await supabase
        .from('connections')
        .update({ status: 'accepted', responded_at: new Date().toISOString() })
        .eq('id', connectionId);

      if (error) throw error;

      await checkConnectionStatus();
      return { error: null };
    } catch (err) {
      return { error: err as Error };
    }
  };

  const rejectConnection = async (connectionId: string) => {
    try {
      const { error } = await supabase
        .from('connections')
        .update({ status: 'rejected', responded_at: new Date().toISOString() })
        .eq('id', connectionId);

      if (error) throw error;

      await checkConnectionStatus();
      return { error: null };
    } catch (err) {
      return { error: err as Error };
    }
  };

  return {
    status,
    loading,
    currentMemberId,
    targetMemberId,
    refresh: checkConnectionStatus,
    sendConnectionRequest,
    acceptConnection,
    rejectConnection,
  };
}
