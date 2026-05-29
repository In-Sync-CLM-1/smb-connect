import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Search, PenSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ComposeMessageDialog } from './ComposeMessageDialog';
import { getFullName, getInitialsFromName } from '@/lib/formatters';

interface ConversationListProps {
  selectedChatId: string | null;
  onSelectChat: (chatId: string) => void;
  currentUserId: string | null;
}

interface Conversation {
  id: string;
  name: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
  avatar?: string;
  otherMemberId?: string;
}

// Helper function to get last message preview with attachment indicators
const getLastMessagePreview = (lastMsg: { content: string | null; attachments: any } | null): string => {
  if (!lastMsg) return 'No messages yet';
  
  const attachments = lastMsg.attachments as any[] | null;
  if (attachments && attachments.length > 0) {
    const hasImages = attachments.some((a: any) => a.type === 'image');
    const hasDocs = attachments.some((a: any) => a.type === 'document');
    
    if (lastMsg.content) {
      // Has both text and attachments
      if (hasImages && hasDocs) return `📎 ${lastMsg.content}`;
      if (hasImages) return `📷 ${lastMsg.content}`;
      return `📄 ${lastMsg.content}`;
    } else {
      // Only attachments, no text
      if (hasImages && hasDocs) return '📎 Attachments';
      if (hasImages) return attachments.length > 1 ? '📷 Photos' : '📷 Photo';
      return attachments.length > 1 ? '📄 Documents' : '📄 Document';
    }
  }
  
  return lastMsg.content || 'No messages yet';
};

export function ConversationList({ selectedChatId, onSelectChat, currentUserId }: ConversationListProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [composeOpen, setComposeOpen] = useState(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestRequest = useRef(0);

  useEffect(() => {
    if (currentUserId) {
      loadConversations();

      const channel = supabase
        .channel('messages-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'messages'
          },
          () => {
            if (debounceTimer.current) clearTimeout(debounceTimer.current);
            debounceTimer.current = setTimeout(loadConversations, 500);
          }
        )
        .subscribe();

      return () => {
        if (debounceTimer.current) clearTimeout(debounceTimer.current);
        supabase.removeChannel(channel);
      };
    }
  }, [currentUserId]);

  const loadConversations = async () => {
    const requestId = ++latestRequest.current;
    try {
      if (!currentUserId) return;

      // Get member record
      const { data: memberRows } = await supabase
        .from('members')
        .select('id, company_id')
        .eq('user_id', currentUserId)
        .eq('is_active', true)
        .limit(1);

      const memberData = memberRows?.[0] || null;
      if (!memberData) return;

      // Get all chats where user is a participant with their read status
      const { data: participantData } = await supabase
        .from('chat_participants')
        .select('chat_id, last_read_at, joined_at')
        .eq('member_id', memberData.id);

      if (!participantData || participantData.length === 0) {
        setConversations([]);
        setLoading(false);
        return;
      }

      const chatIds = participantData.map(p => p.chat_id);
      
      // Create a map for quick lookup of participant read status
      const participantReadStatus = participantData.reduce((acc, p) => {
        acc[p.chat_id] = { last_read_at: p.last_read_at, joined_at: p.joined_at };
        return acc;
      }, {} as Record<string, { last_read_at: string | null; joined_at: string | null }>);

      // Get chat details with last message
      const { data: chatsData } = await supabase
        .from('chats')
        .select(`
          id,
          name,
          type,
          last_message_at,
          chat_participants!inner(member_id)
        `)
        .in('id', chatIds)
        .order('last_message_at', { ascending: false });

      if (!chatsData) {
        setConversations([]);
        setLoading(false);
        return;
      }

      const chatIdsList = chatsData.map(c => c.id);

      // Batch fetch last messages for all chats
      const { data: allMessages } = await supabase
        .from('messages')
        .select('chat_id, content, created_at, attachments')
        .in('chat_id', chatIdsList)
        .order('created_at', { ascending: false });

      const lastMsgByChat: Record<string, any> = {};
      (allMessages || []).forEach(msg => {
        if (!lastMsgByChat[msg.chat_id]) lastMsgByChat[msg.chat_id] = msg;
      });

      // Batch fetch unread counts - get all unread messages across chats in one query
      // We'll count per-chat from the result
      const unreadCountByChat: Record<string, number> = {};
      for (const chatId of chatIdsList) {
        const readStatus = participantReadStatus[chatId];
        const cutoffTime = readStatus?.last_read_at || readStatus?.joined_at || new Date().toISOString();

        const { count } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('chat_id', chatId)
          .neq('sender_id', memberData.id)
          .gt('created_at', cutoffTime);

        unreadCountByChat[chatId] = count || 0;
      }

      // Batch fetch other participants for direct chats
      const { data: allOtherParticipants } = await supabase
        .from('chat_participants')
        .select(`
          chat_id,
          member_id,
          members!inner(
            id,
            user_id,
            profiles!inner(first_name, last_name, avatar)
          )
        `)
        .in('chat_id', chatIdsList)
        .neq('member_id', memberData.id);

      const otherParticipantByChat: Record<string, any> = {};
      (allOtherParticipants || []).forEach(p => {
        if (!otherParticipantByChat[p.chat_id]) otherParticipantByChat[p.chat_id] = p;
      });

      // Assemble conversations (no per-chat queries for participants)
      const conversationsWithDetails = chatsData.map(chat => {
        const lastMsg = lastMsgByChat[chat.id] || null;
        const lastMessagePreview = getLastMessagePreview(lastMsg);

        if (chat.type === 'direct') {
          const otherParticipant = otherParticipantByChat[chat.id];
          if (otherParticipant) {
            const otherProfile = (otherParticipant as any).members.profiles;
            return {
              id: chat.id,
              name: getFullName(otherProfile?.first_name, otherProfile?.last_name),
              lastMessage: lastMessagePreview,
              lastMessageAt: lastMsg?.created_at || chat.last_message_at || new Date().toISOString(),
              unreadCount: unreadCountByChat[chat.id] || 0,
              avatar: otherProfile?.avatar,
              otherMemberId: (otherParticipant as any).members.id,
            };
          }
        }

        return {
          id: chat.id,
          name: chat.name || 'Group Chat',
          lastMessage: lastMessagePreview,
          lastMessageAt: lastMsg?.created_at || chat.last_message_at || new Date().toISOString(),
          unreadCount: unreadCountByChat[chat.id] || 0,
        };
      });

      if (requestId !== latestRequest.current) return; // stale request
      setConversations(conversationsWithDetails);
      setLoading(false);
    } catch (error) {
      if (requestId !== latestRequest.current) return; // stale request
      console.error('Error loading conversations:', error);
      setLoading(false);
    }
  };

  const filteredConversations = conversations.filter(conv =>
    conv.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header with Compose Button */}
      <div className="p-4 border-b space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Messages</h2>
          <Button 
            size="sm" 
            onClick={() => setComposeOpen(true)}
            className="gap-2"
          >
            <PenSquare className="w-4 h-4" />
            Compose
          </Button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Conversations */}
      <ScrollArea className="flex-1">
        {loading ? (
          <div className="p-4 text-center text-muted-foreground">Loading...</div>
        ) : filteredConversations.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground">
            {searchQuery ? 'No conversations found' : 'No conversations yet'}
          </div>
        ) : (
          <div className="divide-y">
            {filteredConversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => onSelectChat(conv.id)}
                className={cn(
                  "w-full p-4 flex items-start gap-3 hover:bg-accent transition-colors text-left",
                  selectedChatId === conv.id && "bg-accent"
                )}
              >
                <Avatar className="w-12 h-12">
                  <AvatarImage src={conv.avatar} />
                  <AvatarFallback>{getInitialsFromName(conv.name)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between mb-1">
                    <h3 className={cn(
                      "text-sm truncate",
                      conv.unreadCount > 0 ? "font-bold" : "font-semibold"
                    )}>{conv.name}</h3>
                    <span className="text-xs text-muted-foreground ml-2 flex-shrink-0">
                      {formatTime(conv.lastMessageAt)}
                    </span>
                  </div>
                  <p className={cn(
                    "text-sm truncate",
                    conv.unreadCount > 0 ? "text-foreground font-medium" : "text-muted-foreground"
                  )}>
                    {conv.lastMessage}
                  </p>
                </div>
                {conv.unreadCount > 0 && (
                  <div className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center flex-shrink-0">
                    {conv.unreadCount}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Compose Dialog */}
      <ComposeMessageDialog
        open={composeOpen}
        onOpenChange={setComposeOpen}
        currentUserId={currentUserId}
        onChatCreated={onSelectChat}
      />
    </div>
  );
}
