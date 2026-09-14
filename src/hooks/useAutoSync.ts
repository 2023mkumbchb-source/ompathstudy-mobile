import { useEffect, useRef } from "react";
import { ensureOfflineSeeded, autoDeltaSync, getOfflineStorageStats, syncAllContentForOffline } from "@/lib/offlineStore";
import { checkForNewNotifications, startNotificationRealtime } from "@/lib/notifications";
import { supabase } from "@/integrations/supabase/client";
import { App as CapApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { toast } from "sonner";

export function useAutoSync() {
  const syncLock = useRef(false);

  useEffect(() => {
    let stopRealtime: (() => void) | undefined;
    const runSync = async () => {
      if (syncLock.current) return;
      syncLock.current = true;

      try {
        // Ask Android/WebView not to evict the medical library under storage pressure.
        if (typeof navigator !== "undefined" && navigator.storage?.persist) {
          void navigator.storage.persist().catch(() => false);
        }
        // 1. Ensure empty storage is hydrated from pre-bundled offline seed
        const seeded = await ensureOfflineSeeded();
        if (seeded) {
          console.log("[OmpathStudy] Offline database hydrated from seed bundle.");
        }

        // 2. If online, run delta sync in background
        if (typeof navigator !== "undefined" && navigator.onLine) {
          const stats = await getOfflineStorageStats();
          const lastFullSync = Number(localStorage.getItem("ompath_last_full_offline_sync") || "0");
          const fullSyncDue = !stats.isFullySynced || Date.now() - lastFullSync > 24 * 60 * 60 * 1000;
          const { updated } = await autoDeltaSync();
          if (updated > 0) {
            toast.success(`Updated ${updated} medical study notes with latest questions!`, {
              duration: 4000,
            });
          }

          // 3. Once daily, reconcile the complete published library. This stores
          // every full post, MCQ set, flashcard set and every referenced image.
          if (fullSyncDue) {
            const result = await syncAllContentForOffline();
            if (result.success) {
              localStorage.setItem("ompath_last_full_offline_sync", String(Date.now()));
              console.log(`[OmpathStudy] Complete offline library synchronized (${result.articleCount} posts).`);
            }
          }

          // 4. Check for new broadcast notifications and trigger banner/system alert if found
          void checkForNewNotifications();
        }
      } catch (err) {
        console.warn("[OmpathStudy] Background auto-sync error:", err);
      } finally {
        syncLock.current = false;
      }
    };

    // Run on startup
    void runSync();
    void startNotificationRealtime().then((cleanup) => { stopRealtime = cleanup; });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      stopRealtime?.();
      void startNotificationRealtime().then((cleanup) => { stopRealtime = cleanup; });
      void runSync();
    });

    // Run whenever connection is restored
    const onOnline = () => {
      void runSync();
    };

    window.addEventListener("online", onOnline);
    const interval = window.setInterval(() => { void runSync(); }, 5 * 60 * 1000);
    const appStateListener = Capacitor.isNativePlatform()
      ? CapApp.addListener("appStateChange", ({ isActive }) => { if (isActive) void runSync(); })
      : null;
    return () => {
      window.removeEventListener("online", onOnline);
      window.clearInterval(interval);
      void appStateListener?.then((listener) => listener.remove());
      subscription.unsubscribe();
      stopRealtime?.();
    };
  }, []);
}
