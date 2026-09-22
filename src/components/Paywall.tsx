import { useState } from "react";
import { Lock, Loader2, ShieldCheck, KeyRound, Smartphone, Check, Pencil, Eye, Download, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { AccessPass, AccessPlan, PaymentSettings, issuePassForPayment, normalizePassCode, renamePassCode, verifyCode } from "@/lib/access";
import { useAuth } from "@/hooks/useAuth";
import { signInWithGoogle } from "@/lib/social-auth";
import { savePurchaseIntent } from "@/lib/purchase-intent";

/**
 * Paywall shown where the free portion of a page ends. Two ways in:
 *  1. M-Pesa (Palpluss STK push) -> a pass code is issued automatically
 *  2. Entering a pass code already bought on another device
 */
export function Paywall({
  settings,
  hiddenCount,
  label = "questions",
  onUnlocked,
  headline,
  blurb,
  bare = false,
}: {
  settings: PaymentSettings;
  hiddenCount?: number;
  label?: string;
  onUnlocked: (pass: AccessPass) => void;
  headline?: string;
  blurb?: string;
  /** modal usage: drop the card chrome, the parent provides it */
  bare?: boolean;
}) {
  const plans = settings.plans.length ? settings.plans : [];
  const [planId, setPlanId] = useState(plans[0]?.id || "semester");
  const [phone, setPhone] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "waiting" | "error">("idle");
  const [message, setMessage] = useState("");
  const [mode, setMode] = useState<"buy" | "code">("buy");
  const [code, setCode] = useState("");
  const [issued, setIssued] = useState<AccessPass | null>(null);
  const [customCode, setCustomCode] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [renameMsg, setRenameMsg] = useState("");
  const { user, loading: authLoading } = useAuth();
  const [signingIn, setSigningIn] = useState(false);

  const startGoogle = async () => {
    setSigningIn(true);
    savePurchaseIntent(planId);
    sessionStorage.setItem("post_login_redirect", window.location.pathname + window.location.search);
    const res = await signInWithGoogle();
    if (res.redirected) return;
    setSigningIn(false);
    if (res.error) {
      setState("error");
      setMessage(res.error);
    }
  };

  const plan: AccessPlan = plans.find((p) => p.id === planId) || {
    id: "semester", label: "Semester pass (3 months)", price: settings.price, days: 90, download: true,
  };

  const pollPayment = async (transactionId: string) => {
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      try {
        const { data: json, error } = await supabase.functions.invoke("check-payment", {
          body: { transaction_id: transactionId },
        });
        if (error) continue;
        if (json?.status === "completed") {
          const pass = await issuePassForPayment(transactionId, plan.id);
          if (pass) {
            setIssued(pass);
            setCustomCode(pass.code);
            onUnlocked(pass);
            return;
          }
          setState("error");
          setMessage("Payment received but the pass could not be issued. Contact support with your M-Pesa code.");
          return;
        }
        if (json?.status === "failed") {
          setState("error");
          setMessage("The payment was not completed. You can try again.");
          return;
        }
      } catch { /* keep polling */ }
    }
    setState("error");
    setMessage("Still waiting on M-Pesa. If you were charged, enter your pass code once you receive it.");
  };

  const pay = async () => {
    if (!user) {
      setState("error");
      setMessage("Please sign in with Google first — it ties the subscription to your account.");
      return;
    }
    if (!/^(\+?254|0)?\d{9}$/.test(phone.replace(/\s+/g, ""))) {
      setState("error");
      setMessage("Enter a valid Safaricom number, e.g. 07XXXXXXXX.");
      return;
    }
    setState("sending");
    setMessage("");
    const { data, error } = await supabase.functions.invoke("initiate-payment", {
      body: { phone, amount: plan.price || settings.price, package_type: plan.id },
    });
    if (error || !data?.success) {
      setState("error");
      const code = String(data?.code || "").toUpperCase();
      const retryAfter = Number(data?.details?.retryAfterSeconds || 0);
      const actionableMessage =
        code === "NO_PAYMENT_CHANNELS"
          ? "Payments are not fully configured yet. The administrator needs to add a PalPlus payment channel."
          : code === "NO_DEFAULT_CHANNEL"
            ? "Payments are not fully configured yet. The administrator needs to select a default PalPlus payment channel."
            : code === "INSUFFICIENT_SERVICE_BALANCE"
              ? "The payment service wallet needs to be topped up. Please try again shortly."
              : code === "STK_TEMP_BANNED" && retryAfter > 0
                ? `M-Pesa requests are temporarily paused. Please retry in about ${Math.ceil(retryAfter / 60)} minute(s).`
                : data?.error || error?.message || "Could not start the payment. Please try again.";
      setMessage(actionableMessage);
      return;
    }
    setState("waiting");
    setMessage("Sent. Check your phone and enter your M-Pesa PIN — keep this page open.");
    pollPayment(data.transaction_id);
  };

  const redeem = async () => {
    setState("sending");
    setMessage("");
    const res = await verifyCode(code);
    if (!res.ok || !res.pass) {
      setState("error");
      setMessage(res.error || "Invalid code.");
      return;
    }
    setIssued(res.pass);
    setCustomCode(res.pass.code);
    onUnlocked(res.pass);
  };

  const applyCustomCode = async () => {
    if (!issued) return;
    const next = customCode.trim().toUpperCase();
    if (!next || next === issued.code) return;
    setRenaming(true);
    setRenameMsg("");
    const res = await renamePassCode(issued.code, next);
    setRenaming(false);
    if (!res.ok || !res.pass) {
      setRenameMsg(res.error || "Could not change the code.");
      return;
    }
    setIssued(res.pass);
    setCustomCode(res.pass.code);
    onUnlocked(res.pass);
    setRenameMsg("Code updated — use it on your other device.");
  };

  if (issued) {
    return (
      <div className={`not-prose text-center ${bare ? "" : "my-8 border-y border-primary/30 bg-primary/5 p-6"}`}>
        <ShieldCheck className="mx-auto h-8 w-8 text-primary" />
        <p className="mt-3 font-serif text-lg font-bold text-foreground">Subscription active</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Valid until {new Date(issued.expires_at).toLocaleDateString()}. Answers and PDF handouts are unlocked.
        </p>

        <div className="mx-auto mt-4 max-w-sm border border-border bg-card p-4 text-left">
          <p className="mb-1.5 inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
            <Pencil className="h-3 w-3" /> Your pass code — you can change it
          </p>
          <div className="flex gap-2">
            <input
              value={customCode}
              onChange={(e) => setCustomCode(normalizePassCode(e.target.value))}
              className="flex-1 border border-border bg-background px-3 py-2 font-mono text-sm font-bold text-foreground outline-none focus:border-primary"
            />
            <button
              type="button"
              onClick={applyCustomCode}
              disabled={renaming || !customCode.trim() || customCode.trim().toUpperCase() === issued.code}
              className="inline-flex items-center gap-1.5 border bg-primary px-3 py-2 text-xs font-bold text-primary-foreground disabled:opacity-50"
            >
              {renaming ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              Save
            </button>
          </div>
          {renameMsg && <p className="mt-2 text-[11px] font-semibold text-primary">{renameMsg}</p>}
           <p className="mt-2 inline-flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
             <Mail className="mt-0.5 h-3 w-3 shrink-0" />
             This subscription is linked to <strong>your signed-in email</strong> and works wherever you sign in.
           </p>
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">
           Manage your subscription and code any time on your{" "}
          <Link to="/account" className="font-semibold text-primary underline underline-offset-4">account page</Link>.
        </p>
      </div>
    );
  }

  const busy = state === "sending" || state === "waiting";

  return (
    <div className={`not-prose relative overflow-hidden ${bare ? "" : "my-8 border-y border-border bg-card p-6 shadow-sm sm:p-8"}`}>
      <div className="mx-auto max-w-lg text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-primary">
          <Lock className="h-3 w-3" /> Subscribers only
        </span>
        <h2 className="mt-4 font-serif text-2xl font-bold leading-snug text-foreground">
          {headline || `The ${label} beyond this point are for subscribers`}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {blurb || "Questions stay free to read. Subscribe once to reveal the verified answers on every paper on Ompath Study — and to download PDF handouts."}
        </p>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-[11px] font-semibold text-muted-foreground">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1"><Eye className="h-3 w-3 text-primary" /> Reveal every answer</span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1"><Download className="h-3 w-3 text-primary" /> PDF handouts</span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1"><Mail className="h-3 w-3 text-primary" /> Access follows your email</span>
        </div>

        <div className="mt-5 inline-flex overflow-hidden rounded-full border border-border">
          <button
            type="button"
            onClick={() => { setMode("buy"); setState("idle"); }}
            className={`px-4 py-1.5 text-xs font-bold ${mode === "buy" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
          >
            Pay with M-Pesa
          </button>
          <button
            type="button"
            onClick={() => { setMode("code"); setState("idle"); }}
            className={`px-4 py-1.5 text-xs font-bold ${mode === "code" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
          >
            I have a code
          </button>
        </div>

        {mode === "buy" ? (
          <>
            <div className="mt-5 grid gap-2 text-left sm:grid-cols-2">
              {plans.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPlanId(p.id)}
                  className={`border p-3 transition-colors ${planId === p.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}
                >
                  <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{p.label}</p>
                  <p className="mt-1 font-serif text-lg font-bold text-foreground">KES {p.price}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {p.days >= 365 ? "12 months" : p.days >= 85 ? "3 months" : `${p.days} days`}
                    {p.download ? " · PDF downloads" : ""}
                  </p>
                  {planId === p.id && (
                    <p className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-primary"><Check className="h-3 w-3" /> Selected</p>
                  )}
                </button>
              ))}
            </div>

            {!user && !authLoading && (
              <div className="mt-4 border border-primary/25 bg-primary/5 p-4 text-left">
                <p className="text-xs font-bold uppercase tracking-wide text-primary">Step 1 · Sign in</p>
                <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">
                  Sign in with your Gmail account first. We bring you straight back to this page to finish the M-Pesa payment,
                  and your subscription follows you on any device.
                </p>
                <button
                  type="button"
                  onClick={startGoogle}
                  disabled={signingIn}
                  className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60"
                >
                  {signingIn ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                  Continue with Google
                </button>
                <p className="mt-2 text-center text-[11px] text-muted-foreground">
                  Already paid on another device? Use <button type="button" onClick={() => { setMode("code"); setState("idle"); }} className="font-semibold text-primary underline underline-offset-4">I have a code</button>.
                </p>
              </div>
            )}

            <div className={`mt-4 flex flex-col gap-2 sm:flex-row ${!user && !authLoading ? "pointer-events-none opacity-40" : ""}`}>
              <div className="relative flex-1">
                <Smartphone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  inputMode="tel"
                  placeholder="07XX XXX XXX"
                  className="w-full rounded-full border border-border bg-background py-2.5 pl-9 pr-3 text-sm text-foreground outline-none focus:border-primary"
                />
              </div>
              <button
                type="button"
                onClick={pay}
                disabled={busy || !user}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                {state === "sending" ? "Sending request…" : state === "waiting" ? "Waiting for M-Pesa…" : `Pay KES ${plan.price || settings.price}`}
              </button>
            </div>

            {busy && (
              <div className="mt-4 border border-primary/25 bg-primary/5 p-4 text-left">
                <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-primary">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Payment in progress
                </p>
                <ol className="mt-2 space-y-1.5 text-[12px] leading-relaxed text-foreground/80">
                  <li className={state === "waiting" ? "font-semibold text-primary" : ""}>1 · STK push sent to {phone || "your phone"}</li>
                  <li>2 · Enter your M-Pesa PIN on the prompt</li>
                  <li>3 · Your pass code appears here automatically</li>
                </ol>
                <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-primary/15">
                  <div className="h-full w-1/3 animate-[pulse_1.4s_ease-in-out_infinite] rounded-full bg-primary" />
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">Keep this page open — it can take up to a minute.</p>
              </div>
            )}
          </>
        ) : (
          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={code}
                onChange={(e) => setCode(normalizePassCode(e.target.value))}
                placeholder="OM-XXXXXXXX"
                className="w-full rounded-full border border-border bg-background py-2.5 pl-9 pr-3 font-mono text-sm text-foreground outline-none focus:border-primary"
              />
            </div>
            <button
              type="button"
              onClick={redeem}
              disabled={state === "sending"}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60"
            >
              {state === "sending" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              Unlock
            </button>
          </div>
        )}

        {message && (
          <p className={`mt-3 text-xs font-semibold ${state === "error" ? "text-destructive" : "text-primary"}`}>{message}</p>
        )}
        <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
          One subscription covers the whole site wherever you sign in. Downloads are watermarked with your pass code.{" "}
          <Link to="/login" className="font-semibold text-primary underline underline-offset-4">Sign in</Link> to keep it
          tied to your email account.
        </p>
      </div>
    </div>
  );
}

/** Small banner used when the admin has set the site price to zero. */
export function FreeAccessBanner({ count, label = "questions" }: { count: number; label?: string }) {
  return (
    <div className="not-prose mb-5 flex items-center gap-3 border border-primary/25 bg-primary/5 px-4 py-3">
      <ShieldCheck className="h-4 w-4 shrink-0 text-primary" />
      <p className="text-[13px] font-semibold leading-snug text-foreground">
        This page is free to view — every {label.replace(/s$/, "")} and the full answer key are unlocked.
      </p>
    </div>
  );
}
