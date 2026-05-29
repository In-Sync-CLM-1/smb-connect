import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { LogOut, Settings, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ConversationList } from '@/components/messages/ConversationList';
import { MessageThread } from '@/components/messages/MessageThread';
import { BackButton } from '@/components/BackButton';
import { MobileNavigation } from '@/components/layout/MobileNavigation';
import { useUnreadMessageCount } from '@/hooks/useUnreadMessageCount';

export default function MemberMessages() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [profile, setProfile] = useState<any>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const { refreshCount } = useUnreadMessageCount(currentUserId);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return;

      setCurrentUserId(user.id);

      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (profileData) {
        setProfile(profileData);
      }
    } catch (error: any) {
      console.error('Error loading profile:', error);
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      toast({
        title: 'Success',
        description: 'You have been logged out',
      });
      navigate('/auth/login');
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to logout',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col pb-16 md:pb-0">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto py-3 md:py-4 md:!pl-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BackButton fallbackPath={window.location.pathname.includes('/association') ? '/association/feed' : '/feed'} variant="ghost" />
            <div>
              <h1 className="text-lg md:text-2xl font-bold">Messaging</h1>
              <p className="text-xs md:text-sm text-muted-foreground hidden sm:block">Stay connected</p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-3">
            {profile && currentUserId && (
              <Avatar 
                className="cursor-pointer hover:ring-2 hover:ring-primary transition-all" 
                onClick={() => navigate(`/profile/${currentUserId}`)}
              >
                <AvatarImage src={profile.avatar || undefined} />
                <AvatarFallback>
                  {profile.first_name?.[0]}{profile.last_name?.[0]}
                </AvatarFallback>
              </Avatar>
            )}
            <Button variant="outline" onClick={() => navigate('/account-settings')}>
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </Button>
            <Button variant="outline" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content - Mobile-first layout */}
      <main className="flex-1 flex overflow-hidden">
        <div className="flex w-full h-[calc(100vh-73px-64px)] md:h-[calc(100vh-73px)]">
          {/* Conversations List - full width on mobile when no chat selected */}
          <div className={`${selectedChatId ? 'hidden md:block' : 'w-full'} md:w-80 border-r bg-card flex-shrink-0`}>
            <ConversationList 
              selectedChatId={selectedChatId}
              onSelectChat={setSelectedChatId}
              currentUserId={currentUserId}
            />
          </div>

          {/* Message Thread - full width on mobile when chat selected */}
          <div className={`${selectedChatId ? 'w-full' : 'hidden'} md:flex md:flex-1 flex-col`}>
            {selectedChatId ? (
              <div className="flex flex-col h-full">
                {/* Mobile back button */}
                <div className="md:hidden border-b p-2">
                  <Button variant="ghost" size="sm" onClick={() => setSelectedChatId(null)}>
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to conversations
                  </Button>
                </div>
                <div className="flex-1">
                  <MessageThread 
                    chatId={selectedChatId}
                    currentUserId={currentUserId}
                    onMarkAsRead={refreshCount}
                  />
                </div>
              </div>
            ) : (
              <div className="hidden md:flex flex-1 items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <p className="text-lg mb-2">Select a conversation to start messaging</p>
                  <p className="text-sm">Connect with members in your network</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
      
      <MobileNavigation />
    </div>
  );
}
