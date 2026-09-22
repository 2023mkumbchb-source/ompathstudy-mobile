import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import { Paywall } from "@/components/Paywall";
import { AccessPass, PaymentSettings } from "@/lib/access";
import { onSubscribePrompt, snoozeSubscribePrompt } from "@/lib/subscribe-prompt";

/**
 * Global subscription prompt. Opens when a guest taps a locked Reveal button
 * or when the scroll nudge fires while reading a paper with MCQs.
 */
export function SubscribeModal({
  settings,
  loading = false,
  onUnlocked,
}: {
  settings: PaymentSettings;
  loading?: boolean;
  onUnlocked: (pass: AccessPass) => void;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string | undefined>();

  useEffect(() => onSubscribePrompt((r) => { setReason(r); setOpen(true); }), []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [open]);

  const close = () => setOpen(false);
  const later = () => { snoozeSubscribePrompt(20); setOpen(false); };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[130] flex items-end justify-center bg-background/80 p-3 backdrop-blur-sm sm:items-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0" onClick={later} aria-hidden />
      <div className="relative z-10 max-h-[92vh] w-full max-w-xl overflow-y-auto border-y border-border bg-card p-5 shadow-lg sm:p-7" onClick={(event) => event.stopPropagation()}>
        <button
          type="button"
          onPointerDown={(event) => { event.preventDefault(); event.stopPropagation(); close(); }}
          onClick={(event) => { event.preventDefault(); event.stopPropagation(); close(); }}
          aria-label="Close"
          className="sticky right-0 top-0 z-50 ml-auto flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
        {loading ? (
          <div className="flex min-h-48 flex-col items-center justify-center gap-3 text-center" role="status" aria-live="polite">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
            <p className="text-sm font-semibold text-foreground">Loading the current subscription plans…</p>
            <p className="text-xs text-muted-foreground">Your configured price will appear in a moment.</p>
          </div>
        ) : <Paywall
          bare
          settings={settings}
          label="answers"
          headline="Subscribe to reveal the answers"
          blurb={reason || "All questions are free to read. A subscription unlocks the verified answer key on every paper — plus watermarked PDF handouts."}
          onUnlocked={onUnlocked}
        />}
        <div className="mt-4 text-center">
          <button type="button" onClick={later} className="text-xs font-semibold text-muted-foreground underline underline-offset-4">
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}
