import { useEffect, useState } from "react";
import { getSetting } from "@/lib/store";

export interface SiteSettings {
  /** Legacy website setting. The dedicated mobile About page is always available. */
  founderPageVisible: boolean;
  /** How much of an image-answer paper a guest may browse. */
  guestSlideView: "all" | "half";
  /** Names (lecturers etc.) stripped out of rendered content. */
  redactedNames: string[];
  /** Show plate/question counts in banners. */
  showCounts: boolean;
}

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  founderPageVisible: false,
  guestSlideView: "all",
  redactedNames: ["Beda"],
  showCounts: false,
};

let cache: { at: number; value: SiteSettings } | null = null;

export async function loadSiteSettings(force = false): Promise<SiteSettings> {
  if (!force && cache && Date.now() - cache.at < 5 * 60_000) return cache.value;
  try {
    const [founder, guest, names, counts] = await Promise.all([
      getSetting("founder_page_visible"),
      getSetting("guest_slide_view"),
      getSetting("redacted_names"),
      getSetting("show_content_counts"),
    ]);
    const value: SiteSettings = {
      founderPageVisible: founder === "true",
      guestSlideView: guest === "half" ? "half" : "all",
      redactedNames: (names ?? "").trim()
        ? names.split(",").map((n) => n.trim()).filter(Boolean)
        : DEFAULT_SITE_SETTINGS.redactedNames,
      showCounts: counts === "true",
    };
    cache = { at: Date.now(), value };
    return value;
  } catch {
    return DEFAULT_SITE_SETTINGS;
  }
}

export function useSiteSettings() {
  const [settings, setSettings] = useState<SiteSettings>(cache?.value ?? DEFAULT_SITE_SETTINGS);
  const [loading, setLoading] = useState(!cache);

  useEffect(() => {
    let active = true;
    loadSiteSettings().then((s) => {
      if (!active) return;
      setSettings(s);
      setLoading(false);
    });
    return () => { active = false; };
  }, []);

  return { ...settings, loading };
}
