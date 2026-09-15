import { supabase } from "@/integrations/supabase/client";
import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";

export type NotificationType = "exam" | "update" | "note" | "general";
export type NotificationPriority = "normal" | "urgent";

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  priority: NotificationPriority;
  study_year?: number | null; // 1-6 or null/undefined for all years
  action_url?: string | null;
  created_at: string;
  expires_at?: string | null;
}

const STORAGE_KEY_NOTIFICATIONS = "ompath_cached_notifications_v1";
const STORAGE_KEY_READ_IDS = "ompath_read_notification_ids_v1";
const STORAGE_KEY_LAST_BANNER_ID = "ompath_last_banner_notif_id";
const STORAGE_KEY_PREFS = "ompath_mobile_notification_prefs_v1";

export interface MobileNotificationPrefs {
  pushEnabled: boolean;
  soundEnabled: boolean;
  bannerEnabled: boolean;
}

export function getMobileNotificationPrefs(): MobileNotificationPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PREFS);
    if (!raw) return { pushEnabled: true, soundEnabled: true, bannerEnabled: true };
    const parsed = JSON.parse(raw);
    return {
      pushEnabled: parsed.pushEnabled ?? true,
      soundEnabled: parsed.soundEnabled ?? true,
      bannerEnabled: parsed.bannerEnabled ?? true,
    };
  } catch {
    return { pushEnabled: true, soundEnabled: true, bannerEnabled: true };
  }
}

export function saveMobileNotificationPrefs(prefs: Partial<MobileNotificationPrefs>): MobileNotificationPrefs {
  const current = getMobileNotificationPrefs();
  const next = { ...current, ...prefs };
  localStorage.setItem(STORAGE_KEY_PREFS, JSON.stringify(next));
  return next;
}

export async function checkNotificationPermission(): Promise<"granted" | "denied" | "prompt"> {
  if (!Capacitor.isNativePlatform()) return "granted";
  try {
    const perm = await LocalNotifications.checkPermissions();
    return perm.display;
  } catch {
    return "granted";
  }
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return true;
  try {
    const req = await LocalNotifications.requestPermissions();
    return req.display === "granted";
  } catch {
    return false;
  }
}

type NotificationListener = (notifications: AppNotification[]) => void;
type BannerListener = (notification: AppNotification) => void;

const listeners: Set<NotificationListener> = new Set();
const bannerListeners: Set<BannerListener> = new Set();

export function subscribeToNotifications(listener: NotificationListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function subscribeToBanner(listener: BannerListener): () => void {
  bannerListeners.add(listener);
  return () => bannerListeners.delete(listener);
}

function notifyListeners(notifications: AppNotification[]) {
  listeners.forEach((l) => {
    try {
      l(notifications);
    } catch (e) {
      console.error("[Notifications] Listener error:", e);
    }
  });
}

function notifyBanner(notification: AppNotification) {
  if (!getMobileNotificationPrefs().bannerEnabled) return;
  bannerListeners.forEach((l) => {
    try {
      l(notification);
    } catch (e) {
      console.error("[Notifications] Banner error:", e);
    }
  });
}

/**
 * Get cached notifications from localStorage (instant, synchronous, offline-safe)
 */
export function getCachedNotifications(): AppNotification[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_NOTIFICATIONS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object" && Boolean(row.id))
      .map(normalizeNotification);
  } catch {
    return [];
  }
}

/**
 * Get array of notification IDs already read by this user
 */
export function getReadNotificationIds(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_READ_IDS);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function cacheAndNotify(notifications: AppNotification[]) {
  const sorted = [...notifications].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  localStorage.setItem(STORAGE_KEY_NOTIFICATIONS, JSON.stringify(sorted));
  notifyListeners(sorted);
  return sorted;
}

function normalizeNotification(row: Record<string, unknown>): AppNotification {
  return {
    id: String(row.id),
    title: String(row.title || "Ompath Study"),
    message: String(row.message || ""),
    type: (["exam", "update", "note", "general"].includes(String(row.type))
      ? row.type
      : "general") as NotificationType,
    priority: row.priority === "urgent" ? "urgent" : "normal",
    study_year: typeof row.study_year === "number" ? row.study_year : null,
    action_url: row.action_url ? String(row.action_url) : null,
    created_at: String(row.created_at || new Date().toISOString()),
    expires_at: row.expires_at ? String(row.expires_at) : null,
  };
}

/** Fetch the signed-in user's device/app notifications. */
export async function fetchUserNotifications(): Promise<AppNotification[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return cacheAndNotify(getCachedNotifications());
    const db = supabase as any;
    const query = db.from("user_notifications")
      .select("id,title,message,type,priority,study_year,action_url,created_at,expires_at")
      .eq("user_id", user.id).order("created_at", { ascending: false }).limit(100);
    const { data, error } = await query;
    if (error) throw error;
    return cacheAndNotify((data || []).map((row) => normalizeNotification(row as Record<string, unknown>)));
  } catch (err) {
    console.warn("[Notifications] Remote fetch failed, using offline cache:", err);
  }

  const cached = getCachedNotifications();
  notifyListeners(cached);
  return cached;
}

/** Fetch campaign records exclusively for the authenticated Broadcast Studio. */
export async function fetchAdminBroadcasts(): Promise<AppNotification[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Your admin session has expired. Please sign in again.");
  const { data: isAdmin, error: roleError } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
  if (roleError || !isAdmin) throw new Error("Administrator access is required.");
  const { data, error } = await (supabase as any).from("notification_campaigns")
    .select("id,title,message,type,priority,study_year,action_url,created_at,expires_at")
    .order("created_at", { ascending: false }).limit(100);
  if (error) throw error;
  return (data || []).map((row: Record<string, unknown>) => normalizeNotification(row));
}

/** Backward-compatible alias used by app notification consumers. */
export const fetchBroadcastNotifications = fetchUserNotifications;

async function invokeAdminNotificationAction(body: Record<string, unknown>) {
  let { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Your admin session has expired. Please sign in again.");
  if ((session.expires_at || 0) * 1000 < Date.now() + 30_000) {
    const refreshed = await supabase.auth.refreshSession();
    session = refreshed.data.session;
  }
  if (!session?.access_token) throw new Error("Could not refresh your admin session. Please sign in again.");
  const { data, error } = await supabase.functions.invoke("send-notification", {
    body,
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  if (error) {
    let detail = error.message;
    try {
      const response = (error as { context?: Response }).context;
      const payload = response ? await response.clone().json() : null;
      if (payload?.error) detail = payload.error;
    } catch { /* retain the transport error */ }
    throw new Error(detail || "Notification service could not be reached.");
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

/** Admin helper to securely publish through the authenticated Edge Function. */
export async function publishBroadcastNotification(
  input: Omit<AppNotification, "id" | "created_at">,
  delivery: { app: boolean; email: boolean } = { app: true, email: false },
): Promise<AppNotification> {
  const data = await invokeAdminNotificationAction({
    action: "create",
    ...input,
    audience: input.study_year ? "study_year" : "all_users",
    send_app: delivery.app,
    send_email: delivery.email,
  });
  const newNotif = normalizeNotification(data.campaign);
  const updated = cacheAndNotify([newNotif, ...getCachedNotifications().filter((n) => n.id !== newNotif.id)]);
  notifyBanner(newNotif);
  playNotificationChime();
  await triggerNativeNotification(newNotif);
  return newNotif;
}

/**
 * Admin helper to delete an existing notification broadcast.
 */
export async function deleteBroadcastNotification(id: string): Promise<void> {
  await invokeAdminNotificationAction({ action: "delete", campaign_id: id });
  cacheAndNotify(getCachedNotifications().filter((n) => n.id !== id));
}

/**
 * Admin helper to update an existing notification broadcast.
 */
export async function updateBroadcastNotification(
  id: string,
  updates: Partial<Omit<AppNotification, "id" | "created_at">>
): Promise<AppNotification> {
  const data = await invokeAdminNotificationAction({
    action: "update",
    campaign_id: id,
    ...updates,
    audience: updates.study_year ? "study_year" : "all_users",
  });
  const updatedNotif = normalizeNotification(data.campaign);
  cacheAndNotify(getCachedNotifications().map((n) => n.id === id ? updatedNotif : n));
  return updatedNotif;
}

/**
 * Mark a single notification as read
 */
export function markNotificationAsRead(id: string) {
  const read = getReadNotificationIds();
  read.add(id);
  localStorage.setItem(STORAGE_KEY_READ_IDS, JSON.stringify(Array.from(read)));
  notifyListeners(getCachedNotifications());
  if (/^[0-9a-f-]{36}$/i.test(id)) {
    void (supabase as any).from("user_notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
  }
}

let realtimeCleanup: (() => void) | null = null;

/** Subscribe the authenticated device to new per-user notifications in real time. */
export async function startNotificationRealtime(): Promise<() => void> {
  realtimeCleanup?.();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return () => {};

  const channel = supabase
    .channel(`mobile-notifications-${user.id}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "user_notifications", filter: `user_id=eq.${user.id}` },
      ({ new: row }) => {
        const notification = normalizeNotification(row as Record<string, unknown>);
        cacheAndNotify([notification, ...getCachedNotifications().filter((n) => n.id !== notification.id)]);
        notifyBanner(notification);
        playNotificationChime();
        void triggerNativeNotification(notification);
      },
    )
    .subscribe();

  realtimeCleanup = () => {
    void supabase.removeChannel(channel);
    realtimeCleanup = null;
  };
  return realtimeCleanup;
}

/**
 * Mark all notifications as read
 */
export function markAllNotificationsAsRead() {
  const all = getCachedNotifications();
  const read = getReadNotificationIds();
  all.forEach((n) => read.add(n.id));
  localStorage.setItem(STORAGE_KEY_READ_IDS, JSON.stringify(Array.from(read)));
  notifyListeners(all);
  void supabase.auth.getUser().then(({ data: { user } }) => {
    if (user) {
      return (supabase as any).from("user_notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .is("read_at", null);
    }
  });
}

/**
 * Check for new unread notifications and pop the WhatsApp-style banner if a new one is found.
 */
export async function checkForNewNotifications(): Promise<void> {
  const notifications = await fetchUserNotifications();
  if (!notifications.length) return;

  const readIds = getReadNotificationIds();
  const latest = notifications[0];

  const lastBannerId = localStorage.getItem(STORAGE_KEY_LAST_BANNER_ID);

  // If latest is unread and haven't shown banner for it yet
  if (!readIds.has(latest.id) && lastBannerId !== latest.id) {
    localStorage.setItem(STORAGE_KEY_LAST_BANNER_ID, latest.id);
    notifyBanner(latest);
    playNotificationChime();
    await triggerNativeNotification(latest);
  }
}

/**
 * Convert UUID or string ID to 32-bit integer for Android LocalNotification ID
 */
function hashStringToInt(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * Trigger real native Android notification in status bar via @capacitor/local-notifications
 */
export async function triggerNativeNotification(notification: AppNotification): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  if (!getMobileNotificationPrefs().pushEnabled) return;

  try {
    // Check/request permission
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display !== "granted") {
      const req = await LocalNotifications.requestPermissions();
      if (req.display !== "granted") return;
    }

    const typePrefix =
      notification.type === "exam"
        ? "Exam alert: "
        : notification.type === "update"
        ? "App update: "
        : notification.type === "note"
        ? "New study material: "
        : "Ompath Study: ";

    await LocalNotifications.schedule({
      notifications: [
        {
          id: hashStringToInt(notification.id),
          title: `${typePrefix}${notification.title}`,
          body: notification.message,
          schedule: { at: new Date(Date.now() + 200) },
          sound: "default",
          extra: {
            actionUrl: notification.action_url || "/",
            notificationId: notification.id,
          },
        },
      ],
    });
  } catch (err) {
    console.warn("[Notifications] Native notification trigger failed:", err);
  }
}

/**
 * Setup native Android notification tap action listener
 */
export function setupNativeNotificationListener(onNavigate: (url: string) => void) {
  if (!Capacitor.isNativePlatform()) return;

  try {
    LocalNotifications.addListener("localNotificationActionPerformed", (action) => {
      const url = action.notification.extra?.actionUrl;
      const notifId = action.notification.extra?.notificationId;
      if (notifId) markNotificationAsRead(notifId);
      if (url) onNavigate(url);
    });
  } catch (err) {
    console.warn("[Notifications] Failed to add native notification listener:", err);
  }
}

/**
 * Plays a delicate, high-quality audio chime synthesized via Web Audio API.
 * Replicates the familiar gentle WhatsApp message chime without external audio assets.
 */
export function playNotificationChime() {
  if (!getMobileNotificationPrefs().soundEnabled) return;
  try {
    const AudioContextClass =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;

    // First note: 830Hz (G#5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(830, now);
    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(0.18, now + 0.02);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.23);

    // Second note: 1046Hz (C6) - slightly higher for upbeat feel
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(1046, now + 0.1);
    gain2.gain.setValueAtTime(0, now + 0.1);
    gain2.gain.linearRampToValueAtTime(0.22, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.1);
    osc2.stop(now + 0.42);

    // Clean up context after playing
    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 600);
  } catch {
    // Audio context might be restricted before first user interaction; silently ignore
  }
}
