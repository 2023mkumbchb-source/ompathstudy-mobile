import { useEffect, useState } from "react";
import { Loader2, Save, ShieldCheck, Trash2, Plus, X } from "lucide-react";
import { getSetting, saveSetting } from "@/lib/store";
import { supabase } from "@/integrations/supabase/client";
import { AccessPlan, DEFAULT_PLANS, loadPaymentSettings } from "@/lib/access";
import { DEFAULT_ABOUT_PROFILE, DEFAULT_SITE_SETTINGS, loadSiteSettings, AboutProfile } from "@/lib/site-settings";
import { toast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

/** Admin panel: payment, access, Reveal pricing, PDF downloads and subscription plans. */
export default function PaymentSettingsAdmin() {
  const [price, setPrice] = useState("0");
  const [ratio, setRatio] = useState("0.25");
  const [revealPrice, setRevealPrice] = useState("5");
  const [downloads, setDownloads] = useState(true);
  const [examPrice, setExamPrice] = useState("0");
  const [mcqPrice, setMcqPrice] = useState("0");
  const [mcqFreeLimit, setMcqFreeLimit] = useState("0");
  const [plans, setPlans] = useState<AccessPlan[]>(DEFAULT_PLANS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [passes, setPasses] = useState<{ code: string; plan: string; expires_at: string; amount: number }[]>([]);
  const [founderVisible, setFounderVisible] = useState(false);
  const [guestSlideView, setGuestSlideView] = useState<"all" | "half">("all");
  const [redacted, setRedacted] = useState(DEFAULT_SITE_SETTINGS.redactedNames.join(", "));
  const [showCounts, setShowCounts] = useState(false);
  const [about, setAbout] = useState<AboutProfile>(DEFAULT_ABOUT_PROFILE);

  useEffect(() => {
    Promise.all([
      getSetting("access_price_kes"),
      getSetting("paywall_free_ratio"),
      getSetting("reveal_price_kes"),
      getSetting("pdf_download_enabled"),
      getSetting("access_plans"),
      getSetting("founder_page_visible"),
      getSetting("guest_slide_view"),
      getSetting("redacted_names"),
      getSetting("show_content_counts"),
      getSetting("mobile_about_profile"),
      getSetting("exam_price"),
      getSetting("mcq_price"),
      getSetting("mcq_free_limit"),
    ]).then(([p, r, rp, d, pl, fv, gsv, rn, sc, ap, ep, mp, ml]) => {
      setPrice(p || "0");
      setRatio(r || "0.25");
      setRevealPrice(rp === "" ? (p || "5") : (rp || "5"));
      setDownloads((d || "true") !== "false");
      setFounderVisible(fv === "true");
      setGuestSlideView(gsv === "half" ? "half" : "all");
      setRedacted((rn ?? "").trim() || DEFAULT_SITE_SETTINGS.redactedNames.join(", "));
      setShowCounts(sc === "true");
      setExamPrice(ep || "0");
      setMcqPrice(mp || "0");
      setMcqFreeLimit(ml || "0");
      try { setAbout({ ...DEFAULT_ABOUT_PROFILE, ...JSON.parse(ap || "{}") }); } catch { /* defaults */ }
      try {
        const parsed = JSON.parse(pl || "[]");
        if (Array.isArray(parsed) && parsed.length) setPlans(parsed);
      } catch { /* keep defaults */ }
    }).catch((error) => {
      console.error("Unable to load payment settings:", error);
      toast({ title: "Could not load payment settings", description: "Check your connection and try again.", variant: "destructive" });
    }).finally(() => setLoading(false));
  }, []);

  const loadPasses = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("access-code", { body: { action: "list" } });
      if (error || data?.error) throw new Error(data?.error || error?.message || "Request failed");
      setPasses(data?.passes || []);
    } catch (error) {
      toast({ title: "Could not load passes", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const cleanAmount = (value: string) => String(Math.max(0, Number(value) || 0));
      const cleanPlans = plans.map((plan) => ({ ...plan, label: plan.label.trim() || "Access pass", price: Math.max(0, Number(plan.price) || 0), days: Math.max(1, Math.round(Number(plan.days) || 1)) }));
      const { data, error } = await (supabase as any).rpc("admin_save_payment_settings", { settings: {
        access_price_kes: cleanAmount(price),
        paywall_free_ratio: String(Math.min(0.9, Math.max(0.05, Number(ratio) || 0.25))),
        pdf_download_enabled: downloads ? "true" : "false",
        access_plans: JSON.stringify(cleanPlans),
        exam_price: cleanAmount(examPrice),
        mcq_price: cleanAmount(mcqPrice),
        mcq_free_limit: String(Math.max(0, Math.round(Number(mcqFreeLimit) || 0))),
      } });
      if (error) throw error;
      if (!data || data.access_price_kes !== cleanAmount(price)) throw new Error("Payment settings were not confirmed by the server.");
      setPlans(cleanPlans);
      // Reveal is intentionally saved as its own setting: 0 = free, >0 = paid.
      await saveSetting("reveal_price_kes", cleanAmount(revealPrice));
      await saveSetting("founder_page_visible", founderVisible ? "true" : "false");
      await saveSetting("guest_slide_view", guestSlideView);
      await saveSetting("redacted_names", redacted);
      await saveSetting("show_content_counts", showCounts ? "true" : "false");
      await saveSetting("mobile_about_profile", JSON.stringify(about));
      await loadPaymentSettings(true);
      await loadSiteSettings(true);
      toast({ title: "Payment settings saved" });
    } catch (e) {
      toast({ title: "Could not save", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const updatePlan = (i: number, patch: Partial<AccessPlan>) => setPlans((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  const addPlan = () => setPlans((prev) => [...prev, { id: `plan-${Date.now().toString(36)}`, label: "New pass", price: 300, days: 90, download: true }]);
  const removePlan = (i: number) => setPlans((prev) => prev.filter((_, idx) => idx !== i));

  if (loading) return <div className="flex min-h-[30vh] items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  const isFree = (Number(price) || 0) <= 0;
  const hiddenPct = Math.round((1 - (Number(ratio) || 0.25)) * 100);
  const revealIsFree = (Number(revealPrice) || 0) <= 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-1 font-serif text-xl font-bold text-foreground">Payments &amp; access</h2>
        <p className="text-sm text-muted-foreground">Questions can remain free to read. Reveal answers and PDF handouts can be subscriber-only.</p>
      </div>

      <section className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <div><h3 className="font-bold">About page</h3><p className="text-xs text-muted-foreground">Hidden until you enable it. Edit what appears in the mobile app.</p></div>
        <label className="flex items-center justify-between gap-3 text-sm"><span>Show About page</span><input type="checkbox" checked={founderVisible} onChange={(e) => setFounderVisible(e.target.checked)} /></label>
        <Input value={about.name} onChange={(e) => setAbout({ ...about, name: e.target.value })} placeholder="Name" />
        <Input value={about.headline} onChange={(e) => setAbout({ ...about, headline: e.target.value })} placeholder="Headline" />
        <Input value={about.location} onChange={(e) => setAbout({ ...about, location: e.target.value })} placeholder="Location" />
        <Input value={about.email} onChange={(e) => setAbout({ ...about, email: e.target.value })} placeholder="Email" type="email" />
        <Input value={about.phone} onChange={(e) => setAbout({ ...about, phone: e.target.value })} placeholder="Phone" />
        <Input value={about.whatsapp} onChange={(e) => setAbout({ ...about, whatsapp: e.target.value })} placeholder="WhatsApp digits" />
        <Textarea value={about.bio} onChange={(e) => setAbout({ ...about, bio: e.target.value })} placeholder="About biography" rows={5} />
      </section>

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block"><span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Site price (KES)</span><input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="numeric" className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary" /><span className="mt-1 block text-[11px] text-muted-foreground">{isFree ? "0 = everything free." : "Locked pages show the paywall after the free portion."}</span></label>
          <label className="block"><span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Free portion of a page</span><input type="range" min="0.05" max="0.9" step="0.05" value={ratio} onChange={(e) => setRatio(e.target.value)} className="mt-3 w-full accent-primary" /><span className="mt-1 block text-[11px] text-muted-foreground">{Math.round((Number(ratio) || 0.25) * 100)}% visible · <strong>{hiddenPct}% hidden</strong> (e.g. 20 questions → {Math.max(1, Math.floor(20 * (Number(ratio) || 0.25)))} free)</span></label>
        </div>

        <div className="mt-5 rounded-xl border border-primary/25 bg-primary/5 p-4">
          <label className="block"><span className="text-xs font-bold uppercase tracking-wide text-primary">Reveal price (KES)</span><Input value={revealPrice} onChange={(e) => setRevealPrice(e.target.value)} inputMode="decimal" className="mt-1.5" /><span className="mt-1 block text-[11px] text-muted-foreground">{revealIsFree ? "0 = Reveal is FREE. Anyone can open answer keys." : `KES ${Math.max(0, Number(revealPrice) || 0)} = Reveal requires an active subscription.`}</span></label>
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">This setting controls the Reveal buttons on image/spot papers, including Reveal all. It does not change Aponeurosis or the site content.</p>
        </div>

        <label className="mt-4 flex items-center gap-2 text-sm text-foreground"><input type="checkbox" checked={downloads} onChange={(e) => setDownloads(e.target.checked)} className="accent-primary" /> Allow watermarked PDF handout downloads</label>
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">Handouts are deliberately abridged and watermarked with the buyer’s pass code.</p>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <p className="mb-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">Exam and MCQ payments</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block"><span className="text-xs font-semibold text-muted-foreground">Exam price (KES)</span><Input inputMode="decimal" value={examPrice} onChange={(e) => setExamPrice(e.target.value)} /></label>
          <label className="block"><span className="text-xs font-semibold text-muted-foreground">MCQ unlock price (KES)</span><Input inputMode="decimal" value={mcqPrice} onChange={(e) => setMcqPrice(e.target.value)} /></label>
          <label className="block"><span className="text-xs font-semibold text-muted-foreground">Free MCQs per set</span><Input inputMode="numeric" value={mcqFreeLimit} onChange={(e) => setMcqFreeLimit(e.target.value)} /></label>
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">Zero keeps that area free. Enter a non-zero amount to activate payment for that area.</p>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <p className="mb-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">Site visibility</p>
        <label className="mb-3 block"><span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Guests on image-answer papers</span><select value={guestSlideView} onChange={(e) => setGuestSlideView(e.target.value as "all" | "half")} className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"><option value="all">Can browse every plate (answers still locked)</option><option value="half">Can browse half the paper only</option></select></label>
        <label className="mb-3 block"><span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Names to hide from content</span><input value={redacted} onChange={(e) => setRedacted(e.target.value)} placeholder="Beda, Otieno" className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary" /><span className="mt-1 block text-[11px] text-muted-foreground">Comma-separated. Lecturer names are scrubbed when pages render — the stored source is untouched.</span></label>
        <label className="mb-2 flex items-center gap-2 text-sm text-foreground"><input type="checkbox" checked={founderVisible} onChange={(e) => setFounderVisible(e.target.checked)} className="accent-primary" /> Show the “About the founder” page</label>
        <label className="flex items-center gap-2 text-sm text-foreground"><input type="checkbox" checked={showCounts} onChange={(e) => setShowCounts(e.target.checked)} className="accent-primary" /> Show plate / question counts in banners</label>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="mb-3 flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Subscription passes</p><button type="button" onClick={addPlan} className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs font-semibold text-foreground hover:border-primary/50 hover:text-primary"><Plus className="h-3 w-3" /> Add pass</button></div>
        <div className="space-y-3">{plans.map((p, i) => (<div key={p.id} className="grid gap-2 sm:grid-cols-[1.4fr_0.7fr_0.7fr_auto] sm:items-center"><input value={p.label} onChange={(e) => updatePlan(i, { label: e.target.value })} placeholder="Label" className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary" /><input value={String(p.price)} onChange={(e) => updatePlan(i, { price: Number(e.target.value) || 0 })} inputMode="numeric" placeholder="KES" className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary" /><input value={String(p.days)} onChange={(e) => updatePlan(i, { days: Number(e.target.value) || 1 })} inputMode="numeric" placeholder="Days" className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary" /><div className="flex items-center gap-3"><label className="flex items-center gap-1.5 text-xs font-semibold text-foreground"><input type="checkbox" checked={p.download !== false} onChange={(e) => updatePlan(i, { download: e.target.checked })} className="accent-primary" /> PDF</label><button type="button" onClick={() => removePlan(i)} aria-label={`Remove ${p.label}`} className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-border text-muted-foreground hover:border-destructive/50 hover:text-destructive"><X className="h-3.5 w-3.5" /></button></div></div>))}</div>
        <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">Recommended: a 3-month semester pass and a 12-month annual pass (90 and 365 days). Access follows the subscriber's signed-in email on every device.</p>
      </div>

      <button type="button" onClick={save} disabled={saving} className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save settings</button>

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="mb-3 flex items-center justify-between"><p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground"><ShieldCheck className="h-3.5 w-3.5 text-primary" /> Issued passes</p><button type="button" onClick={loadPasses} className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-foreground">Load recent</button></div>
        {passes.length === 0 ? <p className="text-xs text-muted-foreground">No passes loaded.</p> : <ul className="divide-y divide-border text-sm">{passes.map((p) => <li key={p.code} className="flex items-center justify-between py-2"><span className="font-mono font-bold text-foreground">{p.code}</span><span className="text-xs text-muted-foreground">{p.plan} · KES {p.amount} · until {new Date(p.expires_at).toLocaleDateString()}</span></li>)}</ul>}
        <p className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground"><Trash2 className="h-3 w-3" /> Passes expire automatically — no manual cleanup needed.</p>
      </div>
    </div>
  );
}
