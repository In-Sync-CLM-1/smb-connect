import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useUnreadMessageCount(currentUserId: string | null) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [memberId, setMemberId] = useState<string | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!currentUserId) {
      setUnreadCount(0);
      return;
    }

    const fetchMemberAndCount = async () => {
      const { data: memberRows } = await supabase
        .from('members')
        .select('id')
        .eq('user_id', currentUserId)
        .eq('is_active', true)
        .limit(1);

      const memberData = memberRows?.[0] || null;

      if (!memberData) {
        setUnreadCount(0);
        return;
      }

      setMemberId(memberData.id);
      await fetchUnreadCount(memberData.id);
    };

    fetchMemberAndCount();
  }, [currentUserId]);

  useEffect(() => {
    if (!memberId) return;

    const debouncedFetch = () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => {
        fetchUnreadCount(memberId);
      }, 500);
    };

    const channel = supabase
      .channel('unread-messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages'
        },
        debouncedFetch
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chat_participants'
        },
        debouncedFetch
      )
      .subscribe();

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      supabase.removeChannel(channel);
    };
  }, [memberId]);

  const fetchUnreadCount = async (memberIdToUse: string) => {
    try {
      const { data: participantsData } = await supabase
        .from('chat_participants')
        .select('chat_id, last_read_at, joined_at')
        .eq('member_id', memberIdToUse);

      if (!participantsData || participantsData.length === 0) {
        setUnreadCount(0);
        return;
      }

      // Use the earliest cutoff to fetch all potentially unread messages in one query
      const chatIds = participantsData.map(p => p.chat_id);
      const cutoffMap: Record<string, string> = {};
      let earliestCutoff = new Date().toISOString();

      for (const p of participantsData) {
        const cutoff = p.last_read_at || p.joined_at || new Date().toISOString();
        cutoffMap[p.chat_id] = cutoff;
        if (cutoff < earliestCutoff) earliestCutoff = cutoff;
      }

      // Single query: get all messages across all chats since earliest cutoff
      const { data: unreadMessages } = await supabase
        .from('messages')
        .select('chat_id, created_at')
        .in('chat_id', chatIds)
        .neq('sender_id', memberIdToUse)
        .gt('created_at', earliestCutoff);

      // Count per-chat using the correct cutoff for each chat
      let totalUnread = 0;
      (unreadMessages || []).forEach(msg => {
        const chatCutoff = cutoffMap[msg.chat_id];
        if (chatCutoff && msg.created_at > chatCutoff) {
          totalUnread++;
        }
      });

      setUnreadCount(totalUnread);
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  };

  const refreshCount = useCallback(() => {
    if (memberId) {
      fetchUnreadCount(memberId);
    }
  }, [memberId]);

  return { unreadCount, refreshCount };
}
