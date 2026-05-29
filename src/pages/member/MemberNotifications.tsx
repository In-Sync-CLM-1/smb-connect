import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, UserPlus, Heart, MessageCircle, Check, CheckCheck, ArrowLeft, Trash2, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useNotifications, Notification } from '@/hooks/useNotifications';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { MobileNavigation } from '@/components/layout/MobileNavigation';
import { BackButton } from '@/components/BackButton';

const getNotificationIcon = (type: string) => {
  switch (type) {
    case 'connection_request':
    case 'connection_accepted':
      return <UserPlus className="h-5 w-5 text-primary" />;
    case 'post_like':
      return <Heart className="h-5 w-5 text-destructive" />;
    case 'post_comment':
      return <MessageCircle className="h-5 w-5 text-blue-500" />;
    case 'association_post':
    case 'company_post':
      return <Building2 className="h-5 w-5 text-primary" />;
    case 'member_post':
      return <UserPlus className="h-5 w-5 text-blue-500" />;
    default:
      return <Bell className="h-5 w-5 text-muted-foreground" />;
  }
};

export default function MemberNotifications() {
  const navigate = useNavigate();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      setCurrentUserId(user?.id || null);
    };
    getUser();
  }, []);

  const { notifications, unreadCount, loading, markAsRead, markAllAsRead } = useNotifications(currentUserId);

  const filteredNotifications = filter === 'unread' 
    ? notifications.filter(n => !n.is_read)
    : notifications;

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.is_read) {
      await markAsRead(notification.id);
    }
    if (notification.link) {
      navigate(notification.link);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <header className="sticky top-0 z-40 bg-background border-b">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BackButton />
            <h1 className="text-lg font-semibold">Notifications</h1>
          </div>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={markAllAsRead}>
              <CheckCheck className="h-4 w-4 mr-2" />
              Mark all read
            </Button>
          )}
        </div>
      </header>

      <main className="container mx-auto px-4 py-4 max-w-2xl">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as 'all' | 'unread')}>
          <TabsList className="w-full mb-4">
            <TabsTrigger value="all" className="flex-1">
              All
            </TabsTrigger>
            <TabsTrigger value="unread" className="flex-1">
              Unread
              {unreadCount > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {unreadCount}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value={filter} className="mt-0">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <span className="text-muted-foreground">Loading notifications...</span>
              </div>
            ) : filteredNotifications.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Bell className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
                  <p className="text-muted-foreground">
                    {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {filteredNotifications.map((notification) => (
                  <Card
                    key={notification.id}
                    className={cn(
                      "cursor-pointer hover:bg-muted/50 transition-colors",
                      !notification.is_read && "border-primary/20 bg-primary/5"
                    )}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <CardContent className="flex items-start gap-4 p-4">
                      <div className="flex-shrink-0 mt-1">
                        {getNotificationIcon(notification.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={cn(
                            "text-sm",
                            !notification.is_read && "font-semibold"
                          )}>
                            {notification.title}
                          </p>
                          {!notification.is_read && (
                            <div className="flex-shrink-0">
                              <div className="h-2 w-2 rounded-full bg-primary" />
                            </div>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {notification.message}
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">
                          {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>

      <MobileNavigation />
    </div>
  );
}
