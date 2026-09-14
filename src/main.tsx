import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { HelmetProvider } from "react-helmet-async";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "@/lib/supabase-config";

// Auto-recover from stale chunk loads after a deploy. When the cached
// index.html refers to chunk hashes that no longer exist (or the cached
// SW serves stale assets), dynamic imports fail with "Failed to fetch
// dynamically imported module". Reload once with a cache-busting flag
// instead of showing a Not Found page.
const tryReloadOnce = (reason: string) => {
  try {
    const KEY = "__chunk_reload_at__";
    const last = Number(sessionStorage.getItem(KEY) || "0");
    if (Date.now() - last < 15000) return; // avoid loops
    sessionStorage.setItem(KEY, String(Date.now()));
    console.warn("[ompath] reloading after chunk error:", reason);
    // Best-effort: drop SW caches so the new index can fetch fresh assets
    const doReload = () => window.location.reload();
    if ("caches" in window) {
      caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))).finally(doReload);
    } else {
      doReload();
    }
  } catch {
    window.location.reload();
  }
};

window.addEventListener("vite:preloadError", (e) => {
  e.preventDefault();
  tryReloadOnce("vite:preloadError");
});
window.addEventListener("error", (e) => {
  const msg = String((e as ErrorEvent).message || "");
  if (/dynamically imported module|Importing a module script failed|ChunkLoadError/i.test(msg)) {
    tryReloadOnce("error:" + msg.slice(0, 80));
  }
});
window.addEventListener("unhandledrejection", (e) => {
  const msg = String((e as PromiseRejectionEvent).reason?.message || (e as PromiseRejectionEvent).reason || "");
  if (/dynamically imported module|Importing a module script failed|ChunkLoadError/i.test(msg)) {
    tryReloadOnce("rejection:" + msg.slice(0, 80));
  }
});

// Register service worker for offline caching
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").then(() => {
      // Pre-warm offline cache: fetch core lists in the background so they're
      // available even when the user is offline on first navigation.
      const SUPA = SUPABASE_URL;
      const KEY = SUPABASE_PUBLISHABLE_KEY;
      if (!SUPA || !KEY) return;
      const headers = { apikey: KEY, Authorization: `Bearer ${KEY}` };
      const endpoints = [
        `${SUPA}/rest/v1/articles?select=id,title,category,slug,meta_description,created_at,updated_at&published=eq.true&deleted_at=is.null&order=created_at.desc&limit=200`,
        `${SUPA}/rest/v1/mcq_sets?select=id,title,category,slug,meta_description,og_image_url,created_at,updated_at&published=eq.true&deleted_at=is.null&order=created_at.desc&limit=100`,
        `${SUPA}/rest/v1/flashcard_sets?select=id,title,category,slug,created_at,updated_at&published=eq.true&deleted_at=is.null&order=created_at.desc&limit=50`,
        `${SUPA}/rest/v1/stories?select=id,title,category,created_at&published=eq.true&deleted_at=is.null&order=created_at.desc&limit=50`,
      ];
      // Delay so it doesn't compete with the initial render
      const warmCache = () => endpoints.forEach((url) => fetch(url, { headers }).catch(() => {}));
      if ("requestIdleCallback" in window) window.requestIdleCallback(warmCache, { timeout: 10000 });
      else setTimeout(warmCache, 8000);
    }).catch(() => {});
  });
}

createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <App />
  </HelmetProvider>
);
