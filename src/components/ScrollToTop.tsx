import { useEffect, useLayoutEffect } from "react";
import { useLocation, useNavigationType } from "react-router-dom";
import { flashAnchor } from "@/lib/deep-link";

const SCROLL_KEY = "ompath_scroll_positions";

function readPositions(): Record<string, number> {
  try { return JSON.parse(sessionStorage.getItem(SCROLL_KEY) || "{}"); }
  catch { return {}; }
}

function savePosition(path: string, y: number) {
  try {
    const positions = readPositions();
    positions[path] = y;
    sessionStorage.setItem(SCROLL_KEY, JSON.stringify(positions));
  } catch { /* storage unavailable */ }
}

export default function ScrollToTop() {
  const { pathname, search, hash } = useLocation();
  const navigationType = useNavigationType();
  const currentPath = pathname + search;

  useEffect(() => {
    const old = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    return () => { window.history.scrollRestoration = old; };
  }, []);

  useEffect(() => {
    const path = currentPath;
    const save = () => savePosition(path, window.scrollY);
    window.addEventListener("pagehide", save);
    return () => {
      window.removeEventListener("pagehide", save);
      save();
    };
  }, [currentPath]);

  useLayoutEffect(() => {
    if (hash) {
      const frame = requestAnimationFrame(() => flashAnchor(hash.slice(1)));
      return () => cancelAnimationFrame(frame);
    }

    // Article links must always open at the beginning. Restoring a previously
    // recorded position here made some newly opened notes appear to start near
    // the footer, especially after canonical-slug redirects.
    const isArticle = /^\/blog\/[^/]+\/?$/.test(pathname);
    const target = navigationType === "POP" && !isArticle
      ? readPositions()[currentPath] || 0
      : 0;
    const frame = requestAnimationFrame(() => {
      window.scrollTo({ top: target, left: 0, behavior: "auto" });
    });
    return () => cancelAnimationFrame(frame);
  }, [currentPath, hash, navigationType]);

  return null;
}
