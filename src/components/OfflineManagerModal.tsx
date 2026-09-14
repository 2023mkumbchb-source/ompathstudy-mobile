import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import {
  CloudDownload,
  Wifi,
  WifiOff,
  CheckCircle2,
  Trash2,
  BookOpen,
  FileQuestion,
  GraduationCap,
  HardDrive,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

interface OfflineManagerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function OfflineManagerModal({ open, onOpenChange }: OfflineManagerModalProps) {
  const {
    isOnline,
    stats,
    isSyncing,
    syncProgress,
    startSync,
    purgeCache,
  } = useNetworkStatus();

  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleSync = async () => {
    if (!isOnline) {
      toast.error("You are currently offline. Connect to Wi-Fi or mobile data to download updates.");
      return;
    }
    toast.info("Starting download of all notes & questions...");
    const res = await startSync();
    if (res?.success) {
      toast.success(`Successfully saved ${res.articleCount} notes for offline study!`);
    } else {
      toast.error(res?.error || "Sync could not complete.");
    }
  };

  const handlePurge = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    await purgeCache();
    setConfirmDelete(false);
    toast.success("Offline storage cleared.");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-card text-card-foreground border-border">
        <DialogHeader className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[hsl(174,62%,22%)] text-white">
              <HardDrive className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">Offline Study Manager</DialogTitle>
              <DialogDescription className="text-xs">
                Download notes and question banks to study anywhere without internet.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Network status pill */}
        <div
          className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs font-medium ${
            isOnline
              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
              : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
          }`}
        >
          <div className="flex items-center gap-2">
            {isOnline ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
            <span>{isOnline ? "Online — Connected to OmpathCloud" : "Offline — Studying from device cache"}</span>
          </div>
          {stats.isFullySynced && (
            <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5" /> Ready
            </span>
          )}
        </div>

        {/* Storage stats cards */}
        <div className="grid grid-cols-3 gap-2 py-1">
          <div className="rounded-lg border border-border/60 bg-muted/40 p-2.5 text-center">
            <div className="mx-auto mb-1 flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary">
              <BookOpen className="h-3.5 w-3.5" />
            </div>
            <div className="text-base font-bold">{stats.articleCount}</div>
            <div className="text-[10px] text-muted-foreground">Notes Cached</div>
          </div>

          <div className="rounded-lg border border-border/60 bg-muted/40 p-2.5 text-center">
            <div className="mx-auto mb-1 flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary">
              <FileQuestion className="h-3.5 w-3.5" />
            </div>
            <div className="text-base font-bold">{stats.mcqCount}</div>
            <div className="text-[10px] text-muted-foreground">MCQ Sets</div>
          </div>

          <div className="rounded-lg border border-border/60 bg-muted/40 p-2.5 text-center">
            <div className="mx-auto mb-1 flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary">
              <GraduationCap className="h-3.5 w-3.5" />
            </div>
            <div className="text-base font-bold">{stats.flashcardCount}</div>
            <div className="text-[10px] text-muted-foreground">Flashcards</div>
          </div>
        </div>

        {/* Sync Progress Bar if active */}
        {isSyncing && syncProgress && (
          <div className="space-y-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 font-medium text-primary">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {syncProgress.message}
              </span>
              <span className="font-bold text-primary">{syncProgress.percent}%</span>
            </div>
            <Progress value={syncProgress.percent} className="h-2" />
          </div>
        )}

        {/* Main action buttons */}
        <div className="space-y-2 pt-1">
          <Button
            onClick={handleSync}
            disabled={isSyncing || !isOnline}
            className="w-full gap-2 bg-[hsl(174,62%,22%)] text-white hover:bg-[hsl(174,62%,18%)] font-semibold shadow-sm"
          >
            {isSyncing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Downloading Content...
              </>
            ) : (
              <>
                <CloudDownload className="h-4 w-4" />
                {stats.articleCount > 50 ? "Update / Re-sync All Notes" : "Download All Notes for Offline Study"}
              </>
            )}
          </Button>

          {stats.articleCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handlePurge}
              disabled={isSyncing}
              className={`w-full text-xs ${
                confirmDelete
                  ? "border-red-500 bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-950/40"
                  : "text-muted-foreground"
              }`}
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              {confirmDelete ? "Tap again to confirm clearing offline cache" : "Free Up Storage (Clear Cache)"}
            </Button>
          )}
        </div>

        <p className="text-[11px] text-center text-muted-foreground">
          Tip: Once downloaded, all study notes, clinical cases, and questions remain readable even in airplane mode.
        </p>
      </DialogContent>
    </Dialog>
  );
}
