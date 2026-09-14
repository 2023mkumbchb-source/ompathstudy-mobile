import { getSetting } from "./store";
import { isOfflineMode } from "./offlineStore";

export const CURRENT_APP_VERSION = "1.0.0";
export const DEFAULT_DOWNLOAD_URL = "https://github.com/2023mkumbchb-source/story-weave-box/releases/latest";

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
    const [latestVersion, downloadUrl, updateNotes] = await Promise.all([
      getSetting("app_latest_version"),
      getSetting("app_download_url"),
      getSetting("app_update_notes"),
    ]);

    const targetVersion = latestVersion ? latestVersion.trim() : CURRENT_APP_VERSION;
    const targetUrl = downloadUrl ? downloadUrl.trim() : DEFAULT_DOWNLOAD_URL;
    const updateAvailable = isNewerVersion(CURRENT_APP_VERSION, targetVersion);

    return {
      updateAvailable,
      currentVersion: CURRENT_APP_VERSION,
      latestVersion: targetVersion,
      downloadUrl: targetUrl,
      notes: updateNotes || undefined,
    };
  } catch (err) {
    console.warn("Update check failed:", err);
    return null;
  }
}
