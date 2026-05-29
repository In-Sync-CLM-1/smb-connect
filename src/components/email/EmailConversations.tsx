import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { EmailComposer } from './EmailComposer';
import { EmailThread } from './EmailThread';
import { Mail, Plus, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmailConversationsProps {
  userType: 'association' | 'company';
  userId: string;
  userEmail: string;
  userName: string;
}

interface Conversation {
  id: string;
  subject: string;
  sender_type: string;
  sender_id: string;
  recipient_type: string;
  recipient_id: string;
  status: string;
  last_message_at: string;
  unread_count: number;
}

export function EmailConversations({
  userType,
  userId,
  userEmail,
  userName,
}: EmailConversationsProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [composeOpen, setComposeOpen] = useState(false);

  useEffect(() => {
    loadConversations();
    
    // Subscribe to new messages
    const channel = supabase
      .channel('email-conversations')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'email_conversations'
        },
        () => {
          loadConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userType, userId]);

  const loadConversations = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('email_conversations')
        .select('*')
        .or(
          userType === 'association'
            ? `sender_id.eq.${userId},recipient_id.eq.${userId}`
            : `sender_id.eq.${userId},recipient_id.eq.${userId}`
        )
        .eq('status', 'active')
        .order('last_message_at', { ascending: false });

      if (error) throw error;

      // Batch fetch unread counts - get all unread messages and count per conversation
      const convIds = (data || []).map(c => c.id);
      const { data: unreadMessages } = convIds.length > 0
        ? await supabase
            .from('email_messages')
            .select('conversation_id')
            .in('conversation_id', convIds)
            .eq('is_read', false)
            .eq('direction', 'inbound')
        : { data: [] };

      const unreadCountByConv: Record<string, number> = {};
      (unreadMessages || []).forEach(msg => {
        unreadCountByConv[msg.conversation_id] = (unreadCountByConv[msg.conversation_id] || 0) + 1;
      });

      const conversationsWithUnread = (data || []).map(conv => ({
        ...conv,
        unread_count: unreadCountByConv[conv.id] || 0,
      }));

      setConversations(conversationsWithUnread);
    } catch (error) {
      console.error('Error loading conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredConversations = conversations.filter((conv) =>
    conv.subject.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    } else if (diffInHours < 168) {
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  return (
    <div className="flex h-[600px] border rounded-lg overflow-hidden">
      {/* Conversations List */}
      <div className="w-80 border-r flex flex-col">
        <div className="p-4 border-b space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-lg">Email Conversations</h2>
            <Button size="sm" onClick={() => setComposeOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              New
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

        <ScrollArea className="flex-1">
          {loading ? (
            <div className="p-4 text-center text-muted-foreground">Loading...</div>
          ) : filteredConversations.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              {searchQuery ? 'No conversations found' : 'No email conversations yet'}
            </div>
          ) : (
            <div className="divide-y">
              {filteredConversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => setSelectedConversation(conv.id)}
                  className={cn(
                    "w-full p-4 flex items-start gap-3 hover:bg-accent transition-colors text-left",
                    selectedConversation === conv.id && "bg-accent"
                  )}
                >
                  <Avatar className="w-10 h-10">
                    <AvatarFallback>
                      <Mail className="w-5 h-5" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between mb-1">
                      <h3 className="font-semibold text-sm truncate">{conv.subject}</h3>
                      <span className="text-xs text-muted-foreground ml-2 flex-shrink-0">
                        {formatDate(conv.last_message_at)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {conv.sender_type === userType ? 'Sent' : 'Received'}
                      </Badge>
                      {conv.unread_count > 0 && (
                        <Badge variant="default" className="text-xs">
                          {conv.unread_count} new
                        </Badge>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Email Thread */}
      <div className="flex-1 flex flex-col">
        {selectedConversation ? (
          <EmailThread
            conversationId={selectedConversation}
            userType={userType}
            userId={userId}
            userEmail={userEmail}
            userName={userName}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <Mail className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg mb-2">Select a conversation</p>
              <p className="text-sm">Choose an email thread to view messages</p>
            </div>
          </div>
        )}
      </div>

      {/* Email Composer Dialog */}
      <EmailComposer
        open={composeOpen}
        onOpenChange={setComposeOpen}
        senderType={userType}
        senderId={userId}
        senderEmail={userEmail}
        senderName={userName}
      />
    </div>
  );
}
