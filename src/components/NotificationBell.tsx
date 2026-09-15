import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { openNotificationAction } from "@/lib/notification-navigation";
import {
  Bell,
  CheckCheck,
  Sparkles,
  BookOpen,
  GraduationCap,
  ChevronRight,
  ExternalLink,
  Trash2,
  Clock,
  ShieldCheck,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  AppNotification,
  getCachedNotifications,
  getReadNotificationIds,
  subscribeToNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  fetchBroadcastNotifications,
} from "@/lib/notifications";

function formatRelativeTime(dateStr: string): string {
  try {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    return new Date(dateStr).toLocaleDateString();
  } catch {
    return "Recently";
  }
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<"all" | "exam" | "update">("all");
  const navigate = useNavigate();

  useEffect(() => {
    // Initial sync
    setNotifications(getCachedNotifications());
    setReadIds(getReadNotificationIds());

    // Subscribe to updates
    const unsubscribe = subscribeToNotifications((updated) => {
      setNotifications(updated);
      setReadIds(getReadNotificationIds());
    });

    // Remote fetch in background
    fetchBroadcastNotifications();

    return unsubscribe;
  }, []);

  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !readIds.has(n.id)).length;
  }, [notifications, readIds]);

  const filtered = useMemo(() => {
    if (activeTab === "all") return notifications;
    if (activeTab === "exam") return notifications.filter((n) => n.type === "exam");
    if (activeTab === "update") return notifications.filter((n) => n.type === "update" || n.type === "note");
    return notifications;
  }, [notifications, activeTab]);

  const handleSelect = (notif: AppNotification) => {
    markNotificationAsRead(notif.id);
    setReadIds(new Set(readIds).add(notif.id));
    setOpen(false);

    if (notif.action_url) {
      openNotificationAction(notif.action_url, navigate);
    }
  };

  const handleMarkAllRead = () => {
    markAllNotificationsAsRead();
    setReadIds(new Set(notifications.map((n) => n.id)));
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "exam":
        return <GraduationCap className="h-4 w-4 text-amber-500" />;
      case "update":
        return <Sparkles className="h-4 w-4 text-blue-500" />;
      case "note":
        return <BookOpen className="h-4 w-4 text-emerald-500" />;
      default:
        return <Bell className="h-4 w-4 text-teal-500" />;
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          className="relative rounded-full p-2 text-white/80 transition-colors hover:bg-white/10 hover:text-white focus:outline-none"
          aria-label={`Notifications ${unreadCount > 0 ? `(${unreadCount} unread)` : ""}`}
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white shadow-sm ring-2 ring-[hsl(174,62%,16%)] animate-pulse">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </SheetTrigger>

      <SheetContent
        side="right"
        className="w-full sm:max-w-md p-0 bg-background border-border flex flex-col h-full"
      >
        {/* Header */}
        <div className="border-b border-border p-4 bg-muted/40">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Bell className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-base font-semibold leading-tight">
                  Notification Center
                </h2>
                <p className="text-xs text-muted-foreground">
                  Exam reminders & platform updates
                </p>
              </div>
            </div>

            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
                title="Mark all as read"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                <span>Mark all read</span>
              </button>
            )}
          </div>

          {/* Filter Tabs */}
          <div className="mt-3 flex gap-1 rounded-lg bg-muted p-1 text-xs font-medium">
            <button
              onClick={() => setActiveTab("all")}
              className={`flex-1 rounded-md py-1 transition-all ${
                activeTab === "all"
                  ? "bg-background text-foreground shadow-sm font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              All ({notifications.length})
            </button>
            <button
              onClick={() => setActiveTab("exam")}
              className={`flex-1 rounded-md py-1 transition-all ${
                activeTab === "exam"
                  ? "bg-background text-foreground shadow-sm font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Exams ({notifications.filter((n) => n.type === "exam").length})
            </button>
            <button
              onClick={() => setActiveTab("update")}
              className={`flex-1 rounded-md py-1 transition-all ${
                activeTab === "update"
                  ? "bg-background text-foreground shadow-sm font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Updates ({notifications.filter((n) => n.type === "update" || n.type === "note").length})
            </button>
          </div>
        </div>

        {/* Notifications Scroll List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground mb-3">
                <Bell className="h-6 w-6 opacity-40" />
              </div>
              <p className="text-sm font-semibold text-foreground">
                No notifications in this tab
              </p>
              <p className="mt-1 text-xs text-muted-foreground max-w-xs">
                When new exam announcements or notes are published, they will appear here.
              </p>
            </div>
          ) : (
            filtered.map((item) => {
              const isUnread = !readIds.has(item.id);
              return (
                <div
                  key={item.id}
                  onClick={() => handleSelect(item)}
                  className={`group relative cursor-pointer rounded-xl border p-3.5 transition-all ${
                    isUnread
                      ? "border-primary/30 bg-primary/5 hover:border-primary/50 hover:bg-primary/10 shadow-sm"
                      : "border-border/60 bg-card hover:border-border hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Icon container */}
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-background border border-border shadow-xs">
                      {getIcon(item.type)}
                    </div>

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-semibold capitalize text-muted-foreground">
                          {item.type === "exam"
                            ? "Exam Alert"
                            : item.type === "update"
                            ? "App Update"
                            : item.type === "note"
                            ? "New Notes"
                            : "Announcement"}
                          {item.study_year ? ` · Year ${item.study_year}` : ""}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Clock className="h-2.5 w-2.5" />
                            {formatRelativeTime(item.created_at)}
                          </span>
                          {isUnread && (
                            <span className="h-2 w-2 rounded-full bg-rose-500 ring-2 ring-rose-500/20" />
                          )}
                        </div>
                      </div>

                      <h4 className="mt-1 text-sm font-semibold text-foreground leading-snug">
                        {item.title}
                      </h4>
                      <p className="mt-1 text-xs text-muted-foreground line-clamp-3 leading-relaxed whitespace-pre-line">
                        {item.message}
                      </p>

                      {item.action_url && (
                        <div className="mt-2.5 flex items-center gap-1 text-xs font-semibold text-primary">
                          <span>View details</span>
                          <ChevronRight className="h-3 w-3 transition-transform group-hover:translate-x-1" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border p-3 space-y-2 bg-muted/20">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setOpen(false);
              navigate("/notifications");
            }}
            className="w-full text-xs font-semibold gap-1.5 h-8 border-border hover:bg-background"
          >
            <Bell className="h-3.5 w-3.5 text-primary" />
            <span>Open Notification Center</span>
          </Button>

          <p className="flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground">
            <ShieldCheck className="h-3 w-3 text-emerald-500" />
            <span>Synced on device · Accessible offline</span>
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
