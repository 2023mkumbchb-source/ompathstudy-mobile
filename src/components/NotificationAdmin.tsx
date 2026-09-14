import { useEffect, useState } from "react";
import {
  Bell,
  Loader2,
  Send,
  GraduationCap,
  Sparkles,
  BookOpen,
  AlertCircle,
  Smartphone,
  Trash2,
  Volume2,
  CheckCircle2,
  Clock,
  ExternalLink,
  Pencil,
  Copy,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  AppNotification,
  NotificationType,
  NotificationPriority,
  publishBroadcastNotification,
  updateBroadcastNotification,
  deleteBroadcastNotification,
  fetchBroadcastNotifications,
  subscribeToNotifications,
  playNotificationChime,
  triggerNativeNotification,
} from "@/lib/notifications";
import { supabase } from "@/integrations/supabase/client";

const PRESET_LINKS = [
  { label: "Select a shortcut...", value: "" },
  { label: "Year 3 Hub", value: "/year/3" },
  { label: "Year 2 Hub", value: "/year/2" },
  { label: "Year 1 Hub", value: "/year/1" },
  { label: "Exam Revision Bank", value: "/revision-index" },
  { label: "Timed Weekly Exams", value: "/exams" },
  { label: "Mega Medical Contests", value: "/contests" },
  { label: "Latest Notes / Library", value: "/blog" },
  { label: "Latest Mobile App Update", value: "https://github.com/2023mkumbchb-source/ompathstudy-mobile/releases/latest" },
];

export default function NotificationAdmin() {
  const { toast } = useToast();

  const [type, setType] = useState<NotificationType>("exam");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [actionUrl, setActionUrl] = useState("");
  const [audience, setAudience] = useState<"all" | "year">("all");
  const [studyYear, setStudyYear] = useState("3");
  const [priority, setPriority] = useState<NotificationPriority>("urgent");
  const [sending, setSending] = useState(false);

  const [broadcasts, setBroadcasts] = useState<AppNotification[]>([]);

  // Edit Modal State
  const [editingItem, setEditingItem] = useState<AppNotification | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editType, setEditType] = useState<NotificationType>("exam");
  const [editTitle, setEditTitle] = useState("");
  const [editMessage, setEditMessage] = useState("");
  const [editActionUrl, setEditActionUrl] = useState("");
  const [editAudience, setEditAudience] = useState<"all" | "year">("all");
  const [editStudyYear, setEditStudyYear] = useState("3");
  const [editPriority, setEditPriority] = useState<NotificationPriority>("urgent");
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    fetchBroadcastNotifications().then(setBroadcasts);
    const unsub = subscribeToNotifications(setBroadcasts);
    return unsub;
  }, []);

  const handlePresetChange = (val: string) => {
    if (val) setActionUrl(val);
  };

  const handleSend = async () => {
    if (!title.trim() || !message.trim()) {
      return toast({
        title: "Missing details",
        description: "Please enter both a title and message for the notification.",
        variant: "destructive",
      });
    }

    setSending(true);
    try {
      // 1. Publish to real-time broadcast system (instant delivery to all APK & Web users)
      const notif = await publishBroadcastNotification({
        title: title.trim(),
        message: message.trim(),
        type,
        priority,
        study_year: audience === "year" ? Number(studyYear) : null,
        action_url: actionUrl.trim() || null,
      });

      // 2. Also record in background via edge function if authenticated admin
      try {
        await supabase.functions.invoke("send-notification", {
          body: {
            title: title.trim(),
            message: message.trim(),
            action_url: actionUrl.trim() || null,
            audience: audience === "year" ? "study_year" : "all_users",
            study_year: audience === "year" ? Number(studyYear) : null,
          },
        });
      } catch (edgeErr) {
        // Non-blocking
      }

      toast({
        title: "Broadcast Published Successfully! 🚀",
        description: `Notification dispatched to ${audience === "year" ? `Year ${studyYear} students` : "all learners"}. WhatsApp-style banner and status bar alerts triggered.`,
      });

      setTitle("");
      setMessage("");
      setActionUrl("");
    } catch (err: any) {
      toast({
        title: "Could not send broadcast",
        description: err.message || "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const startEdit = (item: AppNotification) => {
    setEditingItem(item);
    setEditType(item.type);
    setEditTitle(item.title);
    setEditMessage(item.message);
    setEditActionUrl(item.action_url || "");
    setEditAudience(item.study_year ? "year" : "all");
    setEditStudyYear(item.study_year ? String(item.study_year) : "3");
    setEditPriority(item.priority || "urgent");
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingItem) return;
    if (!editTitle.trim() || !editMessage.trim()) {
      return toast({
        title: "Missing fields",
        description: "Title and message cannot be empty.",
        variant: "destructive",
      });
    }

    setSavingEdit(true);
    try {
      await updateBroadcastNotification(editingItem.id, {
        title: editTitle.trim(),
        message: editMessage.trim(),
        type: editType,
        priority: editPriority,
        study_year: editAudience === "year" ? Number(editStudyYear) : null,
        action_url: editActionUrl.trim() || null,
      });

      toast({
        title: "Notification updated! ✏️",
        description: "Updated broadcast has been saved and synchronized.",
      });
      setEditOpen(false);
      setEditingItem(null);
    } catch (err: any) {
      toast({
        title: "Could not update notification",
        description: err.message || "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setSavingEdit(false);
    }
  };

  const handleTestOnDevice = async (b: AppNotification) => {
    try {
      playNotificationChime();
      await triggerNativeNotification(b);
      toast({
        title: "Test alert triggered! 🔔",
        description: `Notification sent to device: "${b.title}"`,
      });
    } catch (err: any) {
      toast({
        title: "Test trigger failed",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to retract and delete this notification?")) return;
    try {
      await deleteBroadcastNotification(id);
      toast({ title: "Notification retracted and deleted" });
    } catch (err: any) {
      toast({
        title: "Failed to delete",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  // Preview styling
  const getBadgeColor = () => {
    switch (type) {
      case "exam":
        return { bg: "bg-amber-500", text: "text-amber-400", label: "EXAM ALERT" };
      case "update":
        return { bg: "bg-blue-500", text: "text-blue-400", label: "NEW UPDATE" };
      case "note":
        return { bg: "bg-emerald-500", text: "text-emerald-400", label: "STUDY NOTES" };
      default:
        return { bg: "bg-teal-600", text: "text-teal-400", label: "ANNOUNCEMENT" };
    }
  };

  const badge = getBadgeColor();

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h2 className="flex items-center gap-2 font-serif text-2xl font-bold text-foreground">
          <Bell className="h-6 w-6 text-primary" /> Notification & Broadcast Studio
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Send real-time <strong>WhatsApp-style alerts</strong>, examination reminders, and update announcements to all OmpathStudy APK & web students.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Form Controls */}
        <div className="lg:col-span-7 space-y-5 rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-xs">
          <h3 className="font-semibold text-base flex items-center gap-2 text-foreground">
            <span>Compose Broadcast</span>
          </h3>

          {/* Type Selector */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Notification Category
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => setType("exam")}
                className={`flex flex-col items-center gap-1.5 rounded-xl border p-2.5 text-xs font-medium transition-all ${
                  type === "exam"
                    ? "border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold ring-2 ring-amber-500/20"
                    : "border-border hover:bg-muted text-muted-foreground"
                }`}
              >
                <GraduationCap className="h-4 w-4" />
                <span>📝 Exam Alert</span>
              </button>

              <button
                type="button"
                onClick={() => setType("update")}
                className={`flex flex-col items-center gap-1.5 rounded-xl border p-2.5 text-xs font-medium transition-all ${
                  type === "update"
                    ? "border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold ring-2 ring-blue-500/20"
                    : "border-border hover:bg-muted text-muted-foreground"
                }`}
              >
                <Sparkles className="h-4 w-4" />
                <span>🚀 App Update</span>
              </button>

              <button
                type="button"
                onClick={() => setType("note")}
                className={`flex flex-col items-center gap-1.5 rounded-xl border p-2.5 text-xs font-medium transition-all ${
                  type === "note"
                    ? "border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold ring-2 ring-emerald-500/20"
                    : "border-border hover:bg-muted text-muted-foreground"
                }`}
              >
                <BookOpen className="h-4 w-4" />
                <span>📚 New Notes</span>
              </button>

              <button
                type="button"
                onClick={() => setType("general")}
                className={`flex flex-col items-center gap-1.5 rounded-xl border p-2.5 text-xs font-medium transition-all ${
                  type === "general"
                    ? "border-teal-500 bg-teal-500/10 text-teal-600 dark:text-teal-400 font-bold ring-2 ring-teal-500/20"
                    : "border-border hover:bg-muted text-muted-foreground"
                }`}
              >
                <Bell className="h-4 w-4" />
                <span>📢 General</span>
              </button>
            </div>
          </div>

          {/* Target Audience */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Audience Scope
              </label>
              <Select value={audience} onValueChange={(v: any) => setAudience(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Students (App-wide Broadcast)</SelectItem>
                  <SelectItem value="year">Specific Study Year Only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {audience === "year" && (
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Target Study Year
                </label>
                <Select value={studyYear} onValueChange={setStudyYear}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6].map((y) => (
                      <SelectItem key={y} value={String(y)}>
                        Year {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Title */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Notification Title
            </label>
            <Input
              value={title}
              maxLength={120}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Year 3 Clinical Pathology CAT 1 Announced"
              className="font-medium"
            />
          </div>

          {/* Message Body */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Message Details
            </label>
            <Textarea
              value={message}
              maxLength={1000}
              onChange={(e) => setMessage(e.target.value)}
              className="min-h-24"
              placeholder="Provide exam dates, covered units, spot bank instructions, or update highlights..."
            />
            <p className="mt-1 text-right text-[11px] text-muted-foreground">
              {message.length}/1000
            </p>
          </div>

          {/* Action Link & Presets */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Target Link / Action URL
              </label>
              <Select onValueChange={handlePresetChange}>
                <SelectTrigger className="h-7 text-xs w-48">
                  <SelectValue placeholder="Quick preset..." />
                </SelectTrigger>
                <SelectContent>
                  {PRESET_LINKS.map((p) => (
                    <SelectItem key={p.value || "none"} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Input
              value={actionUrl}
              onChange={(e) => setActionUrl(e.target.value)}
              placeholder="e.g. /year/3 or /revision-index"
            />
          </div>

          {/* Priority & Urgent Switch */}
          <div className="flex items-center justify-between rounded-xl border border-border/80 bg-muted/30 p-3.5">
            <div>
              <span className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-amber-500" />
                Urgent WhatsApp-Style Alert
              </span>
              <p className="text-xs text-muted-foreground">
                Pops down immediately as a floating banner on student screens with notification sound.
              </p>
            </div>
            <Switch
              checked={priority === "urgent"}
              onCheckedChange={(c) => setPriority(c ? "urgent" : "normal")}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
            <Button
              onClick={handleSend}
              disabled={sending || !title.trim() || !message.trim()}
              className="flex-1 gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold h-11"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              <span>Send Broadcast Now</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => playNotificationChime()}
              className="gap-2 h-11"
              title="Test notification chime audio"
            >
              <Volume2 className="h-4 w-4" />
              <span>Test Chime</span>
            </Button>
          </div>
        </div>

        {/* Right Column: WhatsApp Smartphone Live Preview */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-base flex items-center gap-2 text-foreground">
              <Smartphone className="h-4 w-4 text-primary" />
              <span>Student Phone Preview</span>
            </h3>
            <span className="text-[11px] text-muted-foreground">Live Mockup</span>
          </div>

          {/* Mock Smartphone Frame */}
          <div className="relative mx-auto w-full max-w-[320px] rounded-[36px] border-4 border-slate-800 bg-slate-950 p-3 shadow-2xl">
            {/* Camera notch */}
            <div className="absolute top-2 left-1/2 -translate-x-1/2 h-3.5 w-24 rounded-full bg-slate-800" />

            {/* Screen content */}
            <div className="relative rounded-[28px] bg-slate-900 overflow-hidden min-h-[460px] flex flex-col justify-between p-3.5 border border-white/5">
              {/* WhatsApp-style Pop-down banner preview */}
              <div className="mt-4 rounded-2xl border border-white/20 bg-slate-950/95 p-3 shadow-xl backdrop-blur-md">
                <div className="flex items-start gap-2.5">
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white shadow-sm ${badge.bg}`}
                  >
                    {type === "exam" ? (
                      <GraduationCap className="h-4 w-4" />
                    ) : type === "update" ? (
                      <Sparkles className="h-4 w-4" />
                    ) : type === "note" ? (
                      <BookOpen className="h-4 w-4" />
                    ) : (
                      <Bell className="h-4 w-4" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-white/80">
                        Ompath Study
                      </span>
                      <span className="text-[9px] text-white/40">Just now</span>
                    </div>

                    <p className="truncate text-xs font-bold text-white">
                      {title || "Pathology CAT 1 Alert"}
                    </p>
                    <p className="line-clamp-2 text-[10px] text-white/70 mt-0.5">
                      {message ||
                        "Clinical questions and spotter bank now available for revision."}
                    </p>

                    <span className="mt-1.5 inline-block text-[9px] font-semibold text-emerald-400">
                      Tap to open →
                    </span>
                  </div>
                </div>
              </div>

              {/* Mock app home content underneath */}
              <div className="my-auto space-y-2.5 text-center opacity-30 pointer-events-none">
                <div className="h-3 w-3/4 mx-auto rounded-full bg-white/20" />
                <div className="h-2 w-1/2 mx-auto rounded-full bg-white/10" />
                <div className="grid grid-cols-2 gap-2 mt-4">
                  <div className="h-16 rounded-xl bg-white/5" />
                  <div className="h-16 rounded-xl bg-white/5" />
                </div>
              </div>

              {/* Bottom Nav Bar Mock */}
              <div className="flex items-center justify-around border-t border-white/10 pt-2 opacity-50">
                <div className="h-4 w-4 rounded-full bg-white/30" />
                <div className="h-4 w-4 rounded-full bg-white/30" />
                <div className="h-4 w-4 rounded-full bg-white/30" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Active Broadcasts History */}
      <div className="space-y-3 pt-4 border-t border-border">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-lg text-foreground">
            Active Broadcasts ({broadcasts.length})
          </h3>
          <span className="text-xs text-muted-foreground">
            Retracting removes the alert from students' devices
          </span>
        </div>

        {broadcasts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground">
            No active broadcasts. Send your first notification above!
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {broadcasts.map((b) => (
              <div
                key={b.id}
                className="flex items-start justify-between gap-3 rounded-xl border border-border bg-card p-4 shadow-2xs"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="rounded-md bg-secondary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      {b.type}
                    </span>
                    {b.study_year && (
                      <span className="text-xs font-semibold text-primary">
                        Year {b.study_year}
                      </span>
                    )}
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(b.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  <h4 className="mt-1 font-semibold text-sm text-foreground truncate">
                    {b.title}
                  </h4>
                  <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                    {b.message}
                  </p>

                  {b.action_url && (
                    <span className="mt-1.5 block text-[11px] text-primary truncate">
                      🔗 {b.action_url}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleTestOnDevice(b)}
                    className="h-8 w-8 text-muted-foreground hover:text-primary"
                    title="Send test alert to this device"
                  >
                    <Smartphone className="h-3.5 w-3.5" />
                  </Button>

                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => startEdit(b)}
                    className="h-8 w-8 text-muted-foreground hover:text-amber-500"
                    title="Edit broadcast"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>

                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleDelete(b.id)}
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    title="Retract broadcast"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit Notification Modal */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-primary" />
              <span>Edit Broadcast Notification</span>
            </DialogTitle>
            <DialogDescription>
              Update notification details. Saved changes sync to all student devices automatically.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Category */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Category
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { id: "exam", label: "📝 Exam" },
                  { id: "update", label: "🚀 Update" },
                  { id: "note", label: "📚 Notes" },
                  { id: "general", label: "📢 General" },
                ].map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setEditType(c.id as any)}
                    className={`rounded-lg border p-2 text-xs font-medium transition-all ${
                      editType === c.id
                        ? "border-primary bg-primary/10 text-primary font-bold ring-1 ring-primary/20"
                        : "border-border text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Audience */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Audience Scope
                </label>
                <Select value={editAudience} onValueChange={(v: any) => setEditAudience(v)}>
                  <SelectTrigger className="text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Students</SelectItem>
                    <SelectItem value="year">Specific Year</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {editAudience === "year" && (
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Target Study Year
                  </label>
                  <Select value={editStudyYear} onValueChange={setEditStudyYear}>
                    <SelectTrigger className="text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5, 6].map((y) => (
                        <SelectItem key={y} value={String(y)}>
                          Year {y}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Title */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Notification Title
              </label>
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                maxLength={120}
                placeholder="Notification Title"
                className="font-medium"
              />
            </div>

            {/* Message */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Message Details
              </label>
              <Textarea
                value={editMessage}
                onChange={(e) => setEditMessage(e.target.value)}
                rows={3}
                placeholder="Notification details..."
              />
            </div>

            {/* Action URL */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Action Link / Target URL
                </label>
                <Select onValueChange={(val) => { if (val) setEditActionUrl(val); }}>
                  <SelectTrigger className="h-6 text-[11px] w-36">
                    <SelectValue placeholder="Quick preset..." />
                  </SelectTrigger>
                  <SelectContent>
                    {PRESET_LINKS.map((p) => (
                      <SelectItem key={p.value || "none"} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Input
                value={editActionUrl}
                onChange={(e) => setEditActionUrl(e.target.value)}
                placeholder="e.g. /year/3 or /revision-index"
              />
            </div>

            {/* Priority */}
            <div className="flex items-center justify-between rounded-xl border border-border bg-muted/20 p-3">
              <div>
                <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                  Urgent WhatsApp Alert
                </span>
                <p className="text-[11px] text-muted-foreground">
                  Triggers immediate popup banner on students' screens
                </p>
              </div>
              <Switch
                checked={editPriority === "urgent"}
                onCheckedChange={(c) => setEditPriority(c ? "urgent" : "normal")}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => {
                setEditOpen(false);
                setEditingItem(null);
              }}
              disabled={savingEdit}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveEdit}
              disabled={savingEdit || !editTitle.trim() || !editMessage.trim()}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold gap-1.5"
            >
              {savingEdit ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              <span>Save Changes</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
