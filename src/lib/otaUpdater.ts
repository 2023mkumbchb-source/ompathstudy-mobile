import { Capacitor } from "@capacitor/core";
import { CapacitorUpdater } from "@capgo/capacitor-updater";
import { supabase } from "@/integrations/supabase/client";

const RELEASE_API = "https://api.github.com/repos/2023mkumbchb-source/ompathstudy-mobile/releases/latest";

export interface LiveBundleInfo { version: string; url: string }

export async function getLatestBundle(): Promise<LiveBundleInfo | null> {
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "app_live_bundle")
    .maybeSingle();

  if (data?.value) {
    try {
      const configured = JSON.parse(data.value) as { version?: string; url?: string };
      if (configured.version && configured.url) return { version: configured.version, url: configured.url };
    } catch {
      // Fall through to the public mobile GitHub release.
    }
  }

  const response = await fetch(RELEASE_API, { headers: { Accept: "application/vnd.github+json" } });
  if (!response.ok) return null;
  const release = await response.json() as {
    tag_name?: string;
    assets?: Array<{ name?: string; browser_download_url?: string }>;
  };
  const asset = release.assets?.find((item) => item.name === "OmpathStudy-web-bundle.zip");
  const version = release.tag_name?.replace(/^v/, "").replace(/-apk$/, "");
  return version && asset?.browser_download_url ? { version, url: asset.browser_download_url } : null;
}

export async function checkForAppUpdate(): Promise<{
  available: boolean;
  latest: LiveBundleInfo | null;
  currentVersion: string;
}> {
  if (!Capacitor.isNativePlatform()) return { available: false, latest: null, currentVersion: "web" };
  const [current, latest] = await Promise.all([CapacitorUpdater.current(), getLatestBundle()]);
  const currentVersion = current.bundle?.id === "builtin"
    ? String(current.native || "builtin")
    : String(current.bundle?.version || current.native || "builtin");
  return { available: Boolean(latest && latest.version !== currentVersion), latest, currentVersion };
}

export async function installAppUpdate(
  latest: LiveBundleInfo,
  onProgress?: (percent: number) => void,
): Promise<never> {
  if (!Capacitor.isNativePlatform()) throw new Error("Updates are installed only inside the Android app.");
  const listener = await CapacitorUpdater.addListener("download", ({ percent }) => onProgress?.(percent));
  try {
    const downloaded = await CapacitorUpdater.download({ url: latest.url, version: latest.version });
    onProgress?.(100);
    await CapacitorUpdater.next({ id: downloaded.id });
    localStorage.setItem("ompath_update_installed", latest.version);
    await new Promise((resolve) => window.setTimeout(resolve, 700));
    await CapacitorUpdater.reload();
    throw new Error("App restart did not begin.");
  } finally {
    await listener.remove();
  }
}

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
      const bundleInfo = await getLatestBundle();
      if (bundleInfo) {
        try {
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
        } catch {
          // A failed bundle is left inactive; the updater rolls back safely.
        }
      }
    }
  } catch (err) {
    console.warn("[OTA] Live updater error:", err);
  }
}
