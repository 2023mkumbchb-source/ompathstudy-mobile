import { Link, useLocation } from "react-router-dom";
import { Home, BookOpen, Award, User, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export default function MobileBottomNav() {
  const location = useLocation();
  const currentPath = location.pathname;
  const { user } = useAuth();

  const navItems = [
    { label: "Home", path: "/", icon: Home },
    { label: "Library", path: "/blog", icon: BookOpen },
    { label: "MCQs", path: "/mcqs", icon: Award },
    { label: user ? "Account" : "Sign In", path: user ? "/account" : "/login", icon: User },
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
              </div>
              <span className="mt-0.5 tracking-tight">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
