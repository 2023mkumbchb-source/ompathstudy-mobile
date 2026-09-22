import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Eye, EyeOff, X, ZoomIn, Images, Check, Pencil, BadgeCheck, List, Rows3, Columns2, Lock, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SlideCorrectionModal } from "@/components/SlideCorrectionModal";
import { useAccess } from "@/lib/access";
import { useSiteSettings } from "@/lib/site-settings";
import { redactNames } from "@/lib/redact";
import { SubscribeModal } from "@/components/SubscribeModal";
import { openSubscribePrompt, useScrollSubscribePrompt } from "@/lib/subscribe-prompt";
import { DeckDownloadButton } from "@/components/DeckPdfExport";
import { preprocessContent } from "@/lib/blog-content";

/**
 * Slide / spot-exam deck renderer.
 *
 * Some articles are pure "image + answer key" sets (SDL spot marathons,
 * embryology slide reviews). Rendering those through the normal prose
 * pipeline produced one long run-on answer paragraph. This component gives
 * them a purpose-built layout: one card per slide, the plate on top, and a
 * short "Reveal" toggle that opens a numbered answer table — one answer per
 * row, never sharing a row.
 */

export interface SlideAnswerRow {
  label?: string;
  term: string;
  detail?: string;
}

export interface Slide {
  key: string;
  number: string;
  prompt: string;
  image?: string;
  alt?: string;
  rows: SlideAnswerRow[];
  labelled: boolean;
}

export interface SlideDeck {
  intro: string;
  slides: Slide[];
  footer: string;
}

const clean = (s: string) =>
  (s || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\*+/g, "")
    .replace(/`+/g, "")
    .replace(/\s+/g, " ")
    .trim();

function splitRow(raw: string): SlideAnswerRow {
  const text = clean(raw.replace(/^[-*•]\s*/, ""));
  const labelled = text.match(/^([A-Z](?:\s*[-–/]\s*[A-Z])?|(?:Left|Right|Top|Bottom)[^:]{0,28}?)\s*:\s*(.+)$/);
  let label: string | undefined;
  let body = text;
  if (labelled) {
    label = clean(labelled[1]);
    body = clean(labelled[2]);
  }
  const dash = body.match(/^(.{2,90}?)\s+[—–]\s+(.+)$/);
  if (dash) return { label, term: clean(dash[1]), detail: clean(dash[2]) };
  return { label, term: body };
}

export interface SideTableRow { letter: string; left?: SlideAnswerRow; right?: SlideAnswerRow }
function splitSideTable(rows: SlideAnswerRow[]): { letters: SideTableRow[]; leftLabel: string; rightLabel: string } | null {
  const parsed = rows.map((r) => {
    const m = (r.label || "").match(/^(Left|Right)\b([^A-Z]*)([A-Z])$/);
    return m ? { side: m[1].toLowerCase(), heading: `${m[1]}${m[2]}`.replace(/[\s—–-]+$/, "").trim(), letter: m[3], row: r } : null;
  });
  if (parsed.some((p) => !p)) return null;
  const ok = parsed as NonNullable<(typeof parsed)[number]>[];
  if (!ok.some((p) => p.side === "left") || !ok.some((p) => p.side === "right")) return null;
  const letters = Array.from(new Set(ok.map((p) => p.letter)));
  return {
    leftLabel: ok.find((p) => p.side === "left")!.heading,
    rightLabel: ok.find((p) => p.side === "right")!.heading,
    letters: letters.map((l) => ({
      letter: l,
      left: ok.find((p) => p.side === "left" && p.letter === l)?.row,
      right: ok.find((p) => p.side === "right" && p.letter === l)?.row,
    })),
  };
}

/** Parse `## Number N: prompt` + image + `**Answer:**` bullet blocks. */
export function parseSlideDeck(content: string): SlideDeck | null {
  if (!content) return null;
  const lines = preprocessContent(content).replace(/\r\n?/g, "\n").split("\n");
  const slides: Slide[] = [];
  const introLines: string[] = [];
  const footerLines: string[] = [];
  let cur: Slide | null = null;
  let inAnswer = false;
  let seenAny = false;

  const push = () => {
    if (cur && (cur.image || cur.rows.length)) {
      cur.labelled = cur.rows.length > 1 && cur.rows.every((r) => !!r.label);
      slides.push(cur);
    }
    cur = null;
    inAnswer = false;
  };

  for (const line of lines) {
    const t = line.trim();
    const head = t.match(/^#{2,3}\s+(?:Number|Slide|Plate|Spot|Q(?:uestion)?)\s*([0-9]+[a-z]?)\s*[:.\-–]?\s*(.*)$/i);
    if (head) {
      push();
      seenAny = true;
      cur = { key: `slide-${head[1]}-${slides.length}`, number: head[1], prompt: clean(head[2]), rows: [], labelled: false };
      continue;
    }
    if (!cur) {
      (seenAny ? footerLines : introLines).push(line);
      continue;
    }
    const img = t.match(/^!\[(.*?)\]\((.*?)\)$/);
    if (img) {
      if (!cur.image) { cur.image = img[2].trim(); cur.alt = clean(img[1]); }
      continue;
    }
    if (/^\*{0,2}\s*(?:✅\s*)?(?:Answer|Answers|Answer key)\s*[:：]?\s*\*{0,2}$/i.test(t)) { inAnswer = true; continue; }
    const inlineAnswer = t.match(/^\*{0,2}\s*(?:✅\s*)?(?:Answer|Answers)\s*[:：]\s*\*{0,2}(.+)$/i);
    if (inlineAnswer) { inAnswer = true; cur.rows.push(splitRow(inlineAnswer[1])); continue; }
    if (!t) continue;
    if (/^[-*•]\s+/.test(t) || /^\d+[.)]\s+/.test(t)) {
      cur.rows.push(splitRow(t.replace(/^\d+[.)]\s+/, "")));
      continue;
    }
    if (inAnswer) cur.rows.push(splitRow(t));
    else if (!cur.prompt) cur.prompt = clean(t);
  }
  push();

  const withImages = slides.filter((s) => s.image).length;
  if (slides.length < 3 || withImages < Math.max(3, Math.ceil(slides.length * 0.6))) return null;

  return {
    intro: introLines.join("\n").trim(),
    slides,
    footer: footerLines.join("\n").trim(),
  };
}

function Lightbox({ src, alt, onClose }: { src: string; alt?: string; onClose: () => void }) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const onNativeBack = (e: Event) => { e.preventDefault(); onClose(); };
    window.addEventListener("keydown", onKey);
    window.addEventListener("ompath:native-back", onNativeBack);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); window.removeEventListener("ompath:native-back", onClose); };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-background/95 p-3 backdrop-blur-sm" onClick={onClose}>
      <button className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-foreground" aria-label="Close image">
        <X className="h-4 w-4" />
      </button>
      <img src={src} alt={alt || ""} className="max-h-[92vh] w-auto max-w-full border object-contain" />
    </div>
  );
}

function AnswerRows({ rows, labelled }: { rows: SlideAnswerRow[]; labelled: boolean }) {
  if (!rows.length) return null;
  const side = labelled ? splitSideTable(rows) : null;
  if (side) {
    return (
      <div className="overflow-x-auto border border-border">
        <table className="w-full border-collapse text-left text-sm">
          <thead><tr className="bg-muted/60"><th scope="col" className="w-12 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">#</th><th scope="col" className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{side.leftLabel}</th><th scope="col" className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{side.rightLabel}</th></tr></thead>
          <tbody>{side.letters.map((r) => <tr key={r.letter} className="border-t border-border/70 align-top even:bg-muted/20"><td className="px-3 py-2.5 font-mono text-xs font-bold text-primary">{r.letter}</td><td className="px-3 py-2.5 leading-relaxed text-foreground">{r.left?.term || "—"}</td><td className="px-3 py-2.5 leading-relaxed text-foreground">{r.right?.term || "—"}</td></tr>)}</tbody>
        </table>
      </div>
    );
  }
  if (labelled) {
    return (
      <div className="overflow-x-auto border border-border">
        <table className="w-full border-collapse text-left text-sm">
          <thead><tr className="bg-muted/60"><th scope="col" className="w-20 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Label</th><th scope="col" className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Structure</th></tr></thead>
          <tbody>{rows.map((r, i) => <tr key={i} className="border-t border-border/70 align-top even:bg-muted/20"><td className="px-3 py-2.5 font-mono text-xs font-bold text-primary">{r.label}</td><td className="px-3 py-2.5 leading-relaxed text-foreground"><span className="font-medium">{r.term}</span>{r.detail && <span className="mt-0.5 block text-[13px] text-muted-foreground">{r.detail}</span>}</td></tr>)}</tbody>
        </table>
      </div>
    );
  }
  return (
    <ol className="divide-y divide-border overflow-hidden border border-border">
      {rows.map((r, i) => <li key={i} className="flex items-start gap-3 px-3 py-2.5 even:bg-muted/20"><span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">{i + 1}</span><span className="min-w-0 flex-1 text-sm leading-relaxed">{r.label && <span className="mr-1.5 font-mono text-xs font-bold text-primary">{r.label}:</span>}<span className="font-medium text-foreground">{r.term}</span>{r.detail && <span className="mt-0.5 block text-[13px] leading-relaxed text-muted-foreground">{r.detail}</span>}</span></li>)}
    </ol>
  );
}

function PlatesHandle({ onOpen }: { onOpen: () => void }) {
  const KEY = "ompath_plates_handle_pos";
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const dragging = useRef(false);
  const moved = useRef(false);
  useEffect(() => { try { const raw = localStorage.getItem(KEY); if (raw) setPos(JSON.parse(raw)); } catch {} }, []);
  const place = useCallback((clientX: number, clientY: number) => { const x = Math.min(Math.max(8, clientX - 40), window.innerWidth - 96); const y = Math.min(Math.max(8, clientY - 20), window.innerHeight - 56); setPos({ x, y }); }, []);
  useEffect(() => { const move = (e: PointerEvent) => { if (!dragging.current) return; moved.current = true; place(e.clientX, e.clientY); }; const up = () => { if (!dragging.current) return; dragging.current = false; setPos((p) => { if (p) { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch {} } return p; }); }; window.addEventListener("pointermove", move); window.addEventListener("pointerup", up); window.addEventListener("pointercancel", up); return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", up); }; }, [place]);
  const style = pos ? { left: pos.x, top: pos.y, bottom: "auto", right: "auto" } : undefined;
  return <button type="button" onPointerDown={(e) => { dragging.current = true; moved.current = false; (e.target as HTMLElement).releasePointerCapture?.(e.pointerId); }} onClick={() => { if (!moved.current) onOpen(); }} aria-label="Open plate index — drag to move" title="Plate index (drag to move)" style={style} className="fixed bottom-24 left-3 z-40 inline-flex touch-none items-center gap-1.5 rounded-full border border-border bg-background/70 px-3 py-2 text-xs font-semibold text-foreground shadow-lg backdrop-blur transition-colors hover:border-primary/50 hover:text-primary"><List className="h-4 w-4" /> Plates</button>;
}

function SlideCard({ slide, index, onZoom, defaultOpen = false, corrections = [], onSuggest, locked = false }: { slide: Slide; index: number; onZoom: (s: Slide) => void; defaultOpen?: boolean; corrections?: string[]; onSuggest?: (s: Slide) => void; locked?: boolean; }) {
  const [open, setOpen] = useState(defaultOpen && !locked);
  const [loaded, setLoaded] = useState(false);
  const eager = index < 2;
  return (
    <article id={`slide-${slide.number}`} className="h-fit self-start scroll-mt-24 overflow-hidden border border-border bg-card">
      <header className="flex items-start gap-3 border-b border-border px-4 py-3">
        <span className="mt-0.5 inline-flex h-8 min-w-8 shrink-0 items-center justify-center border bg-primary px-1.5 text-[13px] font-bold text-primary-foreground">{index + 1}</span>
        <h2 className="flex-1 font-serif text-[16px] font-bold leading-snug text-foreground sm:text-lg">{redactNames(slide.prompt) || `Slide ${index + 1}`}</h2>
        {onSuggest && <button type="button" onClick={() => onSuggest(slide)} title="Suggest a correction for this plate" aria-label={`Suggest a correction for plate ${slide.number}`} className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border/70 bg-background/70 text-muted-foreground backdrop-blur transition-colors hover:border-primary/40 hover:text-primary"><Pencil className="h-3.5 w-3.5" /></button>}
      </header>
      {slide.image && <button type="button" onClick={() => onZoom(slide)} className="group relative block w-full bg-muted/40" aria-label="Enlarge plate"><span className="block aspect-[3/2] w-full overflow-hidden"><img src={slide.image} alt={slide.alt || slide.prompt} loading={eager ? "eager" : "lazy"} decoding="async" // @ts-expect-error fetchpriority is valid HTML
        fetchpriority={eager ? "high" : "low"} onLoad={() => setLoaded(true)} className={`h-full w-full object-contain transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`} /></span>{!loaded && <span className="absolute inset-0 animate-pulse bg-muted" />}<span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-background/85 px-2 py-1 text-[11px] font-semibold text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"><ZoomIn className="h-3 w-3" /> Zoom</span></button>}
      {slide.rows.length > 0 && (
        <div className="px-4 py-3">
          {locked ? (
            <button type="button" onClick={() => openSubscribePrompt("Subscribe or restore your pass to reveal this plate answer.")} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary">
              <Lock className="h-3.5 w-3.5" /> Subscribe to reveal
            </button>
          ) : (
            <>
              <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/10">
                {open ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                {open ? "Hide" : "Reveal"}
              </button>
              {open && <div className="mt-3"><AnswerRows rows={slide.rows} labelled={slide.labelled} />{corrections.length > 0 && <div className="mt-3 border border-primary/30 bg-primary/5 p-3"><p className="mb-1.5 inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-primary"><BadgeCheck className="h-3.5 w-3.5" /> Verified reader corrections</p><ul className="space-y-1 text-[13px] leading-relaxed text-foreground">{corrections.map((c, i) => <li key={i}>• {c}</li>)}</ul></div>}</div>}
            </>
          )}
        </div>
      )}
    </article>
  );
}

export function SlideDeckView({ deck, revealAllDefault = false, articleId, title = "Spot paper", university, onPreview }: { deck: SlideDeck; revealAllDefault?: boolean; articleId?: string; title?: string; university?: string; onPreview?: () => void; }) {
  const [zoom, setZoom] = useState<Slide | null>(null);
  const [allKey, setAllKey] = useState(0);
  const [revealAll, setRevealAll] = useState(revealAllDefault);
  const [suggestFor, setSuggestFor] = useState<Slide | null>(null);
  const [corrections, setCorrections] = useState<Record<string, string[]>>({});
  const [cols, setCols] = useState<1 | 2>(2);
  const [navOpen, setNavOpen] = useState(false);
  const access = useAccess();
  const site = useSiteSettings();
  const locked = !access.canReveal;
  const visibleSlides = useMemo(() => { if (!locked || site.guestSlideView !== "half") return deck.slides; return deck.slides.slice(0, Math.max(1, Math.ceil(deck.slides.length / 2))); }, [deck.slides, locked, site.guestSlideView]);
  const truncated = visibleSlides.length < deck.slides.length;
  useScrollSubscribePrompt(false);
  useEffect(() => { if (!articleId) return; let active = true; (async () => { const { data } = await supabase.from("slide_corrections").select("slide_number, suggestion").eq("article_id", articleId).eq("status", "approved"); if (!active || !data) return; const map: Record<string, string[]> = {}; for (const row of data as { slide_number: string; suggestion: string }[]) (map[row.slide_number] ||= []).push(row.suggestion); setCorrections(map); })(); return () => { active = false; }; }, [articleId]);
  const intro = useMemo(() => deck.intro.split("\n").map((l) => l.trim()).filter((l) => l && !/^#\s/.test(l) && !/^!\[/.test(l)), [deck.intro]);
  return (
    <div className="not-prose">
      {intro.length > 0 && null}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-y border-border py-3">
        <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground"><Images className="h-3.5 w-3.5 text-primary" />{site.showCounts ? `${deck.slides.length} plates · ` : ""}tap Reveal for the answer key</p>
        <div className="flex items-center gap-2">
          {!locked && access.settings.downloadEnabled && <>{onPreview && <button type="button" onClick={onPreview} className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:border-primary/40 hover:text-primary"><Images className="h-3.5 w-3.5" /> Preview</button>}<DeckDownloadButton deck={deck} title={title} university={university} passCode={access.pass?.code} disabled={!access.canDownload} /></>}
          <div className="inline-flex overflow-hidden rounded-full border border-border"><button type="button" onClick={() => setCols(1)} aria-pressed={cols === 1} title="One column (paper view)" className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-colors ${cols === 1 ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-primary"}`}><Rows3 className="h-3.5 w-3.5" /> 1 col</button><button type="button" onClick={() => setCols(2)} aria-pressed={cols === 2} title="Two columns (grid)" className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-colors ${cols === 2 ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-primary"}`}><Columns2 className="h-3.5 w-3.5" /> 2 col</button></div>
          <button type="button" onClick={() => { if (locked) { openSubscribePrompt("Subscribe or restore your pass to reveal all plate answers."); return; } setRevealAll((v) => !v); setAllKey((k) => k + 1); }} className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:border-primary/40 hover:text-primary">{locked ? <Lock className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}{locked ? "Subscribe to reveal all" : revealAll ? "Hide all" : "Reveal all"}</button>
        </div>
      </div>
      <PlatesHandle onOpen={() => setNavOpen(true)} />
      {navOpen && <div className="fixed inset-0 z-[110] flex" role="dialog" aria-label="Plate index"><div className="absolute inset-0 bg-background/70 backdrop-blur-sm" onClick={() => setNavOpen(false)} /><nav className="relative h-full w-64 max-w-[80vw] overflow-y-auto border-r border-border bg-card p-4 shadow-lg"><div className="mb-3 flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Plates</p><button type="button" onClick={() => setNavOpen(false)} aria-label="Close plate index" className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border text-muted-foreground"><X className="h-4 w-4" /></button></div><div className="grid grid-cols-4 gap-1.5">{deck.slides.map((s, index) => <a key={s.key} href={`#slide-${s.number}`} onClick={() => setNavOpen(false)} className="rounded-md border border-border px-2 py-1.5 text-center text-xs font-semibold text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary">{index + 1}</a>)}</div></nav></div>}
      {locked ? <button type="button" onClick={() => openSubscribePrompt("Subscribe to reveal the verified answer key on every plate.")} className="not-prose mb-5 flex w-full items-center gap-3 border border-primary/25 bg-primary/5 px-4 py-3 text-left transition-colors hover:border-primary/50"><Sparkles className="h-4 w-4 shrink-0 text-primary" /><span className="text-[13px] font-semibold leading-snug text-foreground">{truncated ? "Part of this paper is open to guests. Subscribe to see every plate, reveal the answer key and download the PDF handout." : "Every plate is free to view. Subscribe to reveal the answer key and download the PDF handout."}</span></button> : <div className="not-prose mb-5 flex items-center gap-3 border border-primary/25 bg-primary/5 px-4 py-3"><BadgeCheck className="h-4 w-4 shrink-0 text-primary" /><p className="text-[13px] font-semibold leading-snug text-foreground">Subscription active — the full paper and answer key are unlocked.</p></div>}
      <div className={`grid items-start gap-5 ${cols === 2 ? "sm:grid-cols-2" : "mx-auto max-w-3xl grid-cols-1"}`}>{visibleSlides.map((s, i) => <SlideCard key={`${s.key}-${allKey}`} slide={s} index={i} onZoom={setZoom} defaultOpen={revealAll} corrections={corrections[s.number] || []} onSuggest={articleId ? setSuggestFor : undefined} locked={locked} />)}</div>
      <SubscribeModal settings={access.settings} loading={access.loading} onUnlocked={access.applyPass} />
      {truncated && <button type="button" onClick={() => openSubscribePrompt("Subscribe to open the rest of this paper.")} className="not-prose mt-6 flex w-full items-center justify-center gap-2 border border-primary/30 bg-primary/5 px-4 py-4 text-sm font-bold text-primary"><Lock className="h-4 w-4" /> Subscribe to continue this paper</button>}
      {deck.footer && <p className="mt-8 border-t border-border pt-4 text-[13px] italic leading-relaxed text-muted-foreground">{redactNames(clean(deck.footer), site.redactedNames)}</p>}
      {zoom?.image && <Lightbox src={zoom.image} alt={zoom.alt} onClose={() => setZoom(null)} />}
      {articleId && suggestFor && <SlideCorrectionModal articleId={articleId} slideNumber={suggestFor.number} slidePrompt={suggestFor.prompt} open={!!suggestFor} onClose={() => setSuggestFor(null)} />}
    </div>
  );
}

export function SlidePreviewModal({ deck, title, university, open, onClose }: { deck: SlideDeck; title: string; university?: string; open: boolean; onClose: () => void }) {
  useEffect(() => { if (!open) return; const prev = document.body.style.overflow; document.body.style.overflow = "hidden"; const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose(); window.addEventListener("keydown", onKey); return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); }; }, [open, onClose]);
  if (!open) return null;
  return <div className="fixed inset-0 z-[100] overflow-y-auto bg-black/70 p-2 backdrop-blur-sm sm:p-6" onClick={onClose}><div className="relative mx-auto my-4 w-full max-w-3xl border bg-white text-neutral-900 shadow-lg" onClick={(e) => e.stopPropagation()}><button onClick={onClose} className="sticky top-2 float-right z-10 mr-2 mt-2 inline-flex h-9 w-9 items-center justify-center rounded-full bg-neutral-900 text-white" aria-label="Close preview"><X className="h-4 w-4" /></button><div className="clear-both px-5 py-8 font-serif sm:px-10 sm:py-12"><div className="mb-8 border-b-2 border-neutral-900 pb-5 text-center">{university && <p className="text-sm font-bold uppercase tracking-[0.2em] text-neutral-800">{university}</p>}<h1 className="mt-3 text-2xl font-bold leading-tight sm:text-3xl">{title}</h1><p className="mt-3 text-[11px] italic text-neutral-500">Spot paper preview — questions only.</p></div><ol className="space-y-10">{deck.slides.map((s, index) => <li key={s.key}><p className="mb-3 text-[15px] font-bold">{index + 1}. {redactNames(s.prompt)}</p>{s.image && <img src={s.image} alt={s.alt || s.prompt} loading="lazy" decoding="async" className="mb-3 w-full rounded border border-neutral-200 object-contain" />}{s.rows.length > 0 && <ol className="text-[13px] text-neutral-500">{s.rows.map((r, i) => <li key={i} className="border-b border-neutral-200 py-1.5 last:border-0"><span className="font-bold">{r.label || `${i + 1}.`}</span><span className="ml-2 inline-block min-w-[55%] border-b border-dotted border-neutral-400 align-middle">&nbsp;</span></li>)}</ol>}</li>)}</ol><div className="mt-10 border-t border-neutral-300 pt-4 text-center text-[11px] text-neutral-500">Ompath Study · End of preview</div></div></div></div>;
}
