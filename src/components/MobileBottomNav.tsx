import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Home, BookOpen, Award, Bell, User, Sparkles } from "lucide-react";
import {
  getCachedNotifications,
  getReadNotificationIds,
  subscribeToNotifications,
} from "@/lib/notifications";

export default function MobileBottomNav() {
  const location = useLocation();
  const currentPath = location.pathname;

  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const updateCount = () => {
      const all = getCachedNotifications();
      const read = getReadNotificationIds();
      setUnreadCount(all.filter((n) => !read.has(n.id)).length);
    };

    updateCount();
    const unsub = subscribeToNotifications(updateCount);
    return unsub;
  }, []);

  const navItems = [
    { label: "Home", path: "/", icon: Home },
    { label: "Library", path: "/blog", icon: BookOpen },
    { label: "MCQs", path: "/mcqs", icon: Award },
    { label: "Alerts", path: "/notifications", icon: Bell },
    { label: "Account", path: "/account", icon: User },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur border-t border-border shadow-lg safe-area-pb">
      <div className="flex items-center justify-around h-14 max-w-md mx-auto px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.path === "/"
              ? currentPath === "/"
              : currentPath.startsWith(item.path);

          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center justify-center flex-1 h-full py-1 text-[11px] font-medium transition-colors ${
                isActive
                  ? "text-primary font-bold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <div className="relative">
                <Icon size={20} strokeWidth={isActive ? 2.5 : 1.75} />
                {item.label === "Account" && (
                  <Sparkles
                    size={8}
                    className="absolute -top-1 -right-1 text-emerald-500 fill-emerald-500"
                  />
                )}
                {item.label === "Alerts" && unreadCount > 0 && (
                  <span className="absolute -top-1 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white shadow-xs animate-pulse">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </div>
              <span className="mt-0.5 tracking-tight">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
