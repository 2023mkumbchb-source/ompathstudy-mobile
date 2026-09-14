import { useState, useEffect, useCallback } from "react";
import {
  getOfflineStorageStats,
  syncAllContentForOffline,
  clearOfflineCache,
  type OfflineStorageStats,
  type SyncProgress,
} from "@/lib/offlineStore";

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return typeof navigator !== "undefined" ? navigator.onLine : true;
  });

  const [stats, setStats] = useState<OfflineStorageStats>({
    articleCount: 0,
    summaryCount: 0,
    mcqCount: 0,
    flashcardCount: 0,
    lastSync: null,
    isFullySynced: false,
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
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    refreshStats();

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [refreshStats]);

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
    isOffline: !isOnline,
    stats,
    isSyncing,
    syncProgress,
    startSync,
    purgeCache,
    refreshStats,
  };
}
