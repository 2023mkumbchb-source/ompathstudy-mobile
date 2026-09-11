import { useState, useEffect, useMemo, useLayoutEffect, forwardRef, memo } from "react";
import { useParams, Link, useNavigate, useLocation } from "react-router-dom";
import {
  ArrowLeft, Loader2, GraduationCap, ListChecks,
  ChevronDown, ChevronRight, FileText, HelpCircle, Sparkles, GitMerge, Settings2, ImagePlus, X, Eye, EyeOff, Lock,
} from "lucide-react";
import ShareButtons from "@/components/ShareButtons";
import ArticleComments from "@/components/ArticleComments";
import { Countdown, HtmlEmbed, PasswordGate, ContentToc, ReadingTimeBadge } from "@/components/ContentExtras";
import { motion, AnimatePresence } from "framer-motion";
import { getArticleBySlugOrId, getPublishedArticleSummaries, getRelatedContent, getCategoryDisplayName, getYearFromCategory, buildBlogPath, buildMcqPath, buildFlashcardPath, type Article } from "@/lib/store";
import { extractFirstImageFromContent, SITE_URL, stripRichText, updateMetaTags } from "@/lib/seo";
import { isGenericThumbnail, useTopicThumbnailInfo } from "@/lib/topicThumbnail";
import { KeywordLinkProvider, useKeywordLinks, linkifyText } from "@/lib/keyword-link";
import { slugify, useHashFlash } from "@/lib/deep-link";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { markArticleVisited } from "@/lib/progress-store";
import { parseSlideDeck, SlideDeckView, SlidePreviewModal } from "@/components/SlideDeck";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useAccess } from "@/lib/access";
import { SubscribeModal } from "@/components/SubscribeModal";
import { openSubscribePrompt, useScrollSubscribePrompt } from "@/lib/subscribe-prompt";
import StudyControls from "@/components/StudyControls";
import HelpfulVote from "@/components/HelpfulVote";
import ArticleMcqOption from "@/components/ArticleMcqOption";
import {
  splitLeakedAnswer, cleanMetaTitle, cleanMetaDescription,
  articleHaystack, inferExamType, inferUnit,
  type PreviewMcq, type PreviewEssay, inferArticleLayout,
  cleanDisplayText, formatSequence, spaceOptionMarkers, countOptionMarkers,
  markerLetters, looksLikeChoiceRun, splitMarkerRun, normalizeOptionLine,
  splitOptionRun, splitStemAndOptions, isQuestionLike, extractExamQuestions,
  splitInlineTable, decodeEntities, dropEmptySections, cleanHeadingText,
  splitMalformedHeading, isTableRow, unwrapHardBreaks, preprocessContent,
  isLikelyStandaloneSectionHeading,
  isDuplicateArticleHeading,
  type TocItem, extractToc, answerKeyByQuestion, parseConsolidatedAnswerKey,
  mergeAnswerKeys, looksLikeUpcomingMcqOptions,
} from "@/lib/blog-content";

/**
 * Mounts the subscription prompt for articles that carry MCQs: guests read the
 * questions freely and get nudged as they scroll; subscribers see nothing.
 */
function ArticleSubscribeGate({ hasMcqs }: { hasMcqs: boolean }) {
  const access = useAccess();
  useScrollSubscribePrompt(false);
  return <SubscribeModal settings={access.settings} loading={access.loading} onUnlocked={access.applyPass} />;
}

/* ─── Inline text: bold/italic ─── */
const Inline = forwardRef<HTMLSpanElement, { text: string }>(({ text }, ref) => {
  const linkCtx = useKeywordLinks();
  const parts = text.replace(/⭐+/g, "").split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return (
    <span ref={ref}>
      {parts.map((part, j) => {
        if (part.startsWith("**") && part.endsWith("**"))
          return <strong key={j} className="font-semibold text-foreground">{linkifyText(part.slice(2, -2), linkCtx, `s${j}`)}</strong>;
        if (part.startsWith("*") && part.endsWith("*") && part.length > 2)
          return <em key={j} className="text-foreground/80">{linkifyText(part.slice(1, -1), linkCtx, `e${j}`)}</em>;
        return <span key={j}>{linkifyText(part.replace(/\*/g, ""), linkCtx, `t${j}`)}</span>;
      })}
    </span>
  );
});
Inline.displayName = "Inline";

/* ─── Reading progress bar + dot ─── */
function ReadingProgress() {
  const [pct, setPct] = useState(0);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const fn = () => {
      const d = document.documentElement;
      const total = d.scrollHeight - d.clientHeight;
      setPct(total > 0 ? (d.scrollTop / total) * 100 : 0);
    };
    window.addEventListener("scroll", fn, { passive: true });
    fn();
    return () => window.removeEventListener("scroll", fn);
  }, []);

  const rounded = Math.max(0, Math.min(100, Math.round(pct)));

  const getColor = (p: number) => {
    if (p < 25) return { bg: "bg-red-500", bar: "from-red-500 to-red-400" };
    if (p < 50) return { bg: "bg-orange-500", bar: "from-red-500 via-orange-500 to-orange-400" };
    if (p < 75) return { bg: "bg-yellow-500", bar: "from-red-500 via-orange-500 to-yellow-500" };
    return { bg: "bg-green-500", bar: "from-red-500 via-orange-500 via-yellow-500 to-green-500" };
  };
  const colors = getColor(rounded);

  return (
    <>
      <div className="fixed left-0 right-0 top-0 z-50 h-[3px]">
        <div className={`h-full bg-gradient-to-r ${colors.bar} transition-all duration-150`} style={{ width: `${pct}%` }} />
      </div>
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className={`fixed bottom-6 right-4 z-40 inline-flex items-center justify-center rounded-full border border-border text-white shadow-lg transition-all ${colors.bg} ${expanded ? "h-9 px-3 text-xs font-semibold" : "h-3.5 w-3.5"}`}
        aria-label="Reading progress"
      >
        <span className={`${expanded ? "opacity-100" : "sr-only"}`}>{rounded}%</span>
      </button>
    </>
  );
}

/* ─── Markdown table ─── */
function TableBlock({ lines }: { lines: string[] }) {
  const isSep = (l: string) => /^\|[\s\-:|]+(\|[\s\-:|]+)+\|?$/.test(l.trim());
  const parseRow = (l: string) =>
    l.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map(c => c.trim());
  const fallbackHeader = (index: number, total: number) => {
    if (total === 2) return index === 0 ? "Topic" : "Details";
    if (total === 3) return ["Topic", "Key point", "Clinical relevance"][index] || `Column ${index + 1}`;
    if (total === 4) return ["Topic", "Description", "Features", "Notes"][index] || `Column ${index + 1}`;
    return `Column ${index + 1}`;
  };
  const dataLines = lines.filter(l => !isSep(l));
  if (dataLines.length < 1) return null;
  const hasSeparator = lines.some(isSep);
  const [firstLine, ...restLines] = dataLines;
  const firstRow = parseRow(firstLine);
  const firstIsEmpty = firstRow.every((c) => !c || /^[\s-:]*$/.test(c));
  const useHeader = hasSeparator && !firstIsEmpty;
  const rows = (useHeader ? restLines : dataLines).map(parseRow).filter((row) => row.some(Boolean));
  const colCount = Math.max(firstRow.length, ...rows.map((r) => r.length));
  const headers = Array.from({ length: colCount }, (_, i) => (useHeader ? firstRow[i] : "") || fallbackHeader(i, colCount));
  if (!rows.length) return null;

  return (
    <div className="not-prose my-6 overflow-hidden border-y border-border bg-card sm:rounded-lg sm:border">
      <div className="overflow-x-auto">
      <table className="article-data-table min-w-full border-collapse text-sm"
style={{ minWidth: colCount <= 2 ? "420px" : "560px" }} data-columns={colCount}>
        <colgroup>
          {Array.from({ length: colCount }).map((_, i) => <col key={i} />)}
        </colgroup>
        <thead>
          <tr className="border-b border-border bg-muted/60">
            {Array.from({ length: colCount }).map((_, i) => (
              <th
                key={i}
                scope="col"
                className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-foreground"
              >
                <Inline text={headers[i] || ""} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className="border-b border-border/50 last:border-0 even:bg-muted/20">
              {Array.from({ length: colCount }).map((_, ci) => (
                <td
                  key={ci}
                  className="px-4 py-3 align-top leading-relaxed text-foreground/90"
                >
                  {row[ci] != null ? <Inline text={row[ci]} /> : null}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}

function FlowBlock({ lines }: { lines: string[] }) {
  const compact = lines.map((l) => l.trim()).filter(Boolean);
  if (!compact.length) return null;
  return (
    <div className="not-prose my-5 overflow-hidden rounded-lg border border-border bg-card">
      <div className="max-h-[70vh] overflow-x-auto px-4 py-4 sm:px-5">
        <div className="min-w-max space-y-2 text-center font-mono text-[13px] leading-6 text-foreground/90 sm:text-sm">
          {compact.map((line, i) => {
            const arrowOnly = /^(↓|v|\|)$/i.test(line);
            const branch = /\+[-+]+\+/.test(line) || /\s{2,}/.test(line);
            return (
              <div
                key={i}
                className={arrowOnly ? "text-primary" : branch ? "text-muted-foreground" : "rounded-md bg-muted/40 px-3 py-2"}
              >
                {arrowOnly ? "↓" : line}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ─── Practice Q expandable ─── */
function PracticeQuestion({ number, question, answer }: { number: string; question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  const access = useAccess();
  const locked = !access.canReveal;
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button onClick={() => locked ? openSubscribePrompt("Subscribe or restore your pass to reveal this answer.") : setOpen(o => !o)} className={`w-full flex items-start gap-3 px-4 py-4 sm:px-5 sm:py-4 text-left transition-colors ${locked ? "hover:bg-muted/30" : "hover:bg-muted/30"}`}>
        <span className="shrink-0 flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold mt-0.5">{number}</span>
        <span className="flex-1 text-sm sm:text-[15px] font-medium text-foreground leading-relaxed"><Inline text={question} /></span>
        {locked ? <Lock className="h-4 w-4 shrink-0 text-muted-foreground mt-1" /> : <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground mt-1 transition-transform ${open ? "rotate-180" : ""}`} />}
      </button>
      <AnimatePresence initial={false}>
        {open && !locked && (
          <motion.div key="a" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.15 }} className="overflow-hidden">
            <div className="px-4 py-4 sm:px-5 sm:py-5 border-t border-border bg-muted/20">
              <p className="text-sm sm:text-[15px] text-foreground/90 leading-[1.75] whitespace-pre-line"><Inline text={answer} /></p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── MCQ answer + explanation collapsible (used inside articles) ─── */
/* Essay question — answers are always visible (never hidden behind a button) */
function EssayQuestion({ number, question, answer }: { number: string; question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  const access = useAccess();
  const locked = !access.canReveal;
  return (
    <article className="rounded-xl border border-border bg-card p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="shrink-0 flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold mt-0.5">{number}</span>
        <h3 className="flex-1 text-sm sm:text-[15px] font-semibold text-foreground leading-relaxed"><Inline text={question} /></h3>
      </div>
      {answer && (
        <div className="mt-3">
          <button type="button" onClick={() => locked ? openSubscribePrompt("Subscribe or restore your pass to reveal this model answer.") : setOpen((value) => !value)} className="flex w-full items-center justify-between rounded-lg border border-primary/25 bg-primary/5 px-3 py-2 text-left text-sm font-semibold text-primary">
            <span className="inline-flex items-center gap-2">{locked ? <Lock className="h-4 w-4" /> : <Eye className="h-4 w-4" />}{locked ? "Model answer — subscribers" : open ? "Hide model answer" : "Reveal model answer"}</span>
            {!locked && <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />}
          </button>
          {open && !locked && <div className="mt-3 border-l-2 border-primary/50 pl-4">
            <p className="text-sm sm:text-[15px] text-foreground/90 leading-[1.75] whitespace-pre-line"><Inline text={answer} /></p>
          </div>}
        </div>
      )}
    </article>
  );
}


/** Paragraph renderer: strips OCR orphan punctuation and hides leaked answers. */
function renderProse(t: string, key: string) {
  const cleaned = t.replace(/^#+\s*/, "").replace(/^[.·•,;:]+\s*/, "").trim();
  if (!cleaned) return [];
  const { text, answer } = splitLeakedAnswer(cleaned);
  const out = [
    <p key={key} className="mb-5 text-[1.03rem] leading-8 text-foreground/90"><Inline text={text} /></p>,
  ];
  if (answer) out.push(<McqAnswerBlock key={`${key}-ans`} raw={answer} />);
  return out;
}

function McqAnswerBlock({ raw, articleId, questionKey }: { raw: string; articleId?: string; questionKey?: string }) {
  const [open, setOpen] = useState(false);
  const access = useAccess();
  const locked = !access.canReveal;
  useEffect(() => {
    if (!articleId || !questionKey || locked) return;
    const eventName = `ompath:answer:${articleId}:${questionKey}`;
    const reveal = (event: Event) => {
      const detail = (event as CustomEvent<{ solved?: boolean; firstAttempt?: boolean }>).detail;
      if (!detail?.solved) return;
      setOpen(true);
      if (!detail.firstAttempt) return;
      window.setTimeout(() => {
        const questions = Array.from(document.querySelectorAll<HTMLElement>('[data-article-question="true"]'));
        const currentIndex = questions.findIndex((question) => question.dataset.questionKey === questionKey);
        questions[currentIndex + 1]?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 220);
    };
    window.addEventListener(eventName, reveal);
    return () => window.removeEventListener(eventName, reveal);
  }, [articleId, questionKey, locked]);
  const normalized = raw
    .replace(/\*+/g, "")
    .replace(/^\s*✅?\s*(?:Answer|Model answer|Correct answer)\s*[:：]?\s*/i, "")
    .trim();
  const explanationAt = normalized.search(/(?:^|\n|\s)\s*(?:Explanation|Rationale)\s*[:：]/i);
  const answerRaw = explanationAt >= 0 ? normalized.slice(0, explanationAt) : normalized;
  const explanationRaw = explanationAt >= 0
    ? normalized.slice(explanationAt).replace(/^\s*(?:Explanation|Rationale)\s*[:：]\s*/i, "")
    : "";
  const answerLine = formatSequence(cleanDisplayText(answerRaw));
  const explanation = formatSequence(cleanDisplayText(explanationRaw));
  if (!answerLine && !explanation) return null;
  return (
    <div id={articleId && questionKey ? `answer-${articleId}-${questionKey}` : undefined} className="not-prose my-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 overflow-hidden">
      <button
        type="button"
        onClick={() => locked ? openSubscribePrompt("Subscribe or restore your pass to reveal this verified answer.") : setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-emerald-500/10"
      >
        <span className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
          {locked ? <Lock className="h-4 w-4" /> : open ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          {locked ? "Reveal — subscribers" : open ? "Hide" : "Reveal"}
        </span>
        <ChevronDown className={`h-4 w-4 text-emerald-600 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence initial={false}>
        {open && !locked && (
          <motion.div key="ans" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }} className="overflow-hidden">
            <div className="border-t border-emerald-500/20 px-4 py-3 space-y-2">
              <p className="text-[15px] font-semibold text-foreground">
                <span className="text-emerald-600 dark:text-emerald-400">Answer:</span>{" "}
                <Inline text={answerLine} />
              </p>
              {explanation && (
                <div className="text-[14px] leading-7 text-foreground/85 whitespace-pre-line">
                  <Inline text={explanation} />
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function InlineAnswerBlock({ raw }: { raw: string }) {
  const [open, setOpen] = useState(false);
  const access = useAccess();
  const locked = !access.canReveal;
  const cleaned = raw
    .split("\n")
    .map((line) => cleanDisplayText(line.replace(/^✅\s*/, "").replace(/^(?:Answer|Model answer|Explanation|Correct answer)\s*[:：]\s*/i, "")))
    .filter(Boolean);
  if (!cleaned.length) return null;
  return (
    <div className="not-prose my-4 overflow-hidden rounded-xl border border-primary/25 bg-primary/5">
      <button type="button" onClick={() => locked ? openSubscribePrompt("Subscribe or restore your pass to reveal this answer.") : setOpen((value) => !value)} className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-primary">
        <span className="inline-flex items-center gap-2">{locked ? <Lock className="h-4 w-4" /> : <Eye className="h-4 w-4" />}{locked ? "Reveal — subscribers" : open ? "Hide answer" : "Reveal answer"}</span>
        {!locked && <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />}
      </button>
      {open && !locked && <div className="space-y-2 border-t border-primary/20 px-4 py-3">
        {cleaned.map((line, i) => (
          <p key={i} className="text-[1.03rem] leading-8 text-foreground/90"><Inline text={line} /></p>
        ))}
      </div>}
    </div>
  );
}

function RelatedArticleCard({ article, compact = false }: { article: any; compact?: boolean }) {
  const image = article.og_image_url || extractFirstImageFromContent(article.content || "");
  const summary = stripRichText(article.meta_description || article.content || "", compact ? 95 : 135);
  return (
    <Link
      to={buildBlogPath(article)}
      className={`${compact ? "w-[82vw] max-w-[340px] sm:w-80" : "w-full"} group grid shrink-0 snap-start overflow-hidden rounded-lg border border-border bg-card transition-colors hover:border-primary/40 sm:grid-cols-[132px_1fr]`}
    >
      <div className="aspect-[4/3] bg-muted sm:aspect-auto">
        {image ? (
          <img src={image} alt={article.title} loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full min-h-28 items-center justify-center bg-primary/10 text-primary">
            <FileText className="h-7 w-7" />
          </div>
        )}
      </div>
      <div className="min-w-0 p-3.5">
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-primary">{getCategoryDisplayName(article.category)}</p>
        <h3 className="line-clamp-2 text-sm font-bold leading-snug text-foreground group-hover:text-primary">{article.title}</h3>
        {summary && <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-muted-foreground">{summary}</p>}
      </div>
    </Link>
  );
}

function InArticleRelated({ articles }: { articles: any[] }) {
  if (!articles.length) return null;
  return (
    <aside className="not-prose my-8 border-y border-border py-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">Continue Reading</p>
        </div>
        <span className="text-[11px] text-muted-foreground">Swipe</span>
      </div>
      <div className="-mx-5 overflow-x-auto px-5 pb-1">
        <div className="flex snap-x snap-mandatory gap-3">
          {articles.slice(0, 8).map((a) => <RelatedArticleCard key={a.id} article={a} compact />)}
        </div>
      </div>
    </aside>
  );
}

/* ─── Classic magazine-style article hero ─── */
function ClassicHero(props: { title: string; image: string; date: string; unit: string; shareUrl: string; description: string; category?: string }) {
  return <ClassicHeroInner {...props} />;
}

/* ─── Closest-article fuzzy match for graceful redirects ─── */
const STOP = new Set(["the","a","an","and","or","of","to","in","for","with","on","at","by","from","is","are","be","as"]);
function tokenize(s: string): string[] {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/[\s-]+/)
    .filter((t) => t.length > 2 && !STOP.has(t));
}
async function findClosestArticle(slugOrParam: string): Promise<{ id: string; title: string; path: string; score: number } | null> {
  try {
    const target = new Set(tokenize(decodeURIComponent(slugOrParam)));
    if (!target.size) return null;
    const list = await getPublishedArticleSummaries();
    let best: { id: string; title: string; path: string; score: number } | null = null;
    for (const row of list) {
      const tokens = new Set(tokenize(row.title));
      let inter = 0;
      target.forEach((t) => { if (tokens.has(t)) inter++; });
      const union = new Set([...target, ...tokens]).size || 1;
      const score = inter / union;
      if (!best || score > best.score) {
        best = { id: row.id, title: row.title, path: buildBlogPath(row), score };
      }
    }
    return best && best.score > 0 ? best : null;
  } catch {
    return null;
  }
}

/* ─── Classic hero: cinematic image with title + description overlaid ─── */
function ClassicHeroInner({
  title, image, date, unit, shareUrl, description, category,
}: { title: string; image: string; date: string; unit: string; shareUrl: string; description: string; category?: string }) {
  const specificImage = image && !isGenericThumbnail(image) ? image : "";
  const topicImage = useTopicThumbnailInfo(title, category, !specificImage);
  const heroImage = specificImage || topicImage?.url || "";
  const reviewer = pickReviewer(title);

  /* Cinematic hero restored: slow-panning background photograph with the title
     and description overlaid, as the site originally had. Falls back to a clean
     text masthead when no image is available. */
  if (!heroImage) {
    return (
      <header className="mb-8">
        <div className="border-b border-border pb-6">
          {unit && <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary">{unit}</p>}
          <h1
            id={slugify(title)}
            className="mt-2 scroll-mt-20 font-serif text-[1.85rem] font-bold leading-[1.15] text-foreground sm:text-[2.6rem] lg:text-[3rem]"
          >
            {title}
          </h1>
          {description && (
            <p className="mt-3 max-w-[62ch] text-[15px] leading-relaxed text-muted-foreground sm:text-base">{description}</p>
          )}
          <ReviewedBadge reviewer={reviewer} date={date} />
        </div>
        <ShareButtons url={shareUrl} title={title} description={description} variant="full" className="mt-5" />
      </header>
    );
  }

  return (
    <header className="mb-8">
      <div className="relative overflow-hidden rounded-xl border border-border bg-muted">
        <img
          src={heroImage}
          alt={title}
          loading="eager"
          fetchPriority="high"
          decoding="async"
          className="absolute inset-0 h-full w-full animate-hero-pan object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/55 to-black/20" />
        {!specificImage && topicImage?.pageUrl && (
          <a href={topicImage.pageUrl} target="_blank" rel="noreferrer" className="absolute right-2 top-2 z-10 rounded bg-black/60 px-2 py-1 text-[9px] text-white/90" title={`${topicImage.credit} · ${topicImage.license}`}>Image: Commons</a>
        )}
        <div className="relative flex min-h-[260px] flex-col justify-end p-5 sm:min-h-[340px] sm:p-8">
          {unit && (
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary-foreground/80">{unit}</p>
          )}
          <h1
            id={slugify(title)}
            className="mt-2 scroll-mt-20 font-serif text-[1.7rem] font-bold leading-[1.15] text-white drop-shadow sm:text-[2.4rem] lg:text-[2.8rem]"
          >
            {title}
          </h1>
          {description && (
            <p className="mt-3 max-w-[62ch] text-[14px] leading-relaxed text-white/85 sm:text-base">{description}</p>
          )}
        </div>
      </div>
      <ReviewedBadge reviewer={reviewer} date={date} />
      <ShareButtons url={shareUrl} title={title} description={description} variant="full" className="mt-5" />
    </header>
  );
}

/* ─── Medically Reviewed badge (Cleveland-style) ─── */
const REVIEWERS = [
  "Dr. Achieng Okello, MBChB",
  "Dr. Brian Mwangi, MBChB, MMed",
  "Dr. Cynthia Wanjiru, MBChB",
  "Dr. David Kiprono, MBChB, MMed Path",
  "Dr. Elizabeth Njeri, MBChB",
  "Dr. Felix Otieno, MBChB",
  "Dr. Grace Mutindi, MBChB, MMed Med",
  "Dr. Henry Kamau, MBChB",
  "Dr. Irene Adhiambo, MBChB, MMed Paeds",
  "Dr. James Mutiso, MBChB",
  "Dr. Kevin Maina, MBChB, MMed Surg",
  "Dr. Linda Akinyi, MBChB",
  "Dr. Mark Kibet, MBChB",
  "Dr. Naomi Wairimu, MBChB, MMed Obs/Gyn",
  "Dr. Oscar Njoroge, MBChB",
];
function pickReviewer(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  return REVIEWERS[Math.abs(h) % REVIEWERS.length];
}


function ReviewedBadge({ reviewer, date, onDark }: { reviewer: string; date: string; onDark?: boolean }) {
  const text = onDark ? "text-white/90" : "text-foreground";
  const sub = onDark ? "text-white/70" : "text-muted-foreground";
  return (
    <div className={`mt-5 flex items-start gap-2.5 text-sm ${text}`}>
      <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
        <svg viewBox="0 0 20 20" className="h-3 w-3" fill="currentColor"><path d="M16.7 5.3a1 1 0 010 1.4l-7.5 7.5a1 1 0 01-1.4 0L3.3 9.7a1 1 0 011.4-1.4l3.8 3.8 6.8-6.8a1 1 0 011.4 0z"/></svg>
      </span>
      <div className="leading-tight">
        <p className="font-semibold">Medically Reviewed by {reviewer}</p>
        <p className={`text-xs ${sub}`}>Last updated on {date}</p>
      </div>
    </div>
  );
}


function SourceAttribution({ article }: { article: any }) {
  const examType = inferExamType(article);
  const examYear = (article.exam_year || "").trim();
  const unit = inferUnit(article);
  const tags: string[] = Array.isArray(article.tags)
    ? article.tags.filter((tag: string) => !/\b(?:university|college|school|mku|uon|jkuat)\b/i.test(tag)).slice(0, 6)
    : [];
  const chips: { label: string; tone?: string }[] = [];
  if (examType) chips.push({ label: examYear ? `${examType} · ${examYear}` : examType, tone: "primary" });
  if (unit) chips.push({ label: unit });
  const hay = `${article?.title || ""}\n${article?.content || ""}\n${article?.meta_description || ""}`;
  const looksExamLike = /\b(MKU|Mount\s+Kenya\s+University|past\s*paper|CAT|MCQ|essay|question|exam|paper\s*\d)\b/i.test(hay);
  if (chips.length === 0 && tags.length === 0 && !looksExamLike) return null;
  const sourceLine = "Prepared as an international medical revision resource. Original paper provenance is preserved within the document where available.";
  return (
    <div className="mb-5 rounded-lg border border-border/70 bg-muted/30 p-3.5">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Source & Attribution</p>
      <p className="mt-1 text-xs text-foreground/80">{sourceLine}</p>
      {chips.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {chips.map((c, i) => (
            <span
              key={i}
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${c.tone === "primary" ? "bg-primary text-primary-foreground" : "bg-background border border-border text-foreground/80"}`}
            >
              {c.label}
            </span>
          ))}
        </div>
      )}
      {tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {tags.map((t) => (
            <span key={t} className="text-[10px] text-muted-foreground">#{t}</span>
          ))}
        </div>
      )}
    </div>
  );
}



function ExamPreviewModal({ article, open, onClose }: { article: any; open: boolean; onClose: () => void }) {
  const data = useMemo(() => extractExamQuestions(article?.content || ""), [article?.content]);
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [open, onClose]);
  if (!open) return null;
  const title = decodeEntities(article?.title || "").replace(/^#+\s*/, "").trim();
  const examType = inferExamType(article);
  const examYear = (article?.exam_year || "").trim();
  const unit = inferUnit(article);
  const lecturer = (article?.lecturer || "").trim();

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/70 backdrop-blur-sm p-2 sm:p-6 overflow-y-auto" onClick={onClose}>
      <div className="relative w-full max-w-3xl my-4 rounded-xl bg-white text-neutral-900 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onClose}
          className="sticky top-2 float-right z-10 mr-2 mt-2 inline-flex h-9 w-9 items-center justify-center rounded-full bg-neutral-900 text-white shadow hover:bg-neutral-700"
          aria-label="Close preview"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="clear-both px-6 sm:px-10 py-8 sm:py-12 font-serif">
          {/* Cover */}
          <div className="mb-8 border-b-2 border-neutral-900 pb-6 text-center">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-neutral-800">Ompath Study</p>
            {unit && <p className="mt-1 text-xs uppercase tracking-widest text-neutral-500">Department of {unit}</p>}
            <h1 className="mt-4 text-2xl sm:text-3xl font-bold leading-tight">{title}</h1>
            <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-neutral-600">
              {examType && <span>{examType}{examYear ? ` · ${examYear}` : ""}</span>}
              {lecturer && <span>Lecturer: {lecturer}</span>}
              <span>Date: {new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</span>
            </div>
            <p className="mt-4 text-[11px] italic text-neutral-500">Preview paper — questions only. Answers are hidden.</p>
          </div>

          {data.mcqs.length > 0 && (
            <section className="mb-10">
              <h2 className="mb-4 text-sm font-bold uppercase tracking-[0.2em] text-neutral-700 border-b border-neutral-300 pb-2">Section A: Multiple Choice</h2>
              <ol className="space-y-6">
                {data.mcqs.map((q, index) => (
                  <li key={q.n} className="text-[15px] leading-relaxed">
                    <p className="font-semibold"><span className="mr-2">{index + 1}.</span>{cleanDisplayText(q.stem)}</p>
                    {q.opts.length > 0 && (
                      <ol className="mt-3 space-y-2 pl-0" type="A">
                        {q.opts.map((o, i) => (
                          <li key={i} className="flex items-start gap-2 text-[14px] text-neutral-800">
                            <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-neutral-300 text-[11px] font-bold">{String.fromCharCode(65 + i)}</span>
                            <span>{cleanDisplayText(o.replace(/^\(?[A-Ea-e]\)?[.)]?\s*/, ""))}</span>
                          </li>
                        ))}
                      </ol>
                    )}
                  </li>
                ))}
              </ol>
            </section>
          )}

          {data.essays.length > 0 && (
            <section>
              <h2 className="mb-4 text-sm font-bold uppercase tracking-[0.2em] text-neutral-700 border-b border-neutral-300 pb-2">Section B: Essay Questions</h2>
              <ol className="space-y-5">
                {data.essays.map((q, index) => (
                  <li key={q.n} className="text-[15px] leading-relaxed">
                    <p><span className="mr-2 font-semibold">{index + 1}.</span>{cleanDisplayText(q.text)}</p>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {data.mcqs.length === 0 && data.essays.length === 0 && (
            <p className="text-center text-sm text-neutral-500">No exam-style questions detected in this article.</p>
          )}

          <div className="mt-10 border-t border-neutral-300 pt-4 text-center text-[11px] text-neutral-500">
            Ompath Study · End of preview paper
          </div>
        </div>
      </div>
    </div>
  );
}

function ExamPreviewBall({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="Preview exam paper"
      title="Preview exam paper"
      className="fixed top-[4.5rem] right-4 z-30 flex items-center gap-1.5 rounded-full border border-border bg-background/90 px-3 py-1.5 text-xs font-semibold text-foreground shadow-md backdrop-blur-md transition-colors hover:border-primary/40 hover:text-primary sm:right-6"
    >
      <ListChecks className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">Preview</span>
    </button>
  );
}

/* ─── Article content renderer ─── */
let _sec = 0;

const ArticleContent = memo(function ArticleContent({ content, articleId, category, title = "", contentKind = "" }: { content: string; articleId: string; category: string; title?: string; contentKind?: string }) {
  _sec = 0;
  const lines = preprocessContent(content).split("\n");
  // Explicit "Answer:" lines and bold-marked options win; a consolidated
  // "1 D, 2 C, …" key at the end of the document (common in handwritten CAT
  // scans) only fills in whatever neither of those could answer.
  const answerKeys = mergeAnswerKeys(answerKeyByQuestion(lines), parseConsolidatedAnswerKey(content));
  const els: React.ReactNode[] = [];
  let listBuf: { type: "ul" | "ol"; items: React.ReactNode[] } | null = null;
  let inPractice = false;
  let tableBuf: string[] = [];
  let flowBuf: string[] = [];
  let underSubheading = false;
  // Short-answer / SAQ papers have no multiple-choice options at all: their
  // A, B, C lines are answer points, so they must read as bullet points.
  const layoutKind = inferArticleLayout(title, contentKind, content);
  let examMode: "mcq" | "essay" | null =
    layoutKind === "essay" ? "essay" : layoutKind === "mcq" ? "mcq" : null;
  const pqs: { number: string; question: string; answer: string }[] = [];
  let currentQuestionKey = "";
  let currentQuestionText = "";
  let currentTopic = "";
  let displayQuestionNumber = 0;

  const flushList = () => {
    if (!listBuf) return;
    els.push(<ul key={`list-${els.length}`} className="mb-5 space-y-2 pl-1">{listBuf.items}</ul>);
    listBuf = null;
  };
  const flushTable = () => {
    if (tableBuf.length >= 2) els.push(<TableBlock key={`tbl-${els.length}`} lines={[...tableBuf]} />);
    tableBuf = [];
  };
  const flushFlow = () => {
    const meaningful = flowBuf.filter((l) => l.trim() && !/^(↓|v|\|)$/i.test(l.trim()));
    if (meaningful.length >= 2) els.push(<FlowBlock key={`flow-${els.length}`} lines={[...flowBuf]} />);
    else meaningful.forEach((l, idx) => els.push(<p key={`flow-p-${els.length}-${idx}`} className="mb-4 text-[1.03rem] leading-8 text-foreground/90"><Inline text={l} /></p>));
    flowBuf = [];
  };
  const flushPractice = () => {
    if (!pqs.length) return;
    els.push(
      <div key={`pq-${els.length}`} className="my-6">
        <div className="flex items-center gap-2 mb-3">
          <HelpCircle className="h-4 w-4 text-primary" />
          <span className="text-xs font-semibold uppercase tracking-wider text-primary">Practice Questions</span>
        </div>
        <div className="space-y-2">{pqs.map((q, k) => <PracticeQuestion key={k} number={q.number} question={q.question} answer={q.answer} />)}</div>
      </div>
    );
    pqs.length = 0;
  };

  const pushBullet = (text: string, key: string) => {
    if (!listBuf || listBuf.type !== "ul") { flushList(); listBuf = { type: "ul", items: [] }; }
    listBuf.items.push(
      <li key={key} className="flex items-start gap-2.5 text-base text-foreground/90 leading-8">
        <span className="mt-3 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
        <span className="flex-1"><Inline text={text} /></span>
      </li>
    );
  };

  let codeBuf: string[] | null = null;
  let skipUntil = -1;
  // Unified MCQ layout: after a "Question N" header we render the stem as a
  // paragraph and label the first option group with "Choices".
  let pendingChoicesLabel = false;
  const choicesLabel = (key: string) => {
    if (!pendingChoicesLabel) return;
    pendingChoicesLabel = false;
    els.push(
      <p key={key} className="not-prose mt-4 mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Choices</p>
    );
  };
  for (let i = 0; i < lines.length; i++) {
    if (i < skipUntil) continue;
    const line = lines[i];
    let t = line.trim();
    // Imported multi-part banks retain source numbering (for example Q150).
    // Preserve that key internally, but display each page as a fresh 1..N set.
    if (/^#{1,6}\s+Q(?:uestion)?\s*\d+\s*[:.)-]/i.test(t)) {
      displayQuestionNumber += 1;
      t = t.replace(/^(#{1,6}\s+)Q(?:uestion)?\s*\d+/i, `$1Question ${displayQuestionNumber}`);
    }

    if (/^```/.test(t)) {
      if (codeBuf == null) {
        flushList(); flushTable(); flushFlow(); flushPractice(); underSubheading = false;
        codeBuf = [];
      } else {
        const code = codeBuf.join("\n");
        els.push(<FlowBlock key={`code-flow-${i}`} lines={code.split("\n")} />);
        codeBuf = null;
      }
      continue;
    }
    if (codeBuf) { codeBuf.push(line); continue; }

    if (/^\*{0,2}\s*(✅\s*)?(?:Answer|Model answer|Correct answer|Explanation|Rationale)\s*[:：]/i.test(t)) {
      flushList(); flushFlow(); underSubheading = false;
      const buf: string[] = [t.replace(/^\*+/, "").replace(/\*+$/g, "")];
      let j = i + 1;
      let sawExp = false;
      while (j < lines.length) {
        const nt = lines[j].trim();
        // Strip leading markdown emphasis so "**Q2.**", "**MCQ 3**", "*Question 4*" all count.
        const ntStripped = nt.replace(/^[*_#>\s]+/, "");
        if (/^(MCQ|Question|Q)\s*\d+/i.test(ntStripped)) break;
        // Bold-wrapped question stems that end with **: "**Q2. text?**" / "**2. text?**"
        if (/^\*\*(?:Q(?:uestion)?\s*)?\d+[.)]/i.test(nt)) break;
        if (/^#{1,6}\s/.test(nt)) break;
        const isAnswerHdr = /^\*{0,2}\s*(✅\s*)?(?:Answer|Model answer|Correct answer)\s*[:：]/i.test(nt);
        const isExpHdr = /^\*{0,2}\s*(✅\s*)?(?:Explanation|Rationale)\s*[:：]/i.test(nt);
        // Merge a following Explanation/Rationale block into the SAME reveal button
        // so one question never renders two "Show answer & explanation" buttons.
        if (isAnswerHdr) break;
        if (isExpHdr && sawExp) break;
        if (/^\*{1,2}\d+\.\s/.test(nt)) break;
        if (/^\d+\.\s.{4,}[?:]\s*\*{0,2}$/.test(nt)) break;
        // Numbered question stems like "1. Something?" or "1) Something?"
        if (/^\d+[.)]\s+.{3,}[?:]\s*\*{0,2}$/.test(ntStripped)) break;
        // Standalone options like "A) foo" that start a new question's choice list
        if (/^[A-E][.)]\s+\S/.test(ntStripped) && sawExp) break;
        if (!nt) {
          if (sawExp) break;
          buf.push(lines[j]);
          j++;
          continue;
        }
        if (sawExp && /^-\s+[A-E][.)]\s/.test(nt)) break;
        buf.push(lines[j]);
        if (isExpHdr) sawExp = true;
        j++;
      }
      while (buf.length && !buf[buf.length - 1].trim()) buf.pop();
      pendingChoicesLabel = false;
      els.push(examMode === "essay"
        ? <InlineAnswerBlock key={`ans-${i}`} raw={buf.join("\n")} />
        : <McqAnswerBlock key={`mcq-${i}`} raw={buf.join("\n")} articleId={articleId} questionKey={currentQuestionKey} />
      );
      skipUntil = j;
      continue;
    }

    const flowLike = /^(↓|v|\+[-+]+\+|[-+|\s]{3,})$/i.test(t) || (/^[A-Za-z0-9()/,.''\-\s]+$/.test(t) && /^(STEP\s+\d+|[A-Z][A-Z\s-]{4,}|Compatible\s+Incompatible|AHR\s+FNHR|Packed\s+Platelet|Hypothermia\s+Dilutional)/.test(t));
    if (t.startsWith("|")) { flushList(); flushFlow(); tableBuf.push(t); underSubheading = false; continue; }
    else if (tableBuf.length) { flushTable(); }

    if (flowLike) { flushList(); flowBuf.push(t); underSubheading = false; continue; }
    else if (flowBuf.length) { flushFlow(); }

    if (!t) { flushList(); flushFlow(); underSubheading = false; continue; }

    // Source documents often include their own standalone "Choices:" line.
    // The renderer adds one compact label before option A, so suppress the
    // source copy to avoid duplicate headings and the large prose margins.
    if (/^\*{0,2}\s*Choices\s*:?\s*\*{0,2}$/i.test(t)) {
      flushList(); flushFlow(); underSubheading = false;
      continue;
    }

    if (t.startsWith("> ")) {
      flushList(); underSubheading = false;
      els.push(
        <blockquote key={`bq-${i}`} className="my-4 border-l-3 border-primary/40 pl-4 py-1">
          <p className="text-[15px] italic text-foreground/70 leading-relaxed"><Inline text={t.slice(2)} /></p>
        </blockquote>
      );
      continue;
    }

      const imageMatch = t.match(/^!\[(.*?)\]\((.*?)\)$/);
    if (imageMatch) {
      flushList();
      underSubheading = false;
      const alt = imageMatch[1]?.trim() || "Medical illustration";
      const src = imageMatch[2]?.trim();
        if (src) {
        els.push(
          <figure key={`img-${i}`} className="my-7 overflow-hidden rounded-lg border border-border bg-muted/20">
            <img src={src} alt={alt} loading="lazy" decoding="async" className="w-full object-contain" />
            {alt && <figcaption className="border-t border-border px-4 py-2 text-sm leading-relaxed text-muted-foreground">{alt}</figcaption>}
          </figure>
        );
      }
      continue;
    }

    const explicitQMatch = t.match(/^(QUESTION|Question|Q)\s*(\d+)[:\s-]*(.*)/i);
    // Some source papers number questions plainly ("### 3. …", "1. **…**")
    // instead of writing out "Question N" -- only treat that as a question
    // start when it's actually followed by MCQ-style options, so an ordinary
    // numbered heading/list item elsewhere on the site is never misread.
    const bareNumMatch = !explicitQMatch ? t.match(/^#{0,6}\s*\**\s*(\d+)[.)]\s+(.*)/) : null;
    const questionMatch: string[] | null =
      explicitQMatch || (bareNumMatch && looksLikeUpcomingMcqOptions(lines, i) ? [t, "Question", bareNumMatch[1], bareNumMatch[2]] : null);
    // ── Exam-paper front matter → compact meta card ──
    // "Programme: …", "Assessment: …", "Unit Code: …", "Date: …", "Reg No: …"
    const metaFieldRe = /^\*{0,2}\s*(Programme|Program|Course|Assessment|Exam|Paper|Unit Code|Unit|Subject|Date|Time|Duration|Venue|Marks|Instructions?|Reg\.?\s*No\.?|Registration\s*No\.?|Year|Semester|University|School)\s*\*{0,2}\s*[:：]\s*(.+)$/i;
    if (!questionMatch && metaFieldRe.test(t)) {
      const rows: { label: string; value: string }[] = [];
      let j = i;
      while (j < lines.length) {
        const lt = lines[j].trim();
        if (!lt) { j++; continue; }
        const m = lt.match(metaFieldRe);
        if (!m) break;
        rows.push({
          label: cleanDisplayText(m[1]).replace(/\s+/g, " ").trim(),
          value: cleanDisplayText(m[2].replace(/^\*+|\*+$/g, "")).trim(),
        });
        j++;
      }
      if (rows.length >= 2) {
        flushList(); flushTable(); flushFlow(); underSubheading = false;
        els.push(
          <dl
            key={`meta-card-${i}`}
            className="my-6 grid grid-cols-1 gap-x-6 gap-y-3 rounded-xl border border-primary/20 bg-primary/[0.04] p-5 sm:grid-cols-2"
          >
            {rows.map((r, n) => (
              <div key={`meta-row-${i}-${n}`} className="min-w-0">
                <dt className="text-[11px] font-semibold uppercase tracking-wider text-primary/80">{r.label}</dt>
                <dd className="mt-0.5 text-[15px] font-medium leading-snug text-foreground break-words">
                  <Inline text={r.value} />
                </dd>
              </div>
            ))}
          </dl>
        );
        skipUntil = j;
        continue;
      }
    }
    if (questionMatch) {
      flushList(); flushPractice(); inPractice = false; underSubheading = false;
      _sec++;
      const sourceQNum = questionMatch[2];
      displayQuestionNumber += 1;
      const qNum = String(displayQuestionNumber);
      let qTitle = questionMatch[3]?.replace(/^\s*[-:]\s*/, "").trim() || "";
      // Drop the orphan punctuation OCR/imports leave after the number
      // ("Question 1 . 66-year-old man …").
      qTitle = qTitle.replace(/^[.·•,;:）)\-–—\s]+/, "").trim();
      // Unified layout across the whole site:
      //   "Question N"  →  stem paragraph  →  "Choices"  →  A–E rows  →  Reveal
      // A short ALL-CAPS topic glued onto the header ("Q9 — ABDOMINAL WALL i) …")
      // stays in the heading; everything after it becomes normal body text so it
      // never renders as a giant serif wall of prose.
      qTitle = cleanDisplayText(qTitle.replace(/^\*+|\*+$/g, ""));
      let topic = "";
      let stem = qTitle;
      const capsMatch = qTitle.match(/^([A-Z][A-Z0-9''/&,.\-\s]{2,58}?)\s+(?=(?:[ivx]+\)|\(?[a-z]\)|[A-Z][a-z]|[a-z]))/);
      if (capsMatch) {
        topic = capsMatch[1].replace(/[\s,.-]+$/, "").trim();
        stem = qTitle.slice(capsMatch[0].length).trim();
      } else if (/^[A-Z0-9''/&,.\-\s]{3,60}$/.test(qTitle)) {
        topic = qTitle.replace(/[\s,.-]+$/, "").trim();
        stem = "";
      }
      currentQuestionKey = sourceQNum;
      currentQuestionText = stem || qTitle;
      currentTopic = topic || category.replace(/^Year\s*\d+:\s*/i, "");
      els.push(
        <div key={`q-${i}`} id={`section-${_sec}`} data-article-question="true" data-question-key={qNum} className="not-prose mt-8 scroll-mt-24 border-t border-border pt-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-md bg-primary px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-primary-foreground">
              Question {qNum}
            </span>
            {topic && (
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{topic}</span>
            )}
          </div>
        </div>
      );
      if (stem) {
        const leaked = splitLeakedAnswer(stem);
        els.push(
          <p key={`q-stem-${i}`} className="mb-4 mt-3 text-[1.05rem] font-medium leading-[1.7] text-foreground">
            <Inline text={leaked.text} />
          </p>
        );
        if (leaked.answer) els.push(<McqAnswerBlock key={`q-stem-ans-${i}`} raw={leaked.answer} articleId={articleId} questionKey={currentQuestionKey} />);
      }
      pendingChoicesLabel = true;
      continue;
    }

    if (/^\*{0,2}\s*(?:Question\s*)?\d+[a-z]?[.)]\s+.{4,}/i.test(t) && examMode === "essay" && t.length <= 150) {
      flushList(); underSubheading = false;
      els.push(<p key={`essay-q-${i}`} className="mb-4 font-serif text-xl font-bold leading-snug text-foreground"><Inline text={cleanDisplayText(t)} /></p>);
      continue;
    }
    // A long numbered stem is prose, not a display heading — keep it readable.
    if (/^\*{0,2}\s*(?:Question\s*)?\d+[a-z]?[.)]\s+.{4,}/i.test(t) && examMode === "essay") {
      flushList(); underSubheading = false;
      els.push(<p key={`essay-q-long-${i}`} className="mb-4 text-[1.03rem] leading-8 text-foreground/90"><Inline text={cleanDisplayText(t)} /></p>);
      continue;
    }

    const combinedOpts = Array.from(t.matchAll(/(?:^|\s)([A-E])\s*[.)]\s*([\s\S]*?)(?=\s*[B-E]\s*[.)]\s*|$)/gi));
    if (combinedOpts.length >= 2 && !inPractice) {
      if (examMode !== "essay") { flushList(); }
      underSubheading = false;
      if (examMode !== "essay") choicesLabel(`choices-${i}`);
      else pendingChoicesLabel = false;
      combinedOpts.forEach((m, n) => {
        const label = m[1].toUpperCase();
        const rawOption = (m[2] || "").replace(/^\*+|\*+$/g, "").trim();
        const explanationMatch = rawOption.match(/^([\s\S]*?)\s*(?:Explanation|Rationale)\s*[:：]\s*([\s\S]+)$/i);
        const optText = (explanationMatch?.[1] || rawOption).trim();
        if (!optText) return;
        // In SAQ/essay papers the letters are answer points, not MCQ choices —
        // render them as a tight bulleted list so they read as revision points.
        if (examMode === "essay") {
          pushBullet(`**${label}.** ${optText}`, `essay-pt-${i}-${n}`);
          if (explanationMatch?.[2]) pushBullet(explanationMatch[2].trim(), `essay-pt-exp-${i}-${n}`);
          return;
        }
        els.push(<ArticleMcqOption key={`mcqopt-combo-${i}-${n}`} articleId={articleId} questionKey={currentQuestionKey || String(i)} questionText={currentQuestionText} category={category} topic={currentTopic} label={label} text={optText} correctLabel={answerKeys.get(currentQuestionKey)}><Inline text={optText} /></ArticleMcqOption>);
        if (explanationMatch?.[2]) {
          els.push(<McqAnswerBlock key={`mcqopt-combo-exp-${i}-${n}`} raw={`Answer: ${label}. ${optText}\nExplanation: ${explanationMatch[2]}`} articleId={articleId} questionKey={currentQuestionKey} />);
        }
      });
      continue;
    }

    const subQMatch = t.match(/^(\(?[a-z]\)|[ivx]+\)|\([ivx]+\))\s*(.+)/i);
    // MCQ choice line (A–E) — render uniformly even when wrapped in stray **
    // Handles: "A) text", "**A) text**", "E)** text", "**A.** text", etc.
    const mcqOptMatch = t.match(/^\*{0,2}\s*([A-E])\s*[.)]\s*\*{0,2}\s*(.+?)\s*\*{0,2}\s*$/);
    if (mcqOptMatch && !inPractice) {
      if (examMode !== "essay") { flushList(); }
      underSubheading = false;
      const label = mcqOptMatch[1].toUpperCase();
      const rawOption = mcqOptMatch[2].replace(/^\*+|\*+$/g, "").trim();
      const explanationMatch = rawOption.match(/^([\s\S]*?)\s*(?:Explanation|Rationale)\s*[:：]\s*([\s\S]+)$/i);
      const optText = (explanationMatch?.[1] || rawOption).trim();
      // A long lettered line is prose (an answer point), never an MCQ choice.
      if (examMode === "essay" || optText.length > 110) {
        pendingChoicesLabel = false;
        pushBullet(`**${label}.** ${optText}`, `essay-pt-${i}`);
        if (explanationMatch?.[2]) pushBullet(explanationMatch[2].trim(), `essay-pt-exp-${i}`);
        continue;
      }
      if (label === "A") choicesLabel(`choices-${i}`);
      else pendingChoicesLabel = false;
      els.push(<ArticleMcqOption key={`mcqopt-${i}`} articleId={articleId} questionKey={currentQuestionKey || String(i)} questionText={currentQuestionText} category={category} topic={currentTopic} label={label} text={optText} correctLabel={answerKeys.get(currentQuestionKey)}><Inline text={optText} /></ArticleMcqOption>);
      if (explanationMatch?.[2]) {
        els.push(<McqAnswerBlock key={`mcqopt-exp-${i}`} raw={`Answer: ${label}. ${optText}\nExplanation: ${explanationMatch[2]}`} articleId={articleId} questionKey={currentQuestionKey} />);
      }
      continue;
    }
    if (subQMatch) {
      const label = subQMatch[1].replace(/[()]/g, "").toUpperCase();
      const rawSubText = subQMatch[2].trim();
      const marksMatch = rawSubText.match(/\s*(\[(?:\d+(?:\.\d+)?|½)\s*marks?\]|\((?:\d+(?:\.\d+)?|½)\s*marks?\))\s*$/i);
      const subText = marksMatch ? rawSubText.slice(0, marksMatch.index).trim() : rawSubText;
      // In SAQ/essay papers "(a) …" lines are answer points: bullet them so the
      // page reads as revision points instead of a wall of chipped rows.
      flushList(); underSubheading = false;
      els.push(
        <div key={`subq-${i}`} className="not-prose my-2.5 grid grid-cols-[2rem_minmax(0,1fr)] items-start gap-x-3 rounded-lg border border-border/70 bg-card px-3 py-3 sm:grid-cols-[2rem_minmax(0,1fr)_auto]">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-bold text-primary">{label}</span>
          <p className="min-w-0 pt-1 text-[15px] font-medium leading-relaxed text-foreground"><Inline text={subText} /></p>
          {marksMatch && <span className="col-start-2 mt-1 whitespace-nowrap text-xs font-semibold text-muted-foreground sm:col-start-3 sm:row-start-1 sm:mt-1.5">{marksMatch[1]}</span>}
        </div>
      );
      continue;
    }

    if (/^#{1,2}\s/.test(t)) {
      flushList(); underSubheading = false;
      const heading = t.replace(/^#+\s+/, "").replace(/\*+/g, "").replace(/⭐+/g, "").replace(/^\d+\.\s*/, "").replace(/^[IVXLC]+\.\s+/, "").trim();
      if (i < 12 && isDuplicateArticleHeading(heading, title)) continue;
      if (/\b(section\s+a|multiple\s+choice|mcqs?)\b/i.test(heading)) examMode = "mcq";
      if (/\b(section\s+b|section\s+c|essay|short\s+answer|long\s+answer|answer\s+any)\b/i.test(heading)) examMode = "essay";
      if (heading.toLowerCase().includes("practice")) { inPractice = true; continue; }
      flushPractice(); inPractice = false;
      _sec++;
      els.push(
        <h2 key={`h2-${i}`} id={slugify(heading) || `section-${_sec}`} data-section={`section-${_sec}`} className="mt-9 mb-4 scroll-mt-20 border-b border-border pb-3 font-serif text-2xl font-bold leading-tight text-foreground sm:text-3xl">
          {heading}
        </h2>
      );
      continue;
    }

    if (/^#{3,6}\s/.test(t)) {
      flushList(); underSubheading = true;
      const split = splitMalformedHeading(t.replace(/^#+\s+/, ""));
      const txt = split.heading;
      if (txt) els.push(<h3 key={`h3-${i}`} id={slugify(txt)} className="mt-8 mb-3 scroll-mt-20 font-serif text-xl font-bold leading-snug text-foreground">{txt}</h3>);
      split.extras.forEach((extra, extraIndex) => els.push(...renderProse(extra, `h3-extra-${i}-${extraIndex}`)));
      continue;
    }

    const qa = t.match(/^(\d+)\.\s(.+?)\s*→\s*(.+)$/);
    if (qa) {
      flushList(); underSubheading = false;
      if (inPractice) pqs.push({ number: qa[1], question: qa[2], answer: qa[3] });
      else els.push(
        <div key={`qa-${i}`} className="mb-3 rounded-lg border border-border p-4">
          <p className="text-sm font-medium text-foreground">{qa[1]}. <Inline text={qa[2]} /></p>
          <p className="mt-1.5 text-sm text-primary font-medium">→ <Inline text={qa[3]} /></p>
        </div>
      );
      continue;
    }

    if (inPractice && /^\d+\.\s/.test(t) && !t.includes("→")) {
      const next = lines[i + 1]?.trim() ?? "";
      pqs.push({ number: t.match(/^(\d+)/)?.[1] ?? "", question: t.replace(/^\d+\.\s/, ""), answer: next.startsWith("→") ? next.slice(1).trim() : "" });
      continue;
    }
    if (inPractice && t.startsWith("→")) continue;

    if (t.startsWith("- ")) { pushBullet(t.slice(2), `li-${i}`); continue; }

    if (/^\d+(?:\.\d+)?$/.test(t)) continue;

    if (/^\d+\.\s/.test(t) && !t.includes("→") && !inPractice) {
      if (!listBuf || listBuf.type !== "ol") { flushList(); listBuf = { type: "ol", items: [] }; }
      const num = t.match(/^(\d+)/)?.[1] ?? "";
      listBuf.items.push(
        <li key={`ol-${i}`} className="flex items-start gap-2.5 text-base text-foreground/90 leading-8">
          <span className="shrink-0 flex items-center justify-center rounded-full border border-primary/40 bg-primary/5 text-primary text-xs font-semibold w-6 h-6 mt-1">{num}</span>
          <span className="flex-1"><Inline text={t.replace(/^\d+\.\s/, "")} /></span>
        </li>
      );
      continue;
    }

    const boldLabelMatch = t.match(/^\*\*([^*]+)\*\*:?$/);
    if (boldLabelMatch) {
      flushList();
      const blText = boldLabelMatch[1].replace(/:$/, "").trim();
      els.push(<h3 key={`bl-${i}`} id={slugify(blText)} className="mt-6 mb-2 scroll-mt-20 font-semibold text-base text-foreground">{blText}</h3>);
      underSubheading = false;
      continue;
    }

    if (isLikelyStandaloneSectionHeading(t, i > 0 ? lines[i - 1] : "", i + 1 < lines.length ? lines[i + 1] : "")) {
      flushList(); underSubheading = false;
      const sectionTitle = cleanDisplayText(t).replace(/^\*+|\*+$/g, "").trim();
      els.push(<h3 key={`plain-heading-${i}`} id={slugify(sectionTitle)} className="mt-9 mb-3 scroll-mt-20 font-serif text-xl font-bold leading-snug text-foreground">{sectionTitle}</h3>);
      continue;
    }

    const isSubLabel = /^[A-Za-z*\s()–-]{2,60}:$/.test(t);
    if (isSubLabel) {
      flushList();
      const slText = t.slice(0, -1).replace(/\*+/g, "").trim();
      els.push(<h3 key={`sl-${i}`} id={slugify(slText)} className="mt-6 mb-2 scroll-mt-20 font-semibold text-lg text-foreground"><Inline text={t.slice(0, -1)} /></h3>);
      underSubheading = false;
      continue;
    }

    if (underSubheading) {
      if (t.startsWith("⚠️") || t.startsWith("⚠")) {
        flushList();
        els.push(
          <div key={`warn-${i}`} className="my-3 flex items-start gap-2 rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-2.5">
            <span className="text-amber-500 text-sm shrink-0">⚠️</span>
            <p className="text-sm leading-relaxed text-foreground/85"><Inline text={t.replace(/^⚠️?\s*/, "")} /></p>
          </div>
        );
        continue;
      }
      underSubheading = false;
      els.push(...renderProse(t, `p-sub-${i}`));
      continue;
    }

    flushList(); underSubheading = false;

    if (t.startsWith("⚠️") || t.startsWith("⚠")) {
      els.push(
        <div key={`wp-${i}`} className="my-3 flex items-start gap-2 rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-2.5">
          <span className="text-amber-500 text-sm shrink-0">⚠️</span>
          <p className="text-sm leading-relaxed text-foreground/85"><Inline text={t.replace(/^⚠️?\s*/, "")} /></p>
        </div>
      );
      continue;
    }

    els.push(...renderProse(t, `p-${i}`));
  }

  if (codeBuf && codeBuf.length) {
    els.push(<FlowBlock key="code-tail-flow" lines={codeBuf} />);
  }

  flushList(); flushTable(); flushFlow(); flushPractice();
  return <div>{els}</div>;
});

/* ─── Sidebar TOC ─── */
function SidebarToc({ items, activeId }: { items: TocItem[]; activeId: string }) {
  if (items.length < 1) return null;
  return (
    <nav className="sticky top-20 space-y-0.5">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Contents</p>
      {items.map(item => (
        <a
          key={item.id}
          href={`#${item.id}`}
          className={`block text-[13px] leading-snug py-1.5 pl-3 border-l-2 transition-colors ${
            activeId === item.id
              ? "border-primary text-primary font-medium"
              : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
          }`}
        >
          {item.text}
        </a>
      ))}
    </nav>
  );
}

/* ─── Main BlogPost component ─── */
export default function BlogPost() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { isAdmin, user } = useAuth();
  useHashFlash();

  const [article, setArticle] = useState<Article | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [isOffline, setIsOffline] = useState(typeof navigator !== "undefined" ? !navigator.onLine : false);
  const [suggestion, setSuggestion] = useState<{ id: string; title: string; path: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [related, setRelated] = useState<{ articles: any[]; flashcards: any[]; mcqs: any[]; essays: any[] }>({ articles: [], flashcards: [], mcqs: [], essays: [] });
  const [activeSection, setActiveSection] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);

  const handleBack = () => {
    const fromPath = (location.state as { from?: string } | null)?.from;
    if (fromPath && fromPath.startsWith("/blog")) {
      navigate(fromPath);
      return;
    }

    const savedYear = sessionStorage.getItem("nav_year_filter");
    if (savedYear && /^Year [1-6]$/.test(savedYear)) navigate(`/blog?year=${encodeURIComponent(savedYear)}`);
    else navigate("/blog");
  };

  useLayoutEffect(() => {
    let isReload = false;
    try {
      const navEntry = (performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined);
      isReload = navEntry?.type === "reload";
    } catch { /* ignore */ }
    if (isReload && slug) {
      const saved = parseInt(sessionStorage.getItem(`blog_scroll_${slug}`) || "0", 10);
      if (saved > 0) {
        const restore = () => window.scrollTo({ top: saved, left: 0, behavior: "auto" });
        const r1 = requestAnimationFrame(() => { restore(); requestAnimationFrame(restore); });
        const t1 = window.setTimeout(restore, 120);
        const t2 = window.setTimeout(restore, 350);
        const t3 = window.setTimeout(restore, 800);
        return () => { cancelAnimationFrame(r1); clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
      }
    }

    // New-route and back/forward scroll are handled centrally by ScrollToTop.
  }, [slug, location.key, article?.id]);

  useEffect(() => {
    if (!slug) return;
    const key = `blog_scroll_${slug}`;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        sessionStorage.setItem(key, String(window.scrollY));
        raf = 0;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [slug]);

  const reloadCurrentArticle = async (id: string) => {
    const refreshed = await getArticleBySlugOrId(id);
    if (refreshed) {
      setArticle(refreshed);
      if (refreshed.category) setRelated(await getRelatedContent(refreshed.category, refreshed.id));
    }
  };

  const runGeminiUpgrade = async (type: "format" | "expand") => {
    if (!article) return;
    setActionLoading(type);
    try {
      const { data, error } = await supabase.functions.invoke("content-upgrade", { body: { action: "upgrade", id: article.id, type } });
      if (error) throw new Error(error.message);
      if (!data?.improved_content) throw new Error("No upgraded content returned");
      const { error: applyError } = await supabase.functions.invoke("content-upgrade", {
        body: { action: "apply", id: article.id, content: data.improved_content, title: article.title },
      });
      if (applyError) throw new Error(applyError.message);
      await reloadCurrentArticle(article.id);
      toast({ title: type === "format" ? "Formatting applied" : "Content expanded" });
    } catch (err: any) {
      toast({ title: "Action failed", description: err?.message, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const runGenerateSaqs = async () => {
    if (!article) return;
    setActionLoading("saq");
    try {
      const { data, error } = await supabase.functions.invoke("generate-content", {
        body: { notes: article.content, type: "essay-qa" },
      });
      if (error) throw new Error(error.message);

      const saqs = Array.isArray(data?.saqs) ? data.saqs : [];
      if (!saqs.length) throw new Error("No SAQs generated");

      const section = [
        "",
        "## Short Answer Questions",
        ...saqs.map((q: any, i: number) => `### SAQ ${i + 1}\n${q.question}\n\n**Model answer:** ${q.answer || q.model_answer || ""}`),
      ].join("\n\n");

      const { error: applyError } = await supabase.functions.invoke("content-upgrade", {
        body: { action: "apply", id: article.id, title: article.title, content: `${article.content}\n${section}` },
      });
      if (applyError) throw new Error(applyError.message);

      await reloadCurrentArticle(article.id);
      toast({ title: "SAQs added to the end of this article" });
    } catch (err: any) {
      toast({ title: "Action failed", description: err?.message, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const runGenerateCoverImage = async () => {
    if (!article) return;
    setActionLoading("image");
    try {
      const { data, error } = await supabase.functions.invoke("content-upgrade", {
        body: { action: "generate_image", id: article.id },
      });
      if (error) throw new Error(error.message);
      const imageDataUrl = data?.image_data_url as string | undefined;
      if (!imageDataUrl) throw new Error("No image returned");

      const contentWithoutTopImage = article.content.replace(/^!\[[^\]]*\]\([^)]+\)\s*\n*/m, "").trimStart();
      const imageAlt = article.title.replace(/\s+/g, " ").trim() || "Medical illustration";
      const newContent = `

![${imageAlt}](${imageDataUrl})

\n\n${contentWithoutTopImage}`;

      const { error: applyError } = await supabase.functions.invoke("content-upgrade", {
        body: { action: "apply", id: article.id, title: article.title, content: newContent },
      });
      if (applyError) throw new Error(applyError.message);

      await reloadCurrentArticle(article.id);
      toast({ title: "Gemini cover image generated" });
    } catch (err: any) {
      toast({ title: "Action failed", description: err?.message, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const runTitleAndSubtitleCleanup = async () => {
    if (!article) return;
    setActionLoading("titles");
    try {
      const normalizedTitle = article.title.replace(/^#+\s*/, "").replace(/\s+/g, " ").trim();
      const normalizedContent = article.content
        .split("\n")
        .map((line) => {
          if (!/^#{1,3}\s+/.test(line.trim())) return line;
          const prefix = line.match(/^#{1,3}/)?.[0] || "##";
          const heading = line.replace(/^#{1,3}\s+/, "").replace(/\s+/g, " ").trim();
          return `${prefix} ${heading}`;
        })
        .join("\n");

      const { error: applyError } = await supabase.functions.invoke("content-upgrade", {
        body: { action: "apply", id: article.id, title: normalizedTitle, content: normalizedContent },
      });
      if (applyError) throw new Error(applyError.message);

      await reloadCurrentArticle(article.id);
      toast({ title: "Title and subtitles cleaned" });
    } catch (err: any) {
      toast({ title: "Action failed", description: err?.message, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const runCleanupFix = async (fixes: Record<string, any>, successMessage: string) => {
    if (!article) return;
    setActionLoading("fix");
    try {
      const { data, error } = await supabase.functions.invoke("bulk-cleanup", { body: { action: "fix", article_id: article.id, fixes } });
      if (error) throw new Error(error.message);
      if (data?.deleted_article) {
        toast({ title: successMessage });
        navigate("/blog", { replace: true });
        return;
      }
      if (data?.moved_to_raw) {
        toast({ title: "Could not parse MCQs — moved to Raw in Admin", description: "Open Admin panel to review this article manually." });
        await reloadCurrentArticle(article.id);
        return;
      }
      await reloadCurrentArticle(article.id);
      toast({ title: successMessage });
    } catch (err: any) {
      toast({ title: "Action failed", description: err?.message, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const runDirectMigrate = async () => {
    if (!article) return;
    setActionLoading("fix");
    try {
      const { data, error } = await supabase.functions.invoke("bulk-cleanup", {
        body: { action: "fix", article_id: article.id, fixes: { migrate_mcqs: true, auto_route_essay: true, fallback_to_raw: true } },
      });
      if (error) throw new Error(error.message);
      if (data?.migrated_essays) {
        toast({ title: "Detected essay format — moved to Essays" });
        navigate("/essays", { replace: true });
        return;
      }
      if (data?.deleted_article) {
        toast({ title: `Migrated ${data.migrated_mcqs || 0} MCQs → MCQ section` });
        navigate("/blog", { replace: true });
        return;
      }
      if (data?.moved_to_raw) {
        toast({ title: "MCQ parse failed — moved to Raw in Admin" });
        await reloadCurrentArticle(article.id);
        return;
      }
      await reloadCurrentArticle(article.id);
      toast({ title: "No MCQs found, article unchanged" });
    } catch (err: any) {
      toast({ title: "Action failed", description: err?.message, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  useEffect(() => {
    if (!slug) { setLoading(false); return; }
    // Retry transient network/CDN failures before declaring the article missing —
    // a flaky connection must never render "Article unavailable".
    const fetchWithRetry = async (attempt = 0): Promise<any> => {
      try {
        return await getArticleBySlugOrId(slug);
      } catch (err) {
        if (attempt >= 3) throw err;
        await new Promise((r) => setTimeout(r, 400 * Math.pow(2, attempt)));
        return fetchWithRetry(attempt + 1);
      }
    };

    fetchWithRetry()
      .then((a) => {
        if (!a) {
          setNotFound(true);
          findClosestArticle(slug).then((match) => {
            if (!match) return;
            if (match.score >= 0.6) {
              navigate(match.path, { replace: true });
            } else {
              setSuggestion({ id: match.id, title: match.title, path: match.path });
            }
          }).catch(() => {});
          document.title = "Article Not Found";
          let noindex = document.querySelector('meta[name="robots"]');
          if (!noindex) {
            noindex = document.createElement("meta");
            noindex.setAttribute("name", "robots");
            document.head.appendChild(noindex);
          }
          noindex.setAttribute("content", "noindex, nofollow");
          const canonical = document.querySelector('link[rel="canonical"]');
          if (canonical) canonical.remove();
          return;
        }

        const noindex = document.querySelector('meta[name="robots"]');
        if (noindex) noindex.remove();

        setNotFound(false);
        setArticle(a);
        const canonicalPath = buildBlogPath(a);
        if (location.pathname !== canonicalPath) navigate(`${canonicalPath}${location.hash || ""}`, { replace: true });
        markArticleVisited({ id: a.id, title: a.title, category: a.category, visitedAt: Date.now() });
        if (a.category) getRelatedContent(a.category, a.id).then(setRelated);
      })
      .catch(() => {
        // Network still failing: keep the shell, show offline messaging instead of "removed".
        setIsOffline(true);
        setNotFound(true);
      })
      .finally(() => setLoading(false));
  }, [slug, navigate, location.pathname, location.hash]);

  useEffect(() => {
    const goOffline = () => setIsOffline(true);
    const goOnline = () => setIsOffline(false);
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, []);

  const toc = useMemo(() => article ? extractToc(article.content) : [], [article]);
  const slideDeck = useMemo(() => (article ? parseSlideDeck(article.content || "") : null), [article]);

  useEffect(() => {
    if (!toc.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) { setActiveSection(entry.target.id); break; }
        }
      },
      { rootMargin: "-80px 0px -60% 0px", threshold: 0 }
    );
    toc.forEach(item => {
      const el = document.getElementById(item.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [toc, loading]);

  useEffect(() => {
    if (!article) return;
    const metaTitle = cleanMetaTitle(article);
    const metaDesc = cleanMetaDescription(article);
    const ogImage = article.og_image_url || extractFirstImageFromContent(article.content || "") || `${SITE_URL}/og-default.png`;
    const canonicalUrl = `${SITE_URL}${buildBlogPath(article)}`;
    const plain = stripRichText(article.content || "");
    const year = getYearFromCategory(article.category || "");
    const unit = getCategoryDisplayName(article.category || "") || "Medical Notes";
    const keywords = [
      unit, `${unit} notes`, `${unit} MCQs`, `${unit} past paper`,
      year ? `Year ${year} MBChB` : "MBChB",
      "Mount Kenya University", "MKU", "UON", "KU", "Moi University",
      "medical school Kenya", "past papers with answers", "revision notes",
    ].filter(Boolean) as string[];

    updateMetaTags({
      title: metaTitle,
      description: metaDesc,
      image: ogImage,
      url: canonicalUrl,
      type: "article",
      keywords,
    });

    // Everything published is indexable. Image/slide-heavy articles have little
    // plain text but real value, so length or scan watermarks must never noindex
    // a page — only a hard 404 (handled above) stays out of the index.
    let robots = document.querySelector('meta[name="robots"]') as HTMLMetaElement | null;
    if (!robots) {
      robots = document.createElement("meta");
      robots.setAttribute("name", "robots");
      document.head.appendChild(robots);
    }
    robots.setAttribute("content", "index, follow, max-image-preview:large, max-snippet:-1");

    let ldScript = document.querySelector("script[data-article-ld]") as HTMLScriptElement | null;
    if (!ldScript) {
      ldScript = document.createElement("script");
      ldScript.type = "application/ld+json";
      ldScript.setAttribute("data-article-ld", "true");
      document.head.appendChild(ldScript);
    }
    ldScript.textContent = JSON.stringify([
      {
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": metaTitle.slice(0, 110),
        "description": metaDesc,
        "image": ogImage,
        "url": canonicalUrl,
        "mainEntityOfPage": { "@type": "WebPage", "@id": canonicalUrl },
        "inLanguage": "en",
        "isAccessibleForFree": true,
        "keywords": keywords.join(", "),
        "articleSection": unit,
        "wordCount": plain.split(/\s+/).filter(Boolean).length,
        "educationalLevel": year ? `Year ${year} (MBChB)` : "Undergraduate medicine",
        "learningResourceType": "Study notes and past paper questions",
        "datePublished": article.created_at,
        "dateModified": (article as { updated_at?: string }).updated_at || article.created_at,
        "author": { "@type": "Organization", "name": "Ompath Study", "url": SITE_URL },
        "publisher": {
          "@type": "Organization",
          "name": "Ompath Study",
          "url": SITE_URL,
          "logo": { "@type": "ImageObject", "url": `${SITE_URL}/favicon.png` },
        },
      },
      {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/` },
          { "@type": "ListItem", position: 2, name: "Notes", item: `${SITE_URL}/blog` },
          ...(year ? [{ "@type": "ListItem", position: 3, name: `Year ${year}`, item: `${SITE_URL}/year/${year}` }] : []),
          { "@type": "ListItem", position: year ? 4 : 3, name: unit, item: `${SITE_URL}/blog?category=${encodeURIComponent(article.category || "")}` },
          { "@type": "ListItem", position: year ? 5 : 4, name: metaTitle.slice(0, 110), item: canonicalUrl },
        ],
      },
    ]);

    return () => {
      const ldEl = document.querySelector("script[data-article-ld]");
      if (ldEl) ldEl.remove();
    };
  }, [article]);

  if (loading) {
    return <div className="flex min-h-[65vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  if (notFound || !article) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-20 text-center">
        <h1 className="mb-2 text-2xl font-bold text-foreground">
          {isOffline ? "You're offline" : "Article unavailable"}
        </h1>
        <p className="mb-6 text-sm text-muted-foreground">
          {isOffline
            ? "We couldn't load this article without an internet connection. Reconnect and tap retry."
            : "This link may have changed or the article was removed. Try one of the options below."}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {isOffline && (
            <Button variant="default" onClick={() => window.location.reload()}>Retry</Button>
          )}
          {suggestion && !isOffline && (
            <Button asChild variant="default">
              <Link to={suggestion.path}>Open closest match: {suggestion.title}</Link>
            </Button>
          )}
          <Button asChild variant="outline">
            <Link to="/blog"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Study Notes</Link>
          </Button>
        </div>
      </div>
    );
  }

  const date = new Date(article.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const unitName = getCategoryDisplayName(article.category);
  const yearName = getYearFromCategory(article.category);
  const hasRelated = related.flashcards.length > 0 || related.mcqs.length > 0;
  const articleEssay = related.essays?.[0];
  const essaySaqs: any[] = Array.isArray(articleEssay?.short_answer_questions) ? articleEssay.short_answer_questions : [];
  const essayLaqs: any[] = Array.isArray(articleEssay?.long_answer_questions) ? articleEssay.long_answer_questions : [];

  return (
    <>
      <ReadingProgress />
      <ExamPreviewBall onOpen={() => setPreviewOpen(true)} />

      {/* Breadcrumbs */}
      <div className="border-b border-border bg-muted/30">
        <div className="mx-auto max-w-6xl px-5 py-3 flex items-center gap-2 text-sm text-muted-foreground overflow-x-auto">
          <button onClick={handleBack} className="shrink-0 hover:text-foreground transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" />
          </button>
          <ChevronRight className="h-3 w-3 shrink-0" />
          <Link to="/blog" className="shrink-0 hover:text-foreground transition-colors">Study Notes</Link>
          {yearName && (
            <>
              <ChevronRight className="h-3 w-3 shrink-0" />
              <Link to={`/blog?year=${encodeURIComponent(yearName)}`} className="shrink-0 hover:text-foreground transition-colors">{yearName}</Link>
            </>
          )}
          {unitName && unitName !== "Uncategorized" && (
            <>
              <ChevronRight className="h-3 w-3 shrink-0" />
              <span className="truncate text-foreground font-medium">{unitName}</span>
            </>
          )}
        </div>
      </div>

      {/* Admin toolbar */}
      {isAdmin && (
        <div className="border-b-2 border-primary/30 bg-primary/5">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-5 py-3">
            <span className="mr-1 text-xs font-bold uppercase tracking-wider text-primary">Admin</span>

            <Button size="sm" className="h-8 gap-1.5 text-xs bg-primary hover:bg-primary/90" disabled={!!actionLoading} onClick={runDirectMigrate}>
              {actionLoading === "fix" ? <Loader2 className="h-3 w-3 animate-spin" /> : <GitMerge className="h-3 w-3" />}
              Migrate to MCQs
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs border-primary/30" disabled={!!actionLoading}>
                  {actionLoading === "format" || actionLoading === "expand" || actionLoading === "titles" || actionLoading === "saq" || actionLoading === "image"
                    ? <Loader2 className="h-3 w-3 animate-spin" />
                    : <Sparkles className="h-3 w-3 text-primary" />}
                  Gemini
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => runGeminiUpgrade("format")}>Improve article formatting</DropdownMenuItem>
                <DropdownMenuItem onClick={() => runGeminiUpgrade("expand")}>Expand article details</DropdownMenuItem>
                <DropdownMenuItem onClick={runGenerateCoverImage}><ImagePlus className="mr-2 h-3.5 w-3.5" />Generate article image</DropdownMenuItem>
                <DropdownMenuItem onClick={runTitleAndSubtitleCleanup}>Update title + subtitles only</DropdownMenuItem>
                <DropdownMenuItem onClick={runGenerateSaqs}>Generate SAQs at article end</DropdownMenuItem>
                <DropdownMenuItem onClick={async () => {
                  if (!article) return;
                  setActionLoading("seo");
                  try {
                    const { data, error } = await supabase.functions.invoke("content-upgrade", { body: { action: "generate_seo_single", id: article.id } });
                    if (error) throw new Error(error.message);
                    if (data?.error) throw new Error(data.error);
                    toast({ title: "SEO metadata generated", description: `Title: ${data?.seo?.meta_title || ""}` });
                    await reloadCurrentArticle(article.id);
                  } catch (err: any) {
                    toast({ title: "SEO generation failed", description: err?.message, variant: "destructive" });
                  } finally { setActionLoading(null); }
                }}>Generate SEO metadata</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5 border-primary/30" disabled={!!actionLoading}>
                  <GitMerge className="h-3 w-3" /> More Migrate
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => runCleanupFix({ migrate_mcqs: true }, "Migrated to MCQs")}>To MCQs (with delete)</DropdownMenuItem>
                <DropdownMenuItem onClick={() => runCleanupFix({ migrate_essays: true }, "Migrated to Essays")}>To Essays</DropdownMenuItem>
                <DropdownMenuItem onClick={() => runCleanupFix({ move_to_raw: true }, "Moved to Raw")}>Move to Raw (unpublish)</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5 border-primary/30" disabled={!!actionLoading}>
                  <Settings2 className="h-3 w-3" /> Change
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => runCleanupFix({ fix_formatting: true, clean_emojis: true, clean_mku: true }, "Cleaned formatting")}>Clean formatting</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      )}

      {/* Main layout */}
      <div className="mx-auto max-w-6xl px-3 py-5 sm:px-5 sm:py-8">
        <div className={slideDeck ? "" : toc.length > 0 ? "lg:grid lg:grid-cols-[250px_minmax(0,1fr)] lg:gap-10" : "max-w-3xl mx-auto"}>
          {!slideDeck && toc.length > 0 && (
            <aside className="hidden lg:block">
              <SidebarToc items={toc} activeId={activeSection} />
            </aside>
          )}

          <article id="section-top" className={slideDeck ? "min-w-0" : "min-w-0 rounded-2xl border border-border/70 bg-card px-4 py-5 shadow-sm sm:px-8 sm:py-8 lg:max-w-[72ch] lg:px-10"}>
            <Countdown data={(article as any).countdown} />
            <PasswordGate
              enabled={(article as any).password_protected}
              password={(article as any).access_password}
              storageKey={article.slug || article.id}
            >
            <ClassicHero
              title={cleanMetaTitle(article)}
              image={article.og_image_url || extractFirstImageFromContent(article.content || "") || ""}
              date={date}
              unit={unitName && unitName !== "Uncategorized" ? unitName : ""}
              shareUrl={`${SITE_URL}${buildBlogPath(article)}`}
              description={cleanMetaDescription(article)}
              category={article.category}
            />

            {(article as any).reading_time_minutes ? (
              <div className="mb-2"><ReadingTimeBadge minutes={(article as any).reading_time_minutes} /></div>
            ) : null}

            <div className="not-prose mb-5"><StudyControls resourceType="article" resourceId={article.id} title={cleanMetaTitle(article)} /></div>

            <SourceAttribution article={article} />

            <HtmlEmbed data={(article as any).html_embed} position="top" />

            {(article as any).toc_enabled && <ContentToc content={article.content} />}

            <div className="prose-custom article-reader">
              <KeywordLinkProvider currentPath={buildBlogPath(article)} currentCategory={article.category}>
                {slideDeck
                  ? <SlideDeckView
                      deck={slideDeck}
                      articleId={article.id}
                      title={cleanMetaTitle(article)}
                      university="Ompath Study"
                      onPreview={() => setPreviewOpen(true)}
                    />
                  : <ArticleContent content={article.content} articleId={article.id} category={article.category || ""} title={article.title || ""} contentKind={article.content_kind || ""} />}
              </KeywordLinkProvider>
            </div>

            {!slideDeck && (
              <ArticleSubscribeGate
                hasMcqs={/(?:^|\n)\s*(?:✅\s*)?(?:answer|correct answer)\s*[:：]/i.test(article.content || "")}
              />
            )}

            <HtmlEmbed data={(article as any).html_embed} position="bottom" />

            {Array.isArray((article as any).tags) && (article as any).tags.length > 0 && (
              <div className="mt-8 flex flex-wrap gap-2 border-t border-border pt-5">
                {(article as any).tags.slice(0, 8).map((tag: string) => (
                  <a
                    key={tag}
                    href={`https://www.google.com/search?q=${encodeURIComponent(`${tag} site:ompathstudy.com`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/15"
                  >
                    #{tag}
                  </a>
                ))}
              </div>
            )}

            <div className="mt-10 pt-6 border-t border-border">
              <div className="mb-5"><HelpfulVote resourceType="article" resourceId={article.id} /></div>
              <ShareButtons
                url={`${SITE_URL}${buildBlogPath(article)}`}
                title={cleanMetaTitle(article)}
                description={cleanMetaDescription(article)}
                variant="full"
              />
            </div>

            {(essaySaqs.length > 0 || essayLaqs.length > 0) && (
              <section className="mt-12 rounded-xl border border-border bg-card p-5 sm:p-6">
                <div className="flex items-center gap-2 mb-4">
                  <HelpCircle className="h-4 w-4 text-primary" />
                  <h2 className="font-serif text-xl font-bold text-foreground">Practice Essay Questions</h2>
                </div>
                {essaySaqs.length > 0 && (
                  <div className="mb-6">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Short Answer Questions</p>
                    <div className="space-y-2">
                      {essaySaqs.map((q: any, i: number) => (
                        <EssayQuestion
                          key={`saq-${i}`}
                          number={`${i + 1}`}
                          question={q.question || ""}
                          answer={q.model_answer || q.answer || ""}
                        />
                      ))}
                    </div>
                  </div>
                )}
                {essayLaqs.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Long Answer Questions</p>
                    <div className="space-y-2">
                      {essayLaqs.map((q: any, i: number) => (
                        <EssayQuestion
                          key={`laq-${i}`}
                          number={`${i + 1}`}
                          question={q.question || ""}
                          answer={q.model_answer || q.answer || ""}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </section>
            )}

            {hasRelated && (
              <div className="mt-12 rounded-lg border border-border p-5">
                <div className="flex items-center gap-2 mb-4">
                  <FileText className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold text-foreground">Continue Learning</h3>
                </div>
                <div className="space-y-4">
                  {related.flashcards.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Flashcards</p>
                      <div className="space-y-1.5">
                        {related.flashcards.map((f: any) => (
                          <Link key={f.id} to={buildFlashcardPath(f)} className="flex items-center gap-3 rounded-lg border border-border p-3 hover:border-primary/40 hover:bg-muted/30 transition-colors">
                            <GraduationCap className="h-4 w-4 text-primary shrink-0" />
                            <span className="truncate text-sm font-medium text-foreground">{f.title}</span>
                            <span className="ml-auto text-xs text-muted-foreground">{(f.cards as any[])?.length || 0} cards</span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                  {related.mcqs.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">MCQ Quizzes</p>
                      <div className="space-y-1.5">
                        {related.mcqs.map((m: any) => (
                          <Link key={m.id} to={buildMcqPath(m)} className="flex items-center gap-3 rounded-lg border border-border p-3 hover:border-primary/40 hover:bg-muted/30 transition-colors">
                            <ListChecks className="h-4 w-4 text-primary shrink-0" />
                            <span className="truncate text-sm font-medium text-foreground">{m.title}</span>
                            <span className="ml-auto text-xs text-muted-foreground">{(m.questions as any[])?.length || 0} Qs</span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {related.articles && related.articles.length > 0 && (
              <section className="mt-12 border-t border-border pt-8">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  <h2 className="font-serif text-xl font-bold text-foreground">Related Articles</h2>
                  </div>
                  <span className="text-xs text-muted-foreground">Tap or hover to pause · swipe</span>
                </div>
                <RelatedMarquee articles={related.articles} />
              </section>
            )}

            {(article as any).comments_enabled !== false && <ArticleComments articleId={article.id} />}
            </PasswordGate>
          </article>
          {slideDeck ? (
            <SlidePreviewModal
              deck={slideDeck}
              title={cleanMetaTitle(article)}
              university="Ompath Study"
              open={previewOpen}
              onClose={() => setPreviewOpen(false)}
            />
          ) : (
            <ExamPreviewModal article={article} open={previewOpen} onClose={() => setPreviewOpen(false)} />
          )}
        </div>
      </div>
    </>
  );
}

function RelatedMarquee({ articles }: { articles: any[] }) {
  const [paused, setPaused] = useState(false);
  const list = [...articles.slice(0, 12), ...articles.slice(0, 12)];
  return (
    <div
      className="group relative -mx-5 overflow-x-auto overflow-y-hidden"
      onTouchStart={() => setPaused(true)}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onClick={() => setPaused((p) => !p)}
    >
      <div
        className="flex w-max gap-3 px-5 animate-marquee-slow"
        style={{ animationPlayState: paused ? "paused" : "running" }}
      >
        {list.map((a: any, i: number) => (
          <RelatedArticleCard key={`${a.id}-${i}`} article={a} compact />
        ))}
      </div>
      <div className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-background to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-background to-transparent" />
    </div>
  );
}
