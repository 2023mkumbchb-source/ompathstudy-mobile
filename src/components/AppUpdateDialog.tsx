import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { checkForAppUpdate, type AppUpdateInfo } from "@/lib/version";
import { Sparkles, Download, X } from "lucide-react";

export default function AppUpdateDialog() {
  const [updateInfo, setUpdateInfo] = useState<AppUpdateInfo | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Check for update after slight delay so app shell loads smoothly
    const timer = setTimeout(() => {
      checkForAppUpdate().then((info) => {
        if (info?.updateAvailable) {
          const dismissed = sessionStorage.getItem(`dismissed_update_${info.latestVersion}`);
          if (!dismissed) {
            setUpdateInfo(info);
            setOpen(true);
          }
        }
      });
    }, 4000);

    return () => clearTimeout(timer);
  }, []);

  if (!updateInfo) return null;

  const handleDownload = () => {
    if (updateInfo.downloadUrl) {
      window.open(updateInfo.downloadUrl, "_system");
    }
    setOpen(false);
  };

  const handleDismiss = () => {
    sessionStorage.setItem(`dismissed_update_${updateInfo.latestVersion}`, "1");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-sm bg-card text-card-foreground border-border">
        <DialogHeader className="space-y-2 text-center items-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[hsl(174,62%,22%)] text-white shadow-md">
            <Sparkles className="h-6 w-6" />
          </div>
          <DialogTitle className="text-lg font-bold">New App Version Available!</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Version <strong>{updateInfo.latestVersion}</strong> is ready for download. (You have {updateInfo.currentVersion})
          </DialogDescription>
        </DialogHeader>

        {updateInfo.notes && (
          <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground border border-border/50 max-h-32 overflow-y-auto">
            <p className="font-semibold text-foreground mb-1">What's New:</p>
            <p className="whitespace-pre-line">{updateInfo.notes}</p>
          </div>
        )}

        <div className="space-y-2 pt-2">
          <Button
            onClick={handleDownload}
            className="w-full gap-2 bg-[hsl(174,62%,22%)] text-white hover:bg-[hsl(174,62%,18%)] font-semibold"
          >
            <Download className="h-4 w-4" />
            Download & Install Update
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleDismiss}
            className="w-full text-xs text-muted-foreground hover:text-foreground"
          >
            Remind Me Later
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
