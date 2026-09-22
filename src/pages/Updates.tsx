import "@/styles/workspace.css";
import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Capacitor } from "@capacitor/core";
import { CheckCircle2, Download, Loader2, RefreshCw, ShieldCheck, Smartphone } from "lucide-react";
import { checkForAppUpdate, installAppUpdate, type LiveBundleInfo } from "@/lib/otaUpdater";
import { getOfflineStorageStats, syncAllContentForOffline, type OfflineStorageStats } from "@/lib/offlineStore";
import { getCachedImageCount } from "@/lib/offlineImageStore";

type Phase = "idle" | "checking" | "available" | "current" | "downloading" | "restarting" | "error";

export default function Updates() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [latest, setLatest] = useState<LiveBundleInfo | null>(null);
  const [current, setCurrent] = useState("Checking…");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [offline, setOffline] = useState<OfflineStorageStats | null>(null);
  const [imageCount, setImageCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncMessage, setSyncMessage] = useState("");

  const refreshOfflineStats = async () => {
    const [stats, images] = await Promise.all([getOfflineStorageStats(), getCachedImageCount()]);
    setOffline(stats); setImageCount(images);
  };

  const check = async () => {
    setPhase("checking"); setError("");
    try {
      const result = await checkForAppUpdate();
      setCurrent(result.currentVersion);
      setLatest(result.latest);
      setPhase(result.available ? "available" : "current");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not check for updates.");
      setPhase("error");
    }
  };

  useEffect(() => { void check(); void refreshOfflineStats(); }, []);

  const syncOffline = async () => {
    setSyncing(true); setSyncProgress(0); setSyncMessage("Preparing offline library…");
    const result = await syncAllContentForOffline((state) => {
      setSyncProgress(state.percent); setSyncMessage(state.message);
    });
    if (result.success) localStorage.setItem("ompath_last_full_offline_sync", String(Date.now()));
    await refreshOfflineStats();
    setSyncing(false);
  };

  const update = async () => {
    if (!latest) return;
    setProgress(0); setPhase("downloading"); setError("");
    try {
      await installAppUpdate(latest, (percent) => {
        const safePercent = Math.max(0, Math.min(100, Math.round(percent)));
        setProgress((previous) => Math.max(previous, safePercent));
        if (percent >= 100) setPhase("restarting");
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "The update could not be installed.");
      setPhase("error");
    }
  };

  const native = Capacitor.isNativePlatform();
  return <main className="study-shell mx-auto min-h-[70vh] max-w-xl px-4 py-8">
    <Helmet><title>App Updates | Ompath Study</title><meta name="robots" content="noindex" /></Helmet>
    <div className="rounded-md border border-border bg-card p-6 shadow-sm">
      <div className="flex h-14 w-14 items-center justify-center rounded-md bg-primary/10 text-primary"><RefreshCw className="h-7 w-7" /></div>
      <h1 className="mt-5 font-serif text-3xl font-bold text-foreground">App Update Center</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Check, download and install interface and content-engine updates inside the app—without visiting GitHub or reinstalling the APK.</p>

      <div className="mt-6 rounded-md bg-muted/50 p-4 text-sm">
        <div className="flex justify-between gap-3"><span className="text-muted-foreground">Installed version</span><strong>{current}</strong></div>
        {latest && <div className="mt-2 flex justify-between gap-3"><span className="text-muted-foreground">Latest version</span><strong>{latest.version}</strong></div>}
      </div>

      {(phase === "downloading" || phase === "restarting") && <div className="mt-6">
        <div className="mb-2 flex justify-between text-xs font-semibold"><span>{phase === "restarting" ? "Installing and restarting…" : "Downloading update…"}</span><span>{progress}%</span></div>
        <div className="h-3 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-colors" style={{ width: `${progress}%` }} /></div>
        <p className="mt-3 text-xs text-muted-foreground">Keep the app open. It will restart automatically when installation completes.</p>
      </div>}

      {phase === "current" && <div className="mt-6 flex items-start gap-3 border-y border-emerald-500/20 bg-emerald-500/10 p-4"><CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" /><div><p className="font-semibold text-foreground">Your app is up to date</p><p className="text-xs text-muted-foreground">No download or reinstall is needed.</p></div></div>}
      {phase === "available" && <div className="mt-6 flex items-start gap-3 border-y border-primary/20 bg-primary/5 p-4"><Download className="mt-0.5 h-5 w-5 text-primary" /><div><p className="font-semibold text-foreground">Update {latest?.version} is ready</p><p className="text-xs text-muted-foreground">Tap Update now. Installation and restart are automatic.</p></div></div>}
      {phase === "error" && <p className="mt-5 rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      {!native && <p className="mt-5 rounded-md bg-amber-500/10 p-3 text-sm text-amber-700">Open this page inside the Android app to install updates.</p>}

      <button disabled={!native || phase === "checking" || phase === "downloading" || phase === "restarting"} onClick={phase === "available" ? () => void update() : () => void check()} className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 font-bold text-primary-foreground disabled:opacity-50">
        {phase === "checking" ? <><Loader2 className="h-5 w-5 animate-spin" /> Checking…</> : phase === "available" ? <><Download className="h-5 w-5" /> Update now</> : <><RefreshCw className="h-5 w-5" /> Check for updates</>}
      </button>
      <div className="mt-5 grid grid-cols-2 gap-3 text-xs text-muted-foreground"><span className="flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-primary" /> Rollback protected</span><span className="flex items-center gap-1.5"><Smartphone className="h-4 w-4 text-primary" /> No APK reinstall</span></div>
    </div>

    <div className="mt-5 rounded-md border border-border bg-card p-6 shadow-sm">
      <h2 className="font-serif text-2xl font-bold text-foreground">Offline Library</h2>
      <p className="mt-1 text-sm text-muted-foreground">Posts, questions, stories and their images are stored on this phone for use without internet.</p>
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[['Posts', offline?.articleCount || 0], ['MCQs', offline?.mcqCount || 0], ['Flashcards', offline?.flashcardCount || 0], ['Stories', offline?.storyCount || 0], ['Images', imageCount]].map(([label, value]) => <div key={String(label)} className="rounded-md bg-muted/50 p-3"><strong className="block text-xl text-foreground">{value}</strong><span className="text-xs text-muted-foreground">{label}</span></div>)}
      </div>
      {!!offline?.failedImageCount && <p className="mt-3 rounded-md bg-amber-500/10 p-3 text-xs text-amber-700">{offline.failedImageCount} images still require download. Reconnect to Wi-Fi and synchronize again.</p>}
      {offline?.lastSync && <p className="mt-3 text-xs text-muted-foreground">Last synchronized: {new Date(offline.lastSync).toLocaleString()}</p>}
      {syncing && <div className="mt-5"><div className="mb-2 flex justify-between text-xs"><span>{syncMessage}</span><strong>{syncProgress}%</strong></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary transition-colors" style={{ width: `${syncProgress}%` }} /></div></div>}
      <button disabled={syncing || !navigator.onLine} onClick={() => void syncOffline()} className="mt-5 flex min-h-11 w-full items-center justify-center gap-2 border border-primary/30 px-4 text-sm font-bold text-primary disabled:opacity-50">{syncing ? <><Loader2 className="h-4 w-4 animate-spin" /> Synchronizing…</> : <><RefreshCw className="h-4 w-4" /> Synchronize entire library</>}</button>
    </div>
  </main>;
}
