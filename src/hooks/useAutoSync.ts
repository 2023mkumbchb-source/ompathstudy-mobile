import { useEffect, useRef } from "react";
import { ensureOfflineSeeded, autoDeltaSync } from "@/lib/offlineStore";
import { precacheAponeurosisImages } from "@/lib/offlineImageStore";
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
        // 1. Ensure empty storage is hydrated from pre-bundled offline seed
        const seeded = await ensureOfflineSeeded();
        if (seeded) {
          console.log("[OmpathStudy] Offline database hydrated from seed bundle.");
        }

        // 2. If online, run delta sync in background
        if (typeof navigator !== "undefined" && navigator.onLine) {
          const { updated } = await autoDeltaSync();
          if (updated > 0) {
            toast.success(`Updated ${updated} medical study notes with latest questions!`, {
              duration: 4000,
            });
          }

          // 3. Silently cache all Aponeurosis images for offline spot bank study
          void precacheAponeurosisImages((done, total) => {
            if (done === total && total > 0) {
              console.log(`[OmpathStudy] All ${total} Aponeurosis spot diagrams cached offline.`);
            }
          });

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
