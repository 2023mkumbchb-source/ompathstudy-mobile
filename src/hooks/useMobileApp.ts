import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";
import { StatusBar, Style } from "@capacitor/status-bar";

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
    const backListener = CapApp.addListener("backButton", ({ canGoBack }) => {
      if (location.pathname !== "/") {
        navigate(-1);
      } else {
        CapApp.exitApp();
      }
    });

    return () => {
      backListener.then((l) => l.remove()).catch(() => {});
    };
  }, [navigate, location.pathname]);

  return {
    isNative: isNativeApp(),
  };
}
