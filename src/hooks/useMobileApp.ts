import { useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";
import { StatusBar, Style } from "@capacitor/status-bar";
import { Browser } from "@capacitor/browser";
import { supabase } from "@/integrations/supabase/client";

import { initOtaUpdater } from "@/lib/otaUpdater";

export const isNativeApp = (): boolean => {
  return (
    Capacitor.isNativePlatform() ||
    window.matchMedia("(display-mode: standalone)").matches ||
    window.location.search.includes("app=true") ||
    localStorage.getItem("ompath_app_mode") === "true"
  );
};

export function useMobileApp() {
  const navigate = useNavigate();
  const location = useLocation();
  const pathRef = useRef(location.pathname);
  pathRef.current = location.pathname;

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    // Initialize silent OTA live updater and notify app ready
    void initOtaUpdater();

    // Set Android Status Bar style
    StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
    StatusBar.setBackgroundColor({ color: "#1a3c34" }).catch(() => {});

    // Listen for hardware back button on Android
    const backListener = CapApp.addListener("backButton", () => {
      const modalBack = new CustomEvent("ompath:native-back", { cancelable: true });
      if (!window.dispatchEvent(modalBack)) return;
      if (pathRef.current !== "/") {
        navigate(-1);
      } else if (window.confirm("Leave Ompath?")) {
        CapApp.exitApp();
      }
    });

    // Listen for OAuth deep link callback (ompathstudy://auth/callback)
    const urlListener = CapApp.addListener("appUrlOpen", async ({ url }) => {
      try {
        await Browser.close().catch(() => {});
      } catch {}

      if (url && (url.includes("auth/callback") || url.startsWith("ompathstudy://"))) {
        try {
          const normalized = url.replace(/^ompathstudy:\/\/auth\/callback/, "https://ompathstudy.com/auth/callback");
          const parsed = new URL(normalized);

          const searchParams = parsed.searchParams;
          const hashParams = new URLSearchParams(parsed.hash.replace(/^#/, ""));

          const accessToken = hashParams.get("access_token") || searchParams.get("access_token");
          const refreshToken = hashParams.get("refresh_token") || searchParams.get("refresh_token");
          const code = searchParams.get("code") || hashParams.get("code");

          if (accessToken && refreshToken) {
            const { error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            if (!error) {
              navigate("/account");
            }
          } else if (code) {
            const { error } = await supabase.auth.exchangeCodeForSession(code);
            if (!error) {
              navigate("/account");
            }
          }
        } catch (e) {
          console.warn("Failed to process OAuth deep link:", e);
        }
      }
    });

    return () => {
      backListener.then((l) => l.remove()).catch(() => {});
      urlListener.then((l) => l.remove()).catch(() => {});
    };
  }, [navigate]);

  return {
    isNative: isNativeApp(),
  };
}
