import { getSetting } from "./store";
import { isOfflineMode } from "./offlineStore";

export const CURRENT_APP_VERSION = "1.0.15";
const MOBILE_RELEASES_API = "https://api.github.com/repos/2023mkumbchb-source/ompathstudy-mobile/releases/latest";

export const DEFAULT_DOWNLOAD_URL = "https://github.com/2023mkumbchb-source/ompathstudy-mobile/releases/latest";

export interface AppUpdateInfo {
  updateAvailable: boolean;
  currentVersion: string;
  latestVersion: string;
  downloadUrl: string;
  notes?: string;
}

function parseSemver(v: string): number[] {
  return v
    .replace(/^v/i, "")
    .split(".")
    .map((num) => parseInt(num, 10) || 0);
}

export function isNewerVersion(current: string, latest: string): boolean {
  if (!latest) return false;
  const c = parseSemver(current);
  const l = parseSemver(latest);
  for (let i = 0; i < Math.max(c.length, l.length); i++) {
    const cv = c[i] || 0;
    const lv = l[i] || 0;
    if (lv > cv) return true;
    if (lv < cv) return false;
  }
  return false;
}

export async function checkForAppUpdate(): Promise<AppUpdateInfo | null> {
  if (isOfflineMode()) {
    return null;
  }

  try {
    // 1. Check Supabase app_settings
    const [latestVersion, downloadUrl, updateNotes] = await Promise.all([
      getSetting("app_latest_version"),
      getSetting("app_download_url"),
      getSetting("app_update_notes"),
    ]);

    let targetVersion = latestVersion ? latestVersion.trim() : "";
    let targetUrl = downloadUrl ? downloadUrl.trim() : DEFAULT_DOWNLOAD_URL;
    let notes = updateNotes || undefined;

    // 2. Fallback: check GitHub releases API
    if (!targetVersion || targetVersion === CURRENT_APP_VERSION) {
      try {
        const ghRes = await fetch(MOBILE_RELEASES_API, {
          headers: { Accept: "application/vnd.github.v3+json" },
        });
        if (ghRes.ok) {
          const release = await ghRes.json();
          const ghTag = (release.tag_name || "").replace(/^v/i, "").replace(/-apk$/i, "");
          if (ghTag) {
            targetVersion = ghTag;
            if (release.html_url) targetUrl = release.html_url;
            if (release.body) notes = release.body;
          }
        }
      } catch {
        // ignore github error
      }
    }

    const effectiveVersion = targetVersion || CURRENT_APP_VERSION;
    const updateAvailable = isNewerVersion(CURRENT_APP_VERSION, effectiveVersion);

    return {
      updateAvailable,
      currentVersion: CURRENT_APP_VERSION,
      latestVersion: effectiveVersion,
      downloadUrl: targetUrl,
      notes,
    };
  } catch (err) {
    console.warn("Update check failed:", err);
    return null;
  }
}
