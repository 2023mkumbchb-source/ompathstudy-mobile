import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import {
  Bell,
  CheckCheck,
  GraduationCap,
  Sparkles,
  BookOpen,
  ChevronRight,
  Clock,
  Smartphone,
  Volume2,
  ShieldCheck,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { openNotificationAction } from "@/lib/notification-navigation";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  AppNotification,
  NotificationType,
  getCachedNotifications,
  getReadNotificationIds,
  subscribeToNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  fetchBroadcastNotifications,
  getMobileNotificationPrefs,
  saveMobileNotificationPrefs,
  MobileNotificationPrefs,
  checkNotificationPermission,
  requestNotificationPermission,
  triggerNativeNotification,
  playNotificationChime,
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

export default function Notifications() {
  const { toast } = useToast();
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<"all" | NotificationType>("all");

  // Mobile Preferences
  const [prefs, setPrefs] = useState<MobileNotificationPrefs>(getMobileNotificationPrefs());
  const [permissionStatus, setPermissionStatus] = useState<"granted" | "denied" | "prompt">("granted");
  const [checkingPermission, setCheckingPermission] = useState(false);

  useEffect(() => {
    // Initial sync
    setNotifications(getCachedNotifications());
    setReadIds(getReadNotificationIds());
    setPrefs(getMobileNotificationPrefs());

    // Check Android permission
    checkNotificationPermission().then(setPermissionStatus);

    // Subscribe to real-time broadcasts
    const unsubscribe = subscribeToNotifications((updated) => {
      setNotifications(updated);
      setReadIds(getReadNotificationIds());
    });

    // Remote sync
    fetchBroadcastNotifications();

    return unsubscribe;
  }, []);

  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !readIds.has(n.id)).length;
  }, [notifications, readIds]);

  const filtered = useMemo(() => {
    if (activeTab === "all") return notifications;
    return notifications.filter((n) => n.type === activeTab);
  }, [notifications, activeTab]);

  const handleSelect = (notif: AppNotification) => {
    markNotificationAsRead(notif.id);
    setReadIds(new Set(readIds).add(notif.id));

    if (notif.action_url) {
      openNotificationAction(notif.action_url, navigate);
    }
  };

  const handleMarkAllRead = () => {
    markAllNotificationsAsRead();
    setReadIds(new Set(notifications.map((n) => n.id)));
    toast({ title: "All notifications marked as read" });
  };

  const handleTogglePref = (key: keyof MobileNotificationPrefs, val: boolean) => {
    const updated = saveMobileNotificationPrefs({ [key]: val });
    setPrefs(updated);
    toast({
      title: "Settings updated",
      description: `${key === "pushEnabled" ? "Device push" : key === "soundEnabled" ? "Chime sound" : "In-app banner"} is now ${val ? "enabled" : "disabled"}.`,
    });
  };

  const handleRequestPermission = async () => {
    setCheckingPermission(true);
    const granted = await requestNotificationPermission();
    setCheckingPermission(false);
    setPermissionStatus(granted ? "granted" : "denied");
    if (granted) {
      toast({ title: "Notification permission granted! 🔔" });
    } else {
      toast({
        title: "Permission denied",
        description: "Please allow notifications in Android App Info settings.",
        variant: "destructive",
      });
    }
  };

  const handleTestAlert = async () => {
    playNotificationChime();
    await triggerNativeNotification({
      id: `test_${Date.now()}`,
      title: "Medical Pathology CAT 1 Reminder",
      message: "This is a test mobile alert from Ompath Study. Your audio and notifications are working smoothly!",
      type: "exam",
      priority: "urgent",
      created_at: new Date().toISOString(),
      action_url: "/exams",
    });
    toast({
      title: "Test notification sent! 🔔",
      description: "Check your status bar and listen for the chime sound.",
    });
  };

  const getBadgeStyle = (type: NotificationType) => {
    switch (type) {
      case "exam":
        return {
          icon: GraduationCap,
          bg: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
          iconBg: "bg-amber-500 text-white",
          label: "Exam Alert",
        };
      case "update":
        return {
          icon: Sparkles,
          bg: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
          iconBg: "bg-blue-500 text-white",
          label: "App Update",
        };
      case "note":
        return {
          icon: BookOpen,
          bg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
          iconBg: "bg-emerald-500 text-white",
          label: "New Notes",
        };
      default:
        return {
          icon: Bell,
          bg: "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20",
          iconBg: "bg-teal-500 text-white",
          label: "Announcement",
        };
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:py-8 space-y-6">
      <Helmet>
        <title>App Notifications | Ompath Study</title>
        <meta name="description" content="View platform notifications, examination alerts, and app updates." />
      </Helmet>

      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 font-serif text-2xl sm:text-3xl font-bold text-foreground">
            <Bell className="h-6 w-6 text-primary" />
            <span>App Notifications</span>
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
            Exams, notes, and platform alerts synced to this device
          </p>
        </div>

        {unreadCount > 0 && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleMarkAllRead}
            className="gap-1.5 text-xs font-semibold"
          >
            <CheckCheck className="h-3.5 w-3.5 text-primary" />
            <span>Mark all read</span>
          </Button>
        )}
      </div>

      {/* Mobile Notification Controls Card */}
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Smartphone className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-bold text-foreground">Mobile Alert Settings</h2>
          </div>

          <Button
            size="sm"
            variant="ghost"
            onClick={handleTestAlert}
            className="h-8 gap-1.5 text-xs text-primary hover:bg-primary/10 font-semibold"
          >
            <Volume2 className="h-3.5 w-3.5" />
            <span>Test Sound & Alert</span>
          </Button>
        </div>

        {/* Android Permission Banner if needed */}
        {permissionStatus !== "granted" && (
          <div className="flex items-start justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs">
            <div className="flex items-start gap-2 text-amber-700 dark:text-amber-300">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Notification Permission Needed</p>
                <p className="text-[11px] opacity-90">
                  Allow notifications so your device can receive exam reminders when the app is closed.
                </p>
              </div>
            </div>
            <Button
              size="sm"
              onClick={handleRequestPermission}
              disabled={checkingPermission}
              className="shrink-0 h-7 text-xs bg-amber-600 hover:bg-amber-700 text-white font-semibold"
            >
              Grant
            </Button>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          {/* Push Notifications */}
          <div className="flex items-center justify-between rounded-xl border border-border/70 bg-muted/20 p-3">
            <div>
              <span className="block text-xs font-semibold text-foreground">Status Bar Push</span>
              <span className="text-[10px] text-muted-foreground">Android tray alerts</span>
            </div>
            <Switch
              checked={prefs.pushEnabled}
              onCheckedChange={(c) => handleTogglePref("pushEnabled", c)}
            />
          </div>

          {/* WhatsApp Popups */}
          <div className="flex items-center justify-between rounded-xl border border-border/70 bg-muted/20 p-3">
            <div>
              <span className="block text-xs font-semibold text-foreground">In-App Popups</span>
              <span className="text-[10px] text-muted-foreground">Floating banners</span>
            </div>
            <Switch
              checked={prefs.bannerEnabled}
              onCheckedChange={(c) => handleTogglePref("bannerEnabled", c)}
            />
          </div>

          {/* Sound / Chime */}
          <div className="flex items-center justify-between rounded-xl border border-border/70 bg-muted/20 p-3">
            <div>
              <span className="block text-xs font-semibold text-foreground">Alert Chimes</span>
              <span className="text-[10px] text-muted-foreground">Sound on new alert</span>
            </div>
            <Switch
              checked={prefs.soundEnabled}
              onCheckedChange={(c) => handleTogglePref("soundEnabled", c)}
            />
          </div>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 text-xs">
        {[
          { id: "all", label: `All (${notifications.length})` },
          { id: "exam", label: `📝 Exams (${notifications.filter((n) => n.type === "exam").length})` },
          { id: "update", label: `🚀 Updates (${notifications.filter((n) => n.type === "update").length})` },
          { id: "note", label: `📚 Notes (${notifications.filter((n) => n.type === "note").length})` },
          { id: "general", label: `📢 General (${notifications.filter((n) => n.type === "general").length})` },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`rounded-full px-3.5 py-1.5 font-medium whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? "bg-primary text-primary-foreground font-semibold shadow-2xs"
                : "bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Notification List */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground mb-3">
              <Bell className="h-6 w-6 opacity-40" />
            </div>
            <h3 className="font-semibold text-sm text-foreground">No notifications in this category</h3>
            <p className="mt-1 text-xs text-muted-foreground max-w-xs">
              When new exam announcements, clinical notes, or updates are published, you will see them here.
            </p>
          </div>
        ) : (
          filtered.map((item) => {
            const isUnread = !readIds.has(item.id);
            const badge = getBadgeStyle(item.type);
            const Icon = badge.icon;

            return (
              <div
                key={item.id}
                onClick={() => handleSelect(item)}
                className={`group relative cursor-pointer rounded-2xl border p-4 transition-all ${
                  isUnread
                    ? "border-primary/30 bg-primary/5 hover:border-primary/50 shadow-xs"
                    : "border-border bg-card hover:bg-muted/30"
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-xs ${badge.iconBg}`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>

                  {/* Body */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${badge.bg}`}
                        >
                          {badge.label}
                        </span>
                        {item.study_year && (
                          <span className="text-xs font-semibold text-primary">
                            Year {item.study_year}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatRelativeTime(item.created_at)}
                        </span>
                        {isUnread && (
                          <span className="h-2 w-2 rounded-full bg-rose-500 ring-2 ring-rose-500/20" />
                        )}
                      </div>
                    </div>

                    <h3 className="mt-1.5 font-semibold text-sm sm:text-base text-foreground">
                      {item.title}
                    </h3>
                    <p className="mt-1 text-xs sm:text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                      {item.message}
                    </p>

                    {item.action_url && (
                      <div className="mt-3 flex items-center gap-1 text-xs font-bold text-primary group-hover:underline">
                        <span>Open details & study notes</span>
                        <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Device Cache Footnote */}
      <div className="pt-2 text-center">
        <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
          <span>Notifications are stored locally and accessible offline anytime</span>
        </p>
      </div>
    </div>
  );
}
