import { useLocation, useNavigate } from "react-router-dom";
import { Home, Users, MessageCircle, UserPlus, Bell, Bookmark } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUnreadMessageCount } from "@/hooks/useUnreadMessageCount";
import { usePendingConnectionCount } from "@/hooks/usePendingConnectionCount";
import { useNotifications } from "@/hooks/useNotifications";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface NavItem {
  icon: React.ElementType;
  label: string;
  path: string;
}

const getNavItems = (pathname: string): NavItem[] => {
  const isAssociation = pathname.startsWith('/association');
  const isCompany = pathname.startsWith('/company');

  const feedPath = isAssociation ? '/association/feed' : isCompany ? '/company/feed' : '/feed';
  const membersPath = isAssociation ? '/association/members' : isCompany ? '/company/members' : '/members';

  return [
    { icon: Home, label: "Feed", path: feedPath },
    { icon: Users, label: "Members", path: membersPath },
    { icon: MessageCircle, label: "Messages", path: "/messages" },
    { icon: Bookmark, label: "Saved", path: "/saved-posts" },
    { icon: Bell, label: "Alerts", path: "/notifications" },
  ];
};

export function MobileNavigation() {
  const location = useLocation();
  const navigate = useNavigate();
  const navItems = getNavItems(location.pathname);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const { unreadCount } = useUnreadMessageCount(currentUserId);
  const pendingConnectionCount = usePendingConnectionCount(currentUserId);
  const { unreadCount: notificationCount } = useNotifications(currentUserId);

  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      setCurrentUserId(user?.id || null);
    };
    getUser();
  }, []);

  const isActive = (path: string) => {
    if (path === "/feed" || path === "/association/feed" || path === "/company/feed") {
      return location.pathname === path || location.pathname === "/";
    }
    return location.pathname.startsWith(path);
  };

  const getBadgeCount = (path: string): number => {
    if (path === "/messages") return unreadCount;
    if (path === "/connections") return pendingConnectionCount;
    if (path === "/notifications") return notificationCount;
    return 0;
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border md:hidden safe-area-bottom">
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const active = isActive(item.path);
          const badgeCount = getBadgeCount(item.path);
          return (
            <button
              key={item.path}
              onClick={() => {
                if (location.pathname === item.path || (item.path.endsWith('/feed') && location.pathname === item.path)) {
                  // Already on this page - scroll to top and signal reset
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                  // Use replace navigation with state to trigger re-render
                  navigate(item.path, { replace: true, state: { resetTab: Date.now() } });
                } else {
                  navigate(item.path);
                }
              }}
              className={cn(
                "flex flex-col items-center justify-center w-full h-full gap-1 transition-colors relative",
                "active:scale-95 touch-manipulation",
                active
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <div className="relative">
                <item.icon className={cn("h-5 w-5", active && "stroke-[2.5px]")} />
                {badgeCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] flex items-center justify-center bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full px-1">
                    {badgeCount > 9 ? "9+" : badgeCount}
                  </span>
                )}
              </div>
              <span className={cn("text-[10px]", active && "font-medium")}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
