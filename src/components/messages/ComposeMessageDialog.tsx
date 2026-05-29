import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getFullName, getUserInitials } from '@/lib/formatters';

interface ComposeMessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUserId: string | null;
  onChatCreated: (chatId: string) => void;
}

interface Member {
  id: string;
  user_id: string;
  profiles: {
    first_name: string;
    last_name: string;
    avatar: string | null;
  };
}

export function ComposeMessageDialog({ 
  open, 
  onOpenChange, 
  currentUserId,
  onChatCreated 
}: ComposeMessageDialogProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open && currentUserId) {
      loadMembers();
    }
  }, [open, currentUserId]);

  const loadMembers = async () => {
    try {
      setLoading(true);
      
      // Get current member record
      const { data: currentMemberRows } = await supabase
        .from('members')
        .select('id')
        .eq('user_id', currentUserId)
        .eq('is_active', true)
        .limit(1);

      const currentMember = currentMemberRows?.[0] || null;
      if (!currentMember) return;

      // Get all members with profiles in a single query using join
      const { data: membersData } = await supabase
        .from('members')
        .select('id, user_id, profiles!inner(first_name, last_name, avatar)')
        .neq('user_id', currentUserId)
        .eq('is_active', true);

      if (membersData) {
        const memberWithProfiles = membersData.map((member: any) => ({
          id: member.id,
          user_id: member.user_id,
          profiles: member.profiles || { first_name: '', last_name: '', avatar: null },
        }));

        setMembers(memberWithProfiles);
      }
    } catch (error) {
      console.error('Error loading members:', error);
      toast({
        title: 'Error',
        description: 'Failed to load members',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSelectMember = async (memberId: string) => {
    try {
      // Get current member record
      const { data: currentMemberRows } = await supabase
        .from('members')
        .select('id')
        .eq('user_id', currentUserId)
        .eq('is_active', true)
        .limit(1);

      const currentMember = currentMemberRows?.[0] || null;
      if (!currentMember) return;

      // Check if chat already exists between these members
      const { data: existingChats } = await supabase
        .from('chat_participants')
        .select('chat_id')
        .eq('member_id', currentMember.id);

      if (existingChats && existingChats.length > 0) {
        // Check each chat to see if it's a direct chat with this member
        for (const chat of existingChats) {
          const { data: participants } = await supabase
            .from('chat_participants')
            .select('member_id')
            .eq('chat_id', chat.chat_id);

          if (participants && participants.length === 2) {
            const otherParticipant = participants.find(p => p.member_id !== currentMember.id);
            if (otherParticipant?.member_id === memberId) {
              // Chat already exists
              onChatCreated(chat.chat_id);
              onOpenChange(false);
              return;
            }
          }
        }
      }

      // Create new chat
      const { data: newChat, error: chatError } = await supabase
        .from('chats')
        .insert({
          type: 'direct',
          last_message_at: new Date().toISOString()
        })
        .select()
        .single();

      if (chatError) throw chatError;

      // Add participants
      const { error: participantError } = await supabase
        .from('chat_participants')
        .insert([
          { chat_id: newChat.id, member_id: currentMember.id },
          { chat_id: newChat.id, member_id: memberId }
        ]);

      if (participantError) throw participantError;

      toast({
        title: 'Success',
        description: 'Chat created successfully',
      });

      onChatCreated(newChat.id);
      onOpenChange(false);
      setSearchQuery('');
    } catch (error) {
      console.error('Error creating chat:', error);
      toast({
        title: 'Error',
        description: 'Failed to create chat',
        variant: 'destructive',
      });
    }
  };

  const filteredMembers = members.filter(member =>
    getFullName(member.profiles.first_name, member.profiles.last_name)
      .toLowerCase()
      .includes(searchQuery.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New Message</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search members..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <ScrollArea className="h-[400px]">
            {loading ? (
              <div className="p-4 text-center text-muted-foreground">Loading...</div>
            ) : filteredMembers.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground">
                {searchQuery ? 'No members found' : 'No members available'}
              </div>
            ) : (
              <div className="space-y-1">
                {filteredMembers.map((member) => (
                  <button
                    key={member.id}
                    onClick={() => handleSelectMember(member.id)}
                    className="w-full p-3 flex items-center gap-3 hover:bg-accent rounded-lg transition-colors"
                  >
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={member.profiles.avatar || undefined} />
                      <AvatarFallback>
                        {getUserInitials(member.profiles.first_name, member.profiles.last_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="text-left">
                      <p className="font-medium">
                        {getFullName(member.profiles.first_name, member.profiles.last_name)}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
