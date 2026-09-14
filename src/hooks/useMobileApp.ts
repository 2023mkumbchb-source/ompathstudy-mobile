import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";
import { StatusBar, Style } from "@capacitor/status-bar";
import { Browser } from "@capacitor/browser";
import { supabase } from "@/integrations/supabase/client";

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

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    // Set Android Status Bar style
    StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
    StatusBar.setBackgroundColor({ color: "#1a3c34" }).catch(() => {});

    // Listen for hardware back button on Android
    const backListener = CapApp.addListener("backButton", () => {
      if (location.pathname !== "/") {
        navigate(-1);
      } else {
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
          const hashIndex = url.indexOf("#");
          const queryIndex = url.indexOf("?");
          const paramStr =
            hashIndex !== -1
              ? url.substring(hashIndex + 1)
              : queryIndex !== -1
              ? url.substring(queryIndex + 1)
              : "";
          const params = new URLSearchParams(paramStr);
          const accessToken = params.get("access_token");
          const refreshToken = params.get("refresh_token");

          if (accessToken && refreshToken) {
            const { error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
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
  }, [navigate, location.pathname]);

  return {
    isNative: isNativeApp(),
  };
}
