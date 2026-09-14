import { Capacitor } from "@capacitor/core";
import { CapacitorUpdater } from "@capgo/capacitor-updater";
import { supabase } from "@/integrations/supabase/client";

/**
 * Initialize OTA live updater:
 * 1. Signals native plugin that app rendered successfully
 * 2. Silently checks if a new web bundle is available and installs it in background
 */
export async function initOtaUpdater(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  try {
    // 1. Confirm app boot to native plugin (prevents rollback)
    await CapacitorUpdater.notifyAppReady().catch(() => {});

    // 2. If online, check if a remote web bundle is published in app_settings
    if (typeof navigator !== "undefined" && navigator.onLine) {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "app_live_bundle")
        .maybeSingle();

      if (data?.value) {
        try {
          const bundleInfo: { version: string; url: string } = JSON.parse(data.value);
          const current = await CapacitorUpdater.current();

          if (
            bundleInfo.version &&
            bundleInfo.url &&
            current?.bundle?.version !== bundleInfo.version
          ) {
            console.log(`[OTA] Downloading live update bundle v${bundleInfo.version}...`);
            const downloaded = await CapacitorUpdater.download({
              url: bundleInfo.url,
              version: bundleInfo.version,
            });

            // Set bundle to activate on next backgrounding or launch
            await CapacitorUpdater.next({ id: downloaded.id });
            console.log(`[OTA] Live update v${bundleInfo.version} ready for next launch!`);
          }
        } catch (parseErr) {
          // Ignore invalid JSON in bundle settings
        }
      }
    }
  } catch (err) {
    console.warn("[OTA] Live updater error:", err);
  }
}
