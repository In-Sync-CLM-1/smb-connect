import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { Send, Reply, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import DOMPurify from 'dompurify';

interface EmailThreadProps {
  conversationId: string;
  userType: 'association' | 'company';
  userId: string;
  userEmail: string;
  userName: string;
}

interface EmailMessage {
  id: string;
  sender_email: string;
  recipient_email: string;
  subject: string;
  body_html: string;
  body_text: string | null;
  direction: string;
  sender_name: string | null;
  is_read: boolean;
  sent_at: string;
}

export function EmailThread({
  conversationId,
  userType,
  userId,
  userEmail,
  userName,
}: EmailThreadProps) {
  const { toast } = useToast();
  const [messages, setMessages] = useState<EmailMessage[]>([]);
  const [conversation, setConversation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [replying, setReplying] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadConversation();
    loadMessages();

    // Mark inbound messages as read
    markAsRead();

    // Subscribe to new messages
    const channel = supabase
      .channel(`email-messages-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'email_messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => {
          loadMessages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  useEffect(() => {
    // Scroll to bottom when messages change
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const loadConversation = async () => {
    try {
      const { data, error } = await supabase
        .from('email_conversations')
        .select('*')
        .eq('id', conversationId)
        .single();

      if (error) throw error;
      setConversation(data);
    } catch (error) {
      console.error('Error loading conversation:', error);
    }
  };

  const loadMessages = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('email_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('sent_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error('Error loading messages:', error);
      toast({
        title: 'Error',
        description: 'Failed to load messages',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async () => {
    try {
      await supabase
        .from('email_messages')
        .update({ is_read: true })
        .eq('conversation_id', conversationId)
        .eq('direction', 'inbound')
        .eq('is_read', false);
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  const handleSendReply = async () => {
    if (!replyText.trim() || !conversation) return;

    setSending(true);
    try {
      // Determine recipient from conversation
      const isOriginalSender = conversation.sender_type === userType && conversation.sender_id === userId;
      const recipientEmail = isOriginalSender
        ? messages.find(m => m.direction === 'inbound')?.sender_email || messages[0]?.recipient_email
        : messages[0]?.sender_email;

      const { data, error } = await supabase.functions.invoke('send-email', {
        body: {
          conversationId,
          recipientEmail,
          recipientName: recipientEmail,
          subject: `Re: ${conversation.subject}`,
          bodyHtml: `<p>${replyText.replace(/\n/g, '<br>')}</p>`,
          bodyText: replyText,
          senderType: userType,
          senderId: userId,
          recipientType: conversation.recipient_type,
          recipientId: conversation.recipient_id,
          senderEmail: userEmail,
          senderName: userName,
        },
      });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Reply sent successfully',
      });

      setReplyText('');
      setReplying(false);
      loadMessages();
    } catch (error: any) {
      console.error('Error sending reply:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to send reply',
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b p-4">
        <h2 className="font-semibold text-lg">{conversation?.subject}</h2>
        <p className="text-sm text-muted-foreground">
          {messages.length} {messages.length === 1 ? 'message' : 'messages'}
        </p>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-6">
          {messages.map((message) => {
            const isOwn = message.direction === 'outbound';
            return (
              <div key={message.id} className={cn("flex gap-3", isOwn && "flex-row-reverse")}>
                <Avatar className="w-8 h-8 flex-shrink-0">
                  <AvatarFallback>
                    {message.sender_name?.[0] || message.sender_email[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className={cn("flex-1 space-y-1", isOwn && "text-right")}>
                  <div className="flex items-baseline gap-2">
                    <span className="font-semibold text-sm">
                      {message.sender_name || message.sender_email}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatTime(message.sent_at)}
                    </span>
                  </div>
                  <div
                    className={cn(
                      "rounded-lg p-3 inline-block max-w-[80%]",
                      isOwn
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    )}
                  >
                  <div 
                    className="prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ 
                      __html: DOMPurify.sanitize(message.body_html, {
                        ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'a', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'blockquote', 'div', 'span'],
                        ALLOWED_ATTR: ['href', 'target', 'class'],
                        ALLOW_DATA_ATTR: false
                      })
                    }}
                  />
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      {/* Reply Section */}
      <div className="border-t p-4">
        {replying ? (
          <div className="space-y-3">
            <Textarea
              placeholder="Type your reply..."
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              rows={4}
              className="resize-none"
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setReplying(false);
                  setReplyText('');
                }}
                disabled={sending}
              >
                Cancel
              </Button>
              <Button onClick={handleSendReply} disabled={sending || !replyText.trim()}>
                {sending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Send Reply
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : (
          <Button onClick={() => setReplying(true)} className="w-full">
            <Reply className="w-4 h-4 mr-2" />
            Reply
          </Button>
        )}
      </div>
    </div>
  );
}
