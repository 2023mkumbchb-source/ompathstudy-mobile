import { useEffect, useRef } from "react";
import { ensureOfflineSeeded, autoDeltaSync } from "@/lib/offlineStore";
import { precacheAponeurosisImages } from "@/lib/offlineImageStore";
import { checkForNewNotifications } from "@/lib/notifications";
import { toast } from "sonner";

export function useAutoSync() {
  const syncLock = useRef(false);

  useEffect(() => {
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

    // Run whenever connection is restored
    const onOnline = () => {
      void runSync();
    };

    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, []);
}
