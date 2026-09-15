import type { NavigateFunction } from "react-router-dom";

const APP_HOSTS = new Set(["ompathstudy.com", "www.ompathstudy.com"]);

export function getInAppNotificationPath(rawUrl: string): string | null {
  const value = rawUrl.trim();
  if (!value) return null;
  if (value.startsWith("/")) return value;
  try {
    const parsed = new URL(value);
    if (!APP_HOSTS.has(parsed.hostname.toLowerCase())) return null;
    return `${parsed.pathname || "/"}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}

/** Keep Ompath destinations inside the APK; only genuine external links leave it. */
export function openNotificationAction(rawUrl: string, navigate: NavigateFunction) {
  const internalPath = getInAppNotificationPath(rawUrl);
  if (internalPath) {
    navigate(internalPath);
    return;
  }
  window.location.assign(rawUrl);
}
