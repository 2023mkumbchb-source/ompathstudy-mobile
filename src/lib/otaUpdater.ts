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
  let highestProgress = 0;
  const reportProgress = (percent: number) => {
    const safePercent = Math.min(100, Math.max(0, Math.round(percent)));
    highestProgress = Math.max(highestProgress, safePercent);
    onProgress?.(highestProgress);
  };

  const listener = await CapacitorUpdater.addListener("download", ({ percent, bundle }) => {
    // The native plugin emits one global stream. Ignore background downloads
    // for other versions and never let the visible percentage move backwards.
    if (bundle?.version === latest.version) reportProgress(percent);
  });
  try {
    type LocalBundle = Awaited<ReturnType<typeof CapacitorUpdater.list>>["bundles"][number];
    let bundles: LocalBundle[] = [];
    try {
      bundles = (await CapacitorUpdater.list()).bundles;
    } catch {
      // Listing local bundles is an optimisation. A fresh download remains a
      // safe fallback when an older native plugin cannot provide the list.
    }

    let downloaded = bundles.find((bundle) =>
      bundle.version === latest.version && (bundle.status === "success" || bundle.status === "pending")
    );
    const backgroundDownloadExists = bundles.some((bundle) =>
      bundle.version === latest.version && bundle.status === "downloading"
    );

    if (!downloaded && backgroundDownloadExists) {
      // initOtaUpdater may already be downloading this exact bundle. Wait for
      // and reuse it instead of consuming bandwidth with a duplicate request.
      for (let attempt = 0; attempt < 300; attempt += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 1000));
        const refreshed = (await CapacitorUpdater.list()).bundles;
        downloaded = refreshed.find((bundle) =>
          bundle.version === latest.version && (bundle.status === "success" || bundle.status === "pending")
        );
        if (downloaded) break;
        if (refreshed.some((bundle) => bundle.version === latest.version && bundle.status === "error")) {
          throw new Error("The background update failed. Check your connection and try again.");
        }
      }
      if (!downloaded) {
        throw new Error("The update is still downloading. Keep Ompath open and try again shortly.");
      }
    }

    if (!downloaded) {
      // Recheck after a short hand-off window so an app-start background
      // download has time to register before a manual download is created.
      await new Promise((resolve) => window.setTimeout(resolve, 400));
      const refreshed = await CapacitorUpdater.list().catch(() => ({ bundles: [] as LocalBundle[] }));
      downloaded = refreshed.bundles.find((bundle) =>
        bundle.version === latest.version && (bundle.status === "success" || bundle.status === "pending")
      );
      if (!downloaded) {
        downloaded = await CapacitorUpdater.download({ url: latest.url, version: latest.version });
      }
    }

    reportProgress(100);
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
