import { Link, useLocation } from "react-router-dom";
import { Home, BookOpen, ClipboardList, RotateCcw, User } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export default function MobileBottomNav() {
  const location = useLocation();
  const { user } = useAuth();

  const navItems = [
    { label: "Home", path: "/", icon: Home },
    { label: "Study", path: "/blog", icon: BookOpen },
    { label: "Practice", path: "/mcqs", icon: ClipboardList },
    { label: "Revision", path: "/revision-index", icon: RotateCcw },
    { label: user ? "Account" : "Sign in", path: user ? "/account" : "/login", icon: User },
  ];

  return (
    <nav
      aria-label="Primary mobile navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-[90] border-t border-border bg-background/98 shadow-[0_-4px_18px_hsl(var(--foreground)/.06)] safe-area-pb"
    >
      <div className="mx-auto flex h-14 max-w-xl items-stretch px-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.path === "/"
              ? location.pathname === "/"
              : location.pathname === item.path || location.pathname.startsWith(item.path + "/");

          return (
            <Link
              key={item.path}
              to={item.path}
              aria-current={isActive ? "page" : undefined}
              className={[
                "flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 py-1.5",
                "text-[10px] font-semibold transition-colors",
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground",
              ].join(" ")}
            >
              <Icon aria-hidden="true" className="h-[19px] w-[19px]" strokeWidth={isActive ? 2.4 : 1.8} />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}