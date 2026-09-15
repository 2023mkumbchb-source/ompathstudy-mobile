import { useState, useEffect, useCallback } from "react";
import {
  getOfflineStorageStats,
  syncAllContentForOffline,
  clearOfflineCache,
  isOfflineMode,
  SIMULATED_OFFLINE_KEY,
  type OfflineStorageStats,
  type SyncProgress,
} from "@/lib/offlineStore";

export { isOfflineMode };

export function setSimulatedOffline(val: boolean) {
  if (typeof window === "undefined") return;
  if (val) {
    sessionStorage.setItem(SIMULATED_OFFLINE_KEY, "true");
  } else {
    sessionStorage.removeItem(SIMULATED_OFFLINE_KEY);
  }
  window.dispatchEvent(new Event("ompath_offline_mode_change"));
}

export function useNetworkStatus() {
  const [simulatedOffline, setSimulatedOfflineState] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem(SIMULATED_OFFLINE_KEY) === "true";
  });

  const [realOnline, setRealOnline] = useState<boolean>(() => {
    return typeof navigator !== "undefined" ? navigator.onLine : true;
  });

  const isOnline = !simulatedOffline && realOnline;
  const isOffline = !isOnline;

  const [stats, setStats] = useState<OfflineStorageStats>({
    articleCount: 0,
    summaryCount: 0,
    mcqCount: 0,
    flashcardCount: 0,
    storyCount: 0,
    lastSync: null,
    isFullySynced: false,
    failedImageCount: 0,
  });

  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);

  const refreshStats = useCallback(async () => {
    try {
      const s = await getOfflineStorageStats();
      setStats(s);
    } catch {}
  }, []);

  useEffect(() => {
    const handleOnline = () => setRealOnline(true);
    const handleOffline = () => setRealOnline(false);
    const handleSimMode = () => {
      setSimulatedOfflineState(sessionStorage.getItem(SIMULATED_OFFLINE_KEY) === "true");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("ompath_offline_mode_change", handleSimMode);

    refreshStats();

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("ompath_offline_mode_change", handleSimMode);
    };
  }, [refreshStats]);

  const toggleSimulatedOffline = useCallback((val: boolean) => {
    setSimulatedOffline(val);
    setSimulatedOfflineState(val);
  }, []);

  const startSync = useCallback(async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      const result = await syncAllContentForOffline((p) => {
        setSyncProgress(p);
      });
      await refreshStats();
      return result;
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, refreshStats]);

  const purgeCache = useCallback(async () => {
    await clearOfflineCache();
    await refreshStats();
  }, [refreshStats]);

  return {
    isOnline,
    isOffline,
    isSimulatedOffline: simulatedOffline,
    toggleSimulatedOffline,
    stats,
    isSyncing,
    syncProgress,
    startSync,
    purgeCache,
    refreshStats,
  };
}
