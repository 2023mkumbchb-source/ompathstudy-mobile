import { useState, useCallback, useEffect } from "react";
import { ChevronLeft, ChevronRight, RotateCcw, Shuffle, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useKeywordLinks, linkifyText } from "@/lib/keyword-link";

interface Props {
  cards: { question: string; answer: string }[];
  title: string;
  setId?: string;
}

const STORAGE_KEY = "flashcard_progress_";

/* ── Inline formatter: bold / italic + auto interlinking ── */
function renderInline(text: string, keyPrefix = "i", ctx?: any) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**"))
      return <strong key={`${keyPrefix}-${i}`} className="font-semibold text-foreground">{linkifyText(p.slice(2, -2), ctx, `${keyPrefix}-s-${i}`)}</strong>;
    if (p.startsWith("`") && p.endsWith("`"))
      return <code key={`${keyPrefix}-${i}`} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.9em]">{p.slice(1, -1)}</code>;
    if (p.startsWith("*") && p.endsWith("*") && p.length > 2)
      return <em key={`${keyPrefix}-${i}`} className="text-foreground/80">{linkifyText(p.slice(1, -1), ctx, `${keyPrefix}-e-${i}`)}</em>;
    return <span key={`${keyPrefix}-${i}`}>{linkifyText(p, ctx, `${keyPrefix}-t-${i}`)}</span>;
  });
}

/* ── Markdown block renderer for flashcard answers ── */
function renderFlashcardMarkdown(raw: string, ctx?: any) {
  if (!raw) return null;

  let text = raw
    .replace(/\r/g, "")
    .replace(/\s(?=\d{1,2}\.\s+[A-Z(])/g, "\n")
    .replace(/\s-\s(?=[A-Z(])/g, "\n- ")
    .replace(/\s(?=→\s)/g, "\n")
    .trim();

  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const out: React.ReactNode[] = [];
  let listBuf: { ordered: boolean; items: string[] } | null = null;

  const flushList = () => {
    if (!listBuf) return;
    const { ordered, items } = listBuf;
    const Tag = ordered ? "ol" : "ul";
    out.push(
      <Tag
        key={`list-${out.length}`}
        className={ordered
          ? "my-2 list-decimal space-y-2 pl-6 text-left"
          : "my-2 space-y-2 pl-1 text-left"}
      >
        {items.map((item, i) => (
          <li
            key={i}
            className={ordered
              ? "pl-1 leading-relaxed text-foreground/90"
              : "flex items-start gap-2.5 leading-relaxed text-foreground/90"}
          >
            {ordered ? renderInline(item, `o${i}`, ctx) : (
              <>
                <span className="mt-[0.55em] h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                <span className="flex-1">{renderInline(item, `u${i}`, ctx)}</span>
              </>
            )}
          </li>
        ))}
      </Tag>
    );
    listBuf = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const ord = line.match(/^(\d{1,2})[.)]\s+(.+)$/);
    if (ord) {
      if (!listBuf || !listBuf.ordered) { flushList(); listBuf = { ordered: true, items: [] }; }
      listBuf.items.push(ord[2]);
      continue;
    }
    const bul = line.match(/^[-*•]\s+(.+)$/);
    if (bul) {
      if (!listBuf || listBuf.ordered) { flushList(); listBuf = { ordered: false, items: [] }; }
      listBuf.items.push(bul[1]);
      continue;
    }
    flushList();
    if (line.startsWith("→")) {
      out.push(
        <p key={`a-${i}`} className="my-1.5 flex items-start gap-2 text-left leading-relaxed text-foreground/90">
          <span className="font-bold text-primary">→</span>
          <span className="flex-1">{renderInline(line.replace(/^→\s*/, ""), `a${i}`, ctx)}</span>
        </p>
      );
      continue;
    }
    out.push(
      <p key={`p-${i}`} className="my-1.5 text-left leading-relaxed text-foreground/90">
        {renderInline(line, `p${i}`, ctx)}
      </p>
    );
  }
  flushList();
  return out;
}

export default function FlashcardViewer({ cards, title, setId }: Props) {
  const storageKey = setId ? STORAGE_KEY + setId : null;
  const linkCtx = useKeywordLinks();

  const [order, setOrder] = useState(() => cards.map((_, i) => i));
  const [current, setCurrent] = useState(() => {
    if (storageKey) {
      try { return JSON.parse(localStorage.getItem(storageKey) || "0"); } catch { return 0; }
    }
    return 0;
  });
  const [showAnswer, setShowAnswer] = useState(false);

  const cardIndex = order[current];

  // Save progress
  useEffect(() => {
    if (storageKey) localStorage.setItem(storageKey, String(current));
  }, [current, storageKey]);

  const next = useCallback(() => {
    if (current < order.length - 1) {
      setCurrent((c) => c + 1);
      setShowAnswer(false);
    }
  }, [current, order.length]);

  const prev = useCallback(() => {
    if (current > 0) {
      setCurrent((c) => c - 1);
      setShowAnswer(false);
    }
  }, [current]);

  const shuffle = () => {
    const shuffled = [...order].sort(() => Math.random() - 0.5);
    setOrder(shuffled);
    setCurrent(0);
    setShowAnswer(false);
  };

  const reset = () => {
    setOrder(cards.map((_, i) => i));
    setCurrent(0);
    setShowAnswer(false);
    if (storageKey) localStorage.removeItem(storageKey);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code === "Space") { e.preventDefault(); setShowAnswer((f) => !f); }
      if (e.code === "ArrowRight") next();
      if (e.code === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [next, prev]);

  return (
    <div className="mx-auto w-full max-w-4xl px-2">
      <h2 className="mb-2 text-center font-serif text-2xl sm:text-3xl font-bold text-foreground leading-tight">{title}</h2>
      <p className="mb-5 sm:mb-7 text-center text-xs sm:text-sm text-muted-foreground">
        Card {current + 1} of {order.length} · Reveal the answer when ready
      </p>

      <div
        className="mx-auto mb-6 sm:mb-8 w-full max-w-3xl cursor-pointer select-none"
        onClick={() => setShowAnswer((s) => !s)}
      >
        <div className="study-surface border-y p-6 sm:p-10" style={{ boxShadow: "var(--shadow-elevated)" }}>
          <div className="mb-4 flex items-center justify-center">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">Question</span>
          </div>
          <div className="text-center font-serif text-lg sm:text-2xl font-semibold text-foreground leading-snug">
            {renderInline(cards[cardIndex]?.question || "", "q", linkCtx)}
          </div>

          {showAnswer && (
            <div className="mt-6 border-t border-border pt-6">
              <div className="mb-3 flex items-center justify-center">
                <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">Answer</span>
              </div>
              <div className="text-left text-[15px] sm:text-base text-foreground/90 leading-relaxed">
                {renderFlashcardMarkdown(cards[cardIndex]?.answer || "", linkCtx)}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-center gap-2 sm:gap-3 flex-wrap">
        <Button variant="outline" size="icon" onClick={prev} disabled={current === 0}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="default" size="sm" onClick={() => setShowAnswer((s) => !s)} className="gap-2">
          {showAnswer ? <><EyeOff className="h-4 w-4"/> Hide</> : <><Eye className="h-4 w-4"/> Show answer</>}
        </Button>
        <Button variant="outline" size="icon" onClick={shuffle}>
          <Shuffle className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" onClick={reset}>
          <RotateCcw className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" onClick={next} disabled={current === order.length - 1}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="mt-4 h-1 w-full rounded-full bg-secondary">
        <div
          className="h-full rounded-full bg-primary transition-colors duration-300"
          style={{ width: `${((current + 1) / order.length) * 100}%` }}
        />
      </div>
    </div>
  );
}
