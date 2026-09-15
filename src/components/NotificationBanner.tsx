import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { openNotificationAction } from "@/lib/notification-navigation";
import {
  Bell,
  Sparkles,
  BookOpen,
  GraduationCap,
  X,
  ExternalLink,
  ChevronRight,
} from "lucide-react";
import {
  AppNotification,
  subscribeToBanner,
  markNotificationAsRead,
} from "@/lib/notifications";

export default function NotificationBanner() {
  const [activeNotif, setActiveNotif] = useState<AppNotification | null>(null);
  const [visible, setVisible] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = subscribeToBanner((notif) => {
      setActiveNotif(notif);
      setVisible(true);
    });
    return unsubscribe;
  }, []);

  // Auto-dismiss after 7 seconds
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => {
      setVisible(false);
    }, 7000);
    return () => clearTimeout(timer);
  }, [visible, activeNotif]);

  if (!activeNotif) return null;

  const handleOpen = () => {
    if (activeNotif) {
      markNotificationAsRead(activeNotif.id);
      setVisible(false);
      if (activeNotif.action_url) {
        openNotificationAction(activeNotif.action_url, navigate);
      }
    }
  };

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (activeNotif) markNotificationAsRead(activeNotif.id);
    setVisible(false);
  };

  // Icon & Theme based on notification type
  const getBadgeConfig = (type: string) => {
    switch (type) {
      case "exam":
        return {
          icon: GraduationCap,
          label: "EXAM ALERT",
          badgeBg: "bg-amber-500/20 text-amber-400 border-amber-500/30",
          iconBg: "bg-amber-500 text-black",
        };
      case "update":
        return {
          icon: Sparkles,
          label: "NEW UPDATE",
          badgeBg: "bg-blue-500/20 text-blue-400 border-blue-500/30",
          iconBg: "bg-blue-500 text-white",
        };
      case "note":
        return {
          icon: BookOpen,
          label: "STUDY NOTES",
          badgeBg: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
          iconBg: "bg-emerald-500 text-white",
        };
      default:
        return {
          icon: Bell,
          label: "ANNOUNCEMENT",
          badgeBg: "bg-teal-500/20 text-teal-400 border-teal-500/30",
          iconBg: "bg-teal-600 text-white",
        };
    }
  };

  const badge = getBadgeConfig(activeNotif.type);
  const Icon = badge.icon;

  return (
    <div
      aria-live="polite"
      className={`fixed top-3 left-1/2 -translate-x-1/2 z-[100] w-[94%] max-w-md transition-all duration-300 ease-out ${
        visible
          ? "translate-y-0 opacity-100 scale-100 pointer-events-auto"
          : "-translate-y-10 opacity-0 scale-95 pointer-events-none"
      }`}
    >
      <div
        onClick={handleOpen}
        className="group relative cursor-pointer overflow-hidden rounded-2xl border border-white/15 bg-slate-950/90 p-3.5 shadow-2xl backdrop-blur-xl transition-all hover:border-white/30 hover:bg-slate-900/95"
      >
        {/* Subtle accent glow */}
        <div className="absolute inset-x-0 -top-px h-0.5 bg-gradient-to-r from-transparent via-emerald-500/60 to-transparent" />

        <div className="flex items-start gap-3">
          {/* Notification Icon (WhatsApp style rounded badge) */}
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-md ${badge.iconBg}`}
          >
            <Icon className="h-5 w-5" />
          </div>

          {/* Body Content */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-white/90">
                  Ompath Study
                </span>
                <span
                  className={`rounded-md border px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wider ${badge.badgeBg}`}
                >
                  {badge.label}
                </span>
              </div>
              <span className="text-[10px] text-white/40">Just now</span>
            </div>

            <p className="mt-0.5 truncate text-sm font-semibold text-white">
              {activeNotif.title}
            </p>
            <p className="line-clamp-2 text-xs text-white/70">
              {activeNotif.message}
            </p>

            {/* Tap cue / Action button */}
            {activeNotif.action_url && (
              <div className="mt-2 flex items-center gap-1 text-[11px] font-medium text-emerald-400">
                <span>Open now</span>
                <ChevronRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
              </div>
            )}
          </div>

          {/* Dismiss Button */}
          <button
            onClick={handleDismiss}
            aria-label="Dismiss notification"
            className="shrink-0 rounded-lg p-1 text-white/40 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
