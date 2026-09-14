import React, { useState } from "react";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { WifiOff, X, HardDrive } from "lucide-react";
import OfflineManagerModal from "./OfflineManagerModal";

export default function OfflineStatusBanner() {
  const { isOffline, stats } = useNetworkStatus();
  const [dismissed, setDismissed] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  if (!isOffline || dismissed) return null;

  return (
    <>
      <div className="bg-amber-600 dark:bg-amber-700 text-white px-3 py-1.5 text-xs flex items-center justify-between shadow-sm sticky top-[50px] z-30 animate-in fade-in slide-in-from-top-1">
        <div className="flex items-center gap-2 max-w-[85%] truncate">
          <WifiOff className="h-3.5 w-3.5 shrink-0 animate-pulse" />
          <span className="truncate">
            <strong>Offline Mode:</strong> Reading from local cache ({stats.articleCount} notes available)
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-1 rounded bg-black/20 hover:bg-black/30 px-2 py-0.5 text-[11px] font-medium transition-colors"
          >
            <HardDrive className="h-3 w-3" /> Manage
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="p-1 text-white/80 hover:text-white rounded"
            aria-label="Dismiss offline banner"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <OfflineManagerModal open={modalOpen} onOpenChange={setModalOpen} />
    </>
  );
}
