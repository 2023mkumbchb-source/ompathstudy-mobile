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
    return Array.isArray(parsed) ? parsed : [];
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

/**
 * Fetch broadcast notifications from Supabase app_settings table.
 * Falls back to local cached notifications if offline or on network error.
 */
export async function fetchBroadcastNotifications(): Promise<AppNotification[]> {
  try {
    const { data, error } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "broadcast_notifications")
      .maybeSingle();

    if (error) throw error;

    if (data?.value) {
      const parsed: AppNotification[] = JSON.parse(data.value);
      if (Array.isArray(parsed)) {
        // Sort descending by created_at
        parsed.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        localStorage.setItem(STORAGE_KEY_NOTIFICATIONS, JSON.stringify(parsed));
        notifyListeners(parsed);
        return parsed;
      }
    }
  } catch (err) {
    console.warn("[Notifications] Remote fetch failed, using offline cache:", err);
  }

  const cached = getCachedNotifications();
  notifyListeners(cached);
  return cached;
}

/**
 * Admin helper to publish a new notification broadcast.
 * Saves to Supabase app_settings, alerts clients, and triggers native local notification.
 */
export async function publishBroadcastNotification(
  input: Omit<AppNotification, "id" | "created_at">
): Promise<AppNotification> {
  const newNotif: AppNotification = {
    ...input,
    id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    created_at: new Date().toISOString(),
  };

  // 1. Fetch current list
  const existing = await fetchBroadcastNotifications();
  const updated = [newNotif, ...existing.filter((n) => n.id !== newNotif.id)].slice(0, 50);

  // 2. Persist to Supabase
  const { error } = await supabase.from("app_settings").upsert(
    {
      key: "broadcast_notifications",
      value: JSON.stringify(updated),
    },
    { onConflict: "key" }
  );

  if (error) {
    console.error("[Notifications] Publish error:", error);
    throw error;
  }

  // 3. Save locally and alert listeners
  localStorage.setItem(STORAGE_KEY_NOTIFICATIONS, JSON.stringify(updated));
  notifyListeners(updated);
  notifyBanner(newNotif);
  playNotificationChime();

  // 4. Trigger native Android status bar notification if on mobile
  await triggerNativeNotification(newNotif);

  return newNotif;
}

/**
 * Admin helper to delete an existing notification broadcast.
 */
export async function deleteBroadcastNotification(id: string): Promise<void> {
  const existing = await fetchBroadcastNotifications();
  const updated = existing.filter((n) => n.id !== id);

  const { error } = await supabase.from("app_settings").upsert(
    {
      key: "broadcast_notifications",
      value: JSON.stringify(updated),
    },
    { onConflict: "key" }
  );

  if (error) throw error;

  localStorage.setItem(STORAGE_KEY_NOTIFICATIONS, JSON.stringify(updated));
  notifyListeners(updated);
}

/**
 * Admin helper to update an existing notification broadcast.
 */
export async function updateBroadcastNotification(
  id: string,
  updates: Partial<Omit<AppNotification, "id" | "created_at">>
): Promise<AppNotification> {
  const existing = await fetchBroadcastNotifications();
  let updatedNotif: AppNotification | null = null;
  const updated = existing.map((n) => {
    if (n.id === id) {
      updatedNotif = { ...n, ...updates };
      return updatedNotif;
    }
    return n;
  });

  if (!updatedNotif) {
    throw new Error("Notification not found");
  }

  const { error } = await supabase.from("app_settings").upsert(
    {
      key: "broadcast_notifications",
      value: JSON.stringify(updated),
    },
    { onConflict: "key" }
  );

  if (error) throw error;

  localStorage.setItem(STORAGE_KEY_NOTIFICATIONS, JSON.stringify(updated));
  notifyListeners(updated);
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
}

/**
 * Check for new unread notifications and pop the WhatsApp-style banner if a new one is found.
 */
export async function checkForNewNotifications(): Promise<void> {
  const notifications = await fetchBroadcastNotifications();
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
        ? "📝 Exam Alert: "
        : notification.type === "update"
        ? "🚀 Update: "
        : notification.type === "note"
        ? "📚 New Content: "
        : "📢 Ompath Study: ";

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
