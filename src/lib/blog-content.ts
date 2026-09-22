import { getCategoryDisplayName, type Article } from "@/lib/store";
import { stripRichText } from "@/lib/seo";
import { slugify } from "@/lib/deep-link";

/**
 * Pure text/data helpers extracted from BlogPost.tsx: OCR/markdown cleanup,
 * MCQ/essay extraction, table-of-contents building, and article-metadata
 * inference. None of this touches React or JSX, so it is unit-testable and
 * safely shareable without pulling in the page's rendering code.
 */

/** Pull a leaked inline answer — e.g. "(repeat — Answer: b, inverse stretch reflex)"
 *  — out of a question stem so it renders behind a Reveal button instead. */
export function splitLeakedAnswer(text: string): { text: string; answer: string } {
  const m = text.match(/[（(]\s*(?:repeat\s*[—–-]\s*)?(?:Ans(?:wer)?|Correct answer)\s*[:：]?\s*([^)）]+)[)）]\s*$/i);
  if (!m) return { text: text.trim(), answer: "" };
  return { text: text.slice(0, m.index).trim().replace(/[,;:—–-]+$/, "").trim(), answer: m[1].trim() };
}

export function cleanMetaTitle(article: Article): string {
  const rawSrc = (article.title?.trim() || article.meta_title?.trim() || "Study Notes");
  const raw = decodeEntities(rawSrc).replace(/^#+\s*/, "").replace(/\s+/g, " ").trim();
  return raw.length <= 60 ? raw : `${raw.slice(0, 57).trimEnd()}...`;
}

export function cleanMetaDescription(article: Article): string {
  const title = decodeEntities(stripRichText(article.title || "")).replace(/\s+/g, " ").trim();
  let provided = decodeEntities(stripRichText(article.meta_description || "", 170)).replace(/\s*[-–—]{2,}\s*/g, " — ").trim();
  if (title && provided.toLowerCase().startsWith(title.toLowerCase())) {
    provided = provided.slice(title.length).replace(/^\s*[|:;,.–—-]+\s*/, "").trim();
  }
  const cat = article.category ? article.category.replace(/^Year\s*\d+:\s*/i, "").trim() : "";
  // Strip markdown scaffolding so a hero blurb never shows "### SECTION A: …"
  const body = (article.content || "")
    .replace(/^\s*#{1,6}\s*/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*>\s?/gm, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\*\*?/g, "")
    .replace(/^\s*(?:SECTION\s+[A-C]\b.*|MULTIPLE\s+CHOICE.*)$/gim, " ");
  const fallback = stripRichText(body, 155)
    || `${article.title} study notes${cat ? ` on ${cat}` : ""} with clinical points and exam-focused revision for medical students.`;
  const desc = provided.length >= 50 ? provided : fallback;
  const enriched = /\b(Kenya|Africa|MBChB|medical students)\b/i.test(desc)
    ? desc
    : `${desc.replace(/[.\s]+$/, "")}. For MBChB and health students in Kenya and beyond.`;
  return enriched.length <= 155 ? enriched : `${enriched.slice(0, 152).trimEnd()}...`;
}

/**
 * These inference helpers run against whatever article-like object the
 * caller has on hand -- a full `Article` row, a related-content summary, or
 * an exam-preview stub -- so every field is read defensively as optional.
 */
export interface ArticleLike {
  title?: string | null;
  content?: string | null;
  meta_description?: string | null;
  category?: string | null;
  university?: string | null;
  school?: string | null;
  exam_type?: string | null;
  unit?: string | null;
}

export function articleHaystack(article: ArticleLike): string {
  return `${article?.title || ""}\n${article?.content || ""}\n${article?.meta_description || ""}\n${article?.category || ""}`;
}

export function inferUniversity(article: ArticleLike): string {
  const explicit = (article?.university || "").trim();
  if (explicit) return explicit;
  const hay = articleHaystack(article);
  if (/\b(MKU|Mount\s+Kenya\s+University)\b/i.test(hay)) return "Mount Kenya University (MKU)";
  if (/\b(UoN|University\s+of\s+Nairobi)\b/i.test(hay)) return "University of Nairobi (UoN)";
  if (/\b(KU|Kenyatta\s+University)\b/i.test(hay)) return "Kenyatta University (KU)";
  if (/\bJKUAT\b|Jomo\s+Kenyatta\s+University/i.test(hay)) return "JKUAT";
  if (/\bMoi\s+University\b/i.test(hay)) return "Moi University";
  return "Mount Kenya University (MKU)";
}

export function inferSchool(article: ArticleLike): string {
  const explicit = (article?.school || "").trim();
  if (explicit) return explicit;
  const hay = articleHaystack(article);
  const match = hay.match(/\b(School\s+of\s+(?:Medicine|Health\s+Sciences|Clinical\s+Medicine|Nursing))\b/i);
  return match ? match[1].replace(/\s+/g, " ").trim() : "School of Medicine";
}

export function inferExamType(article: ArticleLike): string {
  const explicit = (article?.exam_type || "").trim();
  if (explicit) return explicit;
  const hay = articleHaystack(article);
  if (/\bCAT\b|continuous\s+assessment/i.test(hay)) return "CAT";
  if (/\bMCQs?\b|multiple\s+choice/i.test(hay)) return "MCQ Paper";
  if (/\bessay\s+questions?|SAQ|short\s+answer|long\s+answer/i.test(hay)) return "Essay Paper";
  if (/\bpaper\s*[12]\b|exam/i.test(hay)) return "Exam Paper";
  return "";
}

export function inferUnit(article: ArticleLike): string {
  const explicit = (article?.unit || "").trim();
  if (explicit) return explicit;
  const category = getCategoryDisplayName(article?.category || "");
  const title = String(article?.title || "");
  if (/bacteriology/i.test(title)) return "Bacteriology";
  if (/pathology/i.test(title) && !/general pathology/i.test(category)) return "Pathology";
  if (category && category !== "Uncategorized") return category;
  return "Medicine";
}

/* ─── Exam Preview: questions-only PDF-style modal ─── */
export type PreviewMcq = { n: string; stem: string; opts: string[] };
export type PreviewEssay = { n: string; text: string };

export type ArticleLayoutKind = "visual" | "mcq" | "essay" | "mixed" | "article";

/** Canonical renderer decision shared by legacy imports and new content. */
export function inferArticleLayout(title = "", contentKind = "", content = ""): ArticleLayoutKind {
  const labels = `${title}\n${contentKind}`;
  const all = `${labels}\n${content}`;
  if (/aponeurosis|image[ -]?(?:spot|bank)|spot[ -]?(?:exam|bank|atlas)|visual[ -]?bank/i.test(all)) return "visual";
  const essay = /\bSAQs?\b|\bLAQs?\b|short[- ]answer|long[- ]answer|essay|written[- ]question/i.test(all);
  const mcq = /\bMCQs?\b|multiple[- ]choice|quiz/i.test(labels) || /(?:^|\n)\s*[A-E][.)]\s+\S/im.test(content);
  if (essay && mcq) return "mixed";
  if (essay) return "essay";
  if (mcq) return "mcq";
  return "article";
}

export function cleanDisplayText(value: string): string {
  return decodeEntities(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/^[-•]\s+/, "")
    .replace(/^#{1,6}\s*/, "")
    .replace(/\*+/g, "")
    .replace(/_+/g, "")
    .replace(/⭐+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function formatSequence(value: string): string {
  const text = value.trim();
  if (!text || text.includes("→")) return text;
  const parts = text.split(/\s*(?:,|;|\bthen\b|\bfollowed by\b)\s*/i).filter(Boolean);
  const sequenceCue = /\b(?:egg|larva|larvae|nymph|pupa|adult|cyst|trophozoite|sporocyst|miracidium|cercaria|metacercaria|oocyst|sporozoite|merozoite|gametocyte)\b/i;
  if (parts.length >= 3 && parts.every((part) => sequenceCue.test(part))) return parts.join(" → ");
  return text;
}

const OPTION_MARKER_SOURCE = String.raw`(?:\(?[A-Ea-e]\)|[A-Ea-e][\.)])`;
const OPTION_MARKER_RE = new RegExp(String.raw`(?:^|\s)(${OPTION_MARKER_SOURCE})\s+`);
const OPTION_CAPTURE_RE = new RegExp(String.raw`(?:^|\s)(${OPTION_MARKER_SOURCE})\s+([\s\S]*?)(?=\s+${OPTION_MARKER_SOURCE}\s+|$)`, "gi");

/**
 * Papers pasted from PDFs often glue the next choice onto the previous one
 * ("…T. b. gambienseC. Trypanosoma cruzi"). Insert the missing space so every
 * marker is detectable, which is what forces one choice per row.
 */
/** Option marker that ignores inline "(a)"/"(b)" cross-references inside a choice. */
const OPTION_MARKER_STRICT = String.raw`(?:\([A-E]\)|[A-Ea-e][\.)])`;

export function spaceOptionMarkers(text: string): string {
  let spaced = (text || "").replace(
    /([^\s])((?:\([A-E]\)|[A-E][.)])\s+)/g,
    (m, before: string, marker: string) => (/[A-Za-z0-9)\].,;:'"]/.test(before) ? `${before} ${marker}` : m),
  );

  // Some legacy imports use one lowercase run with no delimiter at all:
  // "a) First choiceb) Second choicec) Third choice". Restrict this repair
  // to lines that already start with a choice and contain at least two later
  // markers, avoiding accidental splits in ordinary prose.
  if (/^\(?[A-Ea-e]\)?[.)]\s+/.test(spaced)) {
    const glued = spaced.match(/[b-e][.)]\s+(?=[A-Z])/g) || [];
    if (glued.length >= 2) {
      spaced = spaced.replace(/([^\s])([b-e][.)]\s+(?=[A-Z]))/g, "$1 $2");
    }
  }
  return spaced;
}

/** Count option markers in a line ("A) …", "B. …"). */
export function countOptionMarkers(text: string): number {
  return (text.match(new RegExp(String.raw`(?<![^\s])${OPTION_MARKER_STRICT}\s+`, "g")) || []).length;
}

/**
 * Letters of the real option markers, in order — inline references like "(a)"
 * or "(b)" inside a choice are ignored because a marker must be followed by a
 * space. Used so microbiology prose ("B. subtilis … C. difficile") is never
 * mistaken for a choice run.
 */
export function markerLetters(text: string): string[] {
  return Array.from(text.matchAll(new RegExp(String.raw`(?<![^\s])(\()?([A-Ea-e])[\).]\s+`, "g")))
    .filter((m) => !(m[1] && /[a-e]/.test(m[2])))
    .map((m) => m[2].toUpperCase());
}

export function looksLikeChoiceRun(text: string, startsWithMarker: boolean): boolean {
  const letters = markerLetters(text);
  const min = startsWithMarker ? 2 : 3;
  if (letters.length < min) return false;
  return letters.every((l, i) => i === 0 || l.charCodeAt(0) === letters[i - 1].charCodeAt(0) + 1);
}

/** Split a run of choices into one string per choice, markers normalized. */
export function splitMarkerRun(text: string): string[] {
  return text
    .split(new RegExp(String.raw`\s+(?=${OPTION_MARKER_STRICT}\s+)`))
    .map((p) => p.trim())
    .filter(Boolean);
}

export function normalizeOptionLine(line: string): string {
  const cleaned = cleanDisplayText(line);
  return cleaned.replace(/^\(?([A-Ea-e])\)?[.)]?\s+/, (_, label) => `${String(label).toUpperCase()}) `);
}

export function splitOptionRun(line: string): string[] {
  const clean = spaceOptionMarkers(cleanDisplayText(line));
  const matches = Array.from(clean.matchAll(OPTION_CAPTURE_RE));
  if (matches.length >= 2) {
    return matches.map((m) => cleanDisplayText(m[2] || "")).filter(Boolean);
  }
  if (/^\(?[A-Ea-e]\)?[.)]?\s+/.test(clean)) return [clean.replace(/^\(?[A-Ea-e]\)?[.)]?\s+/, "").trim()].filter(Boolean);
  return [];
}

export function splitStemAndOptions(text: string): { stem: string; opts: string[] } | null {
  const clean = spaceOptionMarkers(cleanDisplayText(text));
  const first = clean.search(OPTION_MARKER_RE);
  if (first < 0) return null;
  const stem = clean.slice(0, first).trim().replace(/[;,:\s]+$/, "");
  const optionsText = clean.slice(first).trim();
  const opts = splitOptionRun(optionsText);
  return opts.length >= 2 ? { stem, opts } : null;
}

export function isQuestionLike(line: string): boolean {
  const t = cleanDisplayText(line);
  return /^(?:Q(?:uestion)?\s*)?\d+[a-z]?[.)]\s+.{4,}/i.test(t)
    || /^[A-C]\d+[.)]?\s+.{4,}/i.test(t)
    || /^Question\s+\d+[a-z]?\b/i.test(t);
}

export function extractExamQuestions(rawContent: string): { mcqs: PreviewMcq[]; essays: PreviewEssay[] } {
  const lines = preprocessContent(rawContent || "").replace(/\r\n?/g, "\n").split("\n");
  const mcqs: PreviewMcq[] = [];
  const essays: PreviewEssay[] = [];
  let cur: PreviewMcq | null = null;
  let mcqCount = 0;
  let essayCount = 0;
  let mode: "mcq" | "essay" | null = null;
  let skipAnswer = false;

  const flush = () => {
    if (cur) {
      mcqs.push(cur);
      cur = null;
    }
  };

  const isQuestionHeaderOnly = (text: string) =>
    /^(?:Q(?:uestion)?\s*)\d+[a-z]?\s*$/i.test(text);

  const looksLikeMcqAhead = (index: number) => {
    let markers = 0;
    for (let j = index; j < Math.min(lines.length, index + 6); j++) {
      const line = cleanDisplayText(lines[j] || "");
      if (!line) continue;
      markers += countOptionMarkers(spaceOptionMarkers(line));
      if (markers >= 2) return true;
      if (/^(?:Q(?:uestion)?\s*)?\d+[a-z]?[.)]?\s*/i.test(line) && j > index) break;
    }
    return false;
  };

  for (let i = 0; i < lines.length; i++) {
    const t = cleanDisplayText(lines[i]);
    if (!t) continue;

    if (/\b(section\s+a|multiple\s+choice|\bmcqs?\b)\b/i.test(t)) {
      flush();
      mode = "mcq";
      skipAnswer = false;
      continue;
    }
    if (/\b(section\s+b|section\s+c|essay\s+questions?|short\s+answer|long\s+answer|answer\s+any)\b/i.test(t)) {
      flush();
      mode = "essay";
      skipAnswer = false;
      continue;
    }

    if (/^(?:✅\s*)?(answer|model answer|explanation|correct answer|rationale)\s*[:：]/i.test(t)) {
      skipAnswer = true;
      flush();
      continue;
    }
    if (skipAnswer) {
      if (isQuestionLike(t) || isQuestionHeaderOnly(t)) skipAnswer = false;
      else continue;
    }

    const split = splitStemAndOptions(t);

    // Some imported papers put the question number on its own line:
    // "Question 1" followed by the stem on the next line. Treat that as a
    // real question header instead of losing the entire paper.
    if (isQuestionHeaderOnly(t)) {
      flush();
      let j = i + 1;
      while (j < lines.length && !cleanDisplayText(lines[j])) j++;
      const next = cleanDisplayText(lines[j] || "");
      if (!next || /^(?:answer|model answer|explanation|rationale)\b/i.test(next)) continue;

      const stem = next;
      const inline = splitStemAndOptions(stem);
      const mcq = inline || mode === "mcq" || looksLikeMcqAhead(j + 1);

      if (inline) {
        mcqCount++;
        cur = { n: String(mcqCount), stem: cleanDisplayText(inline.stem), opts: inline.opts };
      } else if (mcq) {
        mcqCount++;
        cur = { n: String(mcqCount), stem: cleanDisplayText(stem), opts: [] };
      } else {
        essayCount++;
        essays.push({ n: String(essayCount), text: cleanDisplayText(stem) });
      }

      // Consume the standalone stem; option lines remain for the normal
      // collector on the following iterations.
      i = j;
      continue;
    }

    // Numbered question stem, including "1. Stem" and "Question 1: Stem".
    const qMatch =
      t.match(/^(?:Q(?:uestion)?\s*)?(\d+[a-z]?)[.)]\s*[-–]?\s*(.+)$/i) ||
      t.match(/^Question\s+(\d+[a-z]?)\s*[:.-]\s+(.+)$/i);

    if (qMatch) {
      flush();
      const stem = qMatch[2].trim();
      const stemSplit = splitStemAndOptions(stem);
      if (stemSplit) {
        mcqCount++;
        cur = { n: String(mcqCount), stem: cleanDisplayText(stemSplit.stem), opts: stemSplit.opts };
        continue;
      }

      const nextHasOptions = splitOptionRun(lines[i + 1] || "").length > 0;
      if (mode === "mcq" || nextHasOptions || looksLikeMcqAhead(i + 1) || (/[?]/.test(stem) && mode !== "essay")) {
        mcqCount++;
        cur = { n: String(mcqCount), stem: cleanDisplayText(stem), opts: [] };
      } else {
        essayCount++;
        essays.push({ n: String(essayCount), text: cleanDisplayText(stem) });
      }
      continue;
    }

    const essayPrefix = t.match(/^([A-C]\d+[a-z]?)[.)]?\s+(.+)$/i);
    if (essayPrefix && mode !== "mcq") {
      flush();
      essayCount++;
      essays.push({ n: String(essayCount), text: cleanDisplayText(essayPrefix[2]) });
      continue;
    }

    // Options line while collecting an MCQ.
    if (cur) {
      const opts = splitOptionRun(t);
      if (opts.length > 0) {
        cur.opts.push(...opts);
        continue;
      }
      if (cur.opts.length === 0) {
        cur.stem += " " + cleanDisplayText(t);
        continue;
      }
      flush();
    }
  }

  flush();

  return {
    mcqs: mcqs.filter((q) => q.stem && q.opts.length >= 2),
    essays: essays.filter((q) => q.text && !/^(?:answer|explanation|rationale)\b/i.test(q.text)),
  };
}
/* ─── Helpers ─── */
export function splitInlineTable(s: string): string[] {
  if (!s.includes("|---") && !s.includes("| ---") && !s.includes("|:--") && !s.includes("| :--")) return [];
  return s.replace(/\|\s*\|/g, "|\n|").split("\n").map(r => r.trim()).filter(r => r.startsWith("|"));
}

const META_HEADING = /^(key points|detailed notes|summary)$/i;

export function decodeEntities(s: string): string {
  if (!s) return s;
  let text = s;
  for (let i = 0; i < 2; i++) {
    text = text
    .replace(/&amp;nbsp;/gi, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&mdash;/gi, "—")
    .replace(/&ndash;/gi, "–")
    .replace(/&hellip;/gi, "…")
    .replace(/&rsquo;/gi, "'")
    .replace(/&lsquo;/gi, "'")
    .replace(/&rdquo;/gi, "\u201D")
    .replace(/&ldquo;/gi, "\u201C")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)));
  }
  return text;
}

function stripBranding(s: string): string {
  if (!s) return s;
  // Preserve MKU / Mount Kenya University when authors include it (per user request).
  // Only tidy stray table-cell artefacts left over from imports.
  return s
    .replace(/\|\s*\|/g, "|")
    .replace(/\|\s*$/g, "")
    .replace(/^\s*\|\s*/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function isCourseBrandingLine(s: string): boolean {
  const t = s.trim();
  if (!t) return false;
  return false;
}

/**
 * Scanner/OCR leftovers that carry no teaching value and only hurt the page
 * (and its SEO): watermark lines, "Page 3 of 11" footers, bare punctuation
 * fragments left by the OCR pass.
 */
function isOcrNoiseLine(s: string): boolean {
  const t = s.trim();
  if (!t) return false;
  if (/^[-–—_.,;:'"`~^°|\\/()[\]{}<>*+=\s]+$/.test(t)) return true;
  if (/^(?:scanned\s+by\s+camscanner|camscanner)\b/i.test(t)) return true;
  if (/^page\s*\d*\s*of\s*\d+\.?$/i.test(t)) return true;
  if (/^page\s*\d+\s*of\s*[a-z]{1,3}\.?$/i.test(t)) return true;
  // Preserve numeric MCQ choices and answer lines. These contain few letters,
  // but are real exam content (for example "A. 1-50" or "D. >5000").
  if (/^\*{0,2}\(?[A-Ea-e]\)?[\.)]\s*[\d<>≥≤~+\-.,\/%\s]*\d/.test(t)) return false;
  if (/^(?:answer|ans)\s*[:.\-–]/i.test(t)) return false;
  if (/\d/.test(t) && t.length <= 24) return false;
  // Lines that are mostly OCR garbage: very few real letters among symbols.
  const letters = t.replace(/[^A-Za-z]/g, "").length;
  if (t.length >= 6 && letters / t.length < 0.35) return true;
  return false;
}

/** Remove headings that have no real content beneath them (empty scan pages). */
export function dropEmptySections(lines: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (/^#{1,6}\s/.test(t)) {
      let j = i + 1;
      let hasBody = false;
      while (j < lines.length && !/^#{1,6}\s/.test(lines[j].trim())) {
        const b = lines[j].trim();
        if (b && !isOcrNoiseLine(b)) { hasBody = true; break; }
        j++;
      }
      if (!hasBody) {
        // Skip the heading and its empty body entirely.
        while (i + 1 < lines.length && !/^#{1,6}\s/.test(lines[i + 1].trim())) i++;
        continue;
      }
    }
    out.push(lines[i]);
  }
  return out;
}

export function cleanHeadingText(value: string): string {
  return value
    .replace(/[\u{1F300}-\u{1FAFF}\u2600-\u27BF]/gu, "")
    .replace(/⭐+/g, "")
    .replace(/\*+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Detect section labels left as plain text by PDF/OCR imports. */
export function isLikelyStandaloneSectionHeading(current: string, previous = "", next = ""): boolean {
  const text = cleanDisplayText(current).replace(/^\*+|\*+$/g, "").trim();
  if (!text || previous.trim() || text.length < 3 || text.length > 64) return false;
  if (/^(?:figure|diagram|table|page)\b/i.test(text)) return false;
  if (/^(?:https?:\/\/|!\[|#{1,6}\s|[-*+•]\s|\d+[.)]\s)/i.test(text)) return false;
  if (/[.!?;:]$/.test(text) || /[=<>]/.test(text)) return false;
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length > 9 || !/[A-Za-z]{3}/.test(text)) return false;
  const letters = text.replace(/[^A-Za-z]/g, "");
  const allCaps = letters.length >= 4 && letters === letters.toUpperCase();
  const titleLike = words.filter((word) => /[A-Za-z]/.test(word)).every((word) =>
    /^(?:and|or|of|the|in|for|to|a|an)$/i.test(word) || /^[A-Z]/.test(word),
  );
  const singleLabel = words.length <= 2 && /^[A-Z]/.test(text) && !next.trim().startsWith("-");
  return allCaps || titleLike || singleLabel;
}

/** True when an imported body heading merely repeats the page's hero title. */
export function isDuplicateArticleHeading(heading: string, title: string): boolean {
  const tokens = (value: string) => new Set(cleanDisplayText(value)
    .toLowerCase()
    .replace(/\b(?:complete|study|guide|notes?|revised|past|paper)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 2));
  const a = tokens(heading);
  const b = tokens(title);
  if (a.size < 2 || b.size < 2) return false;
  const overlap = [...a].filter((word) => b.has(word)).length;
  return overlap / Math.min(a.size, b.size) >= 0.8;
}

export function splitMalformedHeading(raw: string): { heading: string; extras: string[] } {
  let text = cleanHeadingText(raw.replace(/^HOW\s+TO\s+OPEN>\s*"?/i, "").replace(/^say\s*:?>\s*"?/i, ""));
  const extras: string[] = [];
  // "Q7 — CSF FLOW Production: choroid plexus …" — an all-caps topic title with
  // the body prose glued onto it. Keep the title as the heading and push the
  // prose back into the body so it never renders as a giant serif wall.
  const capsTitle = text.match(
    /^((?:Q(?:uestion)?\s*\d+\s*[—–\-:]\s*)?[A-Z][A-Z0-9''/&,.\s-]{2,60}?)\s+(?=(?:[ivxl]+\)|\(?[a-z]\)|[A-Z][a-z]|[a-z]))/,
  );
  if (capsTitle && capsTitle[1].replace(/[^A-Za-z]/g, "").length >= 4) {
    const rest = text.slice(capsTitle[0].length).trim();
    if (rest.length > 8) {
      extras.push(rest);
      text = capsTitle[1].replace(/[\s,.\-—–:]+$/, "").trim();
    }
  }
  const inlineBulletIdx = text.search(/[:—-]\s+-\s+/);
  if (inlineBulletIdx > 3) {
    const bullet = text.slice(inlineBulletIdx).replace(/^[:—-]\s*/, "").trim();
    text = text.slice(0, inlineBulletIdx).replace(/[:\s]+$/, "").trim();
    if (bullet) extras.push(bullet.startsWith("- ") ? bullet : `- ${bullet}`);
  }
  const quoteIdx = text.indexOf(">");
  if (quoteIdx > 8) {
    const quote = text.slice(quoteIdx + 1).replace(/^"|"$/g, "").trim();
    text = text.slice(0, quoteIdx).replace(/[:\s]+$/, "").trim();
    if (quote) extras.push(`> ${quote}`);
  }

  const italic = text.match(/^(.*?)(?:\s*)\*([^*]{8,})\*$/);
  if (italic && italic[1].trim().length > 10) {
    text = italic[1].replace(/[:\s]+$/, "").trim();
    extras.push(italic[2].trim());
  }

  const transition = text.search(/\b(?:Think of|The most|Every reaction|Almost always|This is why|If someone|There are|ABO incompatibility)\b/);
  if (transition > 18) {
    extras.push(text.slice(transition).trim());
    text = text.slice(0, transition).replace(/[:\s]+$/, "").trim();
  }

  const sentence = text.match(/^(.{12,90}?[:?.])\s*(?=[A-Z"(])/);
  if (sentence && text.slice(sentence[0].length).trim().length > 12) {
    extras.push(text.slice(sentence[0].length).trim());
    text = sentence[1].replace(/[:\s]+$/, "").trim();
  }

  // Last resort: a heading this long is body copy, so keep only the first
  // sentence (or nothing) in the heading slot.
  if (text.length > 110) {
    const dot = text.indexOf(". ");
    if (dot > 8 && dot < 90) {
      extras.unshift(text.slice(dot + 1).trim());
      text = text.slice(0, dot).trim();
    } else {
      extras.unshift(text);
      text = "";
    }
  }
  return { heading: text.replace(/^\d+\.(?!\d)\s*/, "").trim(), extras };
}

/* ─── Helper: is this line a markdown table row? ─── */
export function isTableRow(s: string): boolean {
  const t = s.trim();
  return t.startsWith("|") && t.includes("|", 1);
}


/**
 * Scanned/imported papers arrive with a hard line break at every printed line
 * width, so a single sentence used to render as four separate paragraphs with a
 * full paragraph gap between each fragment — the "spaced out, unreadable" look.
 * This rejoins those fragments into real paragraphs: a line only continues the
 * previous one when the previous line does not end a sentence AND the current
 * line starts mid-sentence (lowercase / opening bracket).
 */
const STRUCTURAL_START =
  /^(?:#{1,6}\s|>|\||!\[|```|[-*+•]\s|\(?[a-z0-9]{1,3}[.)]\s|[A-Ea-e]\s*[.)]\s|(?:answer|model answer|correct answer|explanation|rationale|question|q)\b\s*\d*\s*[:：]?)/i;

export function unwrapHardBreaks(raw: string): string {
  const lines = String(raw ?? "").replace(/\r\n?/g, "\n").split("\n");
  const out: string[] = [];
  let inFence = false;

  for (const original of lines) {
    const t = original.trim();
    if (/^```/.test(t)) { inFence = !inFence; out.push(original); continue; }
    if (inFence || !t) { out.push(original); continue; }

    // Find the previous non-blank output line.
    let prevIdx = out.length - 1;
    while (prevIdx >= 0 && !out[prevIdx].trim()) prevIdx--;
    const prev = prevIdx >= 0 ? out[prevIdx].trim() : "";

    const continuation =
      prev.length > 0 &&
      prev.length < 4000 &&
      !isTableRow(prev) &&
      !isTableRow(t) &&
      !/^(?:#{1,6}\s|>|\||!\[)/.test(prev) &&
      !STRUCTURAL_START.test(t) &&
      !/[.!?;:*_}"”’]$/.test(prev) &&
      /^[a-z(\u2018\u201c]/.test(t);

    if (continuation) {
      out[prevIdx] = `${out[prevIdx].replace(/\s+$/, "")} ${t}`;
      // Drop any blank lines that were sitting between the two fragments.
      out.length = prevIdx + 1;
      continue;
    }
    out.push(original);
  }

  return out.join("\n");
}

/** Split genuine multipart essay prompts, excluding explanations and captions. */
export function splitInlineEssayParts(line: string): string[] | null {
  const trimmed = (line || "").trim();
  if (!trimmed || /^[-*+]\s/.test(trimmed) || /^!\[/.test(trimmed) || /^(?:Explanation|Rationale|Answer)\s*:/i.test(trimmed)) return null;
  const plain = trimmed.replace(/^\*\*|\*\*$/g, "").trim();
  const markers = Array.from(plain.matchAll(/(?:^|\s)(\([a-h]\))\s+(?=\S)/gi));
  if (markers.length < 2) return null;
  const parts: string[] = [];
  const first = markers[0].index ?? 0;
  const prefix = plain.slice(0, first).trim();
  if (prefix) parts.push(prefix);
  for (let i = 0; i < markers.length; i++) {
    const start = (markers[i].index ?? 0) + (markers[i][0].startsWith(" ") ? 1 : 0);
    const end = i + 1 < markers.length ? (markers[i + 1].index ?? plain.length) : plain.length;
    const part = plain.slice(start, end).trim();
    if (part.length > 4) parts.push(part);
  }
  return parts.length >= 2 ? parts : null;
}

export function preprocessContent(raw: string): string {
  const out: string[] = [];
  let inKeyPoints = false;
  let inFence = false;

  // Imports sometimes glue an image directly to the question heading and the
  // following answer marker (`...question![alt](url)**Answer:**`). Split the
  // complete Markdown image token out before hard-break unwrapping or prose
  // punctuation cleanup can turn its URL into visible text. The alt text can
  // itself contain an imported line break, so normalise that while preserving
  // the image URL byte-for-byte.
  const decodedSource = decodeEntities(raw);
  const decoded = decodedSource.replace(
    /!\[([\s\S]*?)\]\((https?:\/\/[^\s)]+)\)/g,
    (match, alt: string, url: string, offset: number, source: string) => {
      const before = offset > 0 && source[offset - 1] !== "\n" ? "\n" : "";
      const end = offset + match.length;
      const after = end < source.length && source[end] !== "\n" ? "\n" : "";
      return `${before}![${alt.replace(/\s+/g, " ").trim()}](${url})${after}`;
    },
  ).replace(/^(#{1,6}\s+SECTION\s+[A-Z])(?=Q(?:uestion)?\s*\d+)/gim, "$1\n\n");
  const unwrapped = unwrapHardBreaks(decoded);
  const sourceLines = unwrapped.replace(/\r\n?/g, "\n").split("\n");

  for (let idx = 0; idx < sourceLines.length; idx++) {
    const rawLine = sourceLines[idx];
    const fenceTrim = rawLine.trim();
    if (/^```/.test(fenceTrim)) {
      out.push("```");
      inFence = !inFence;
      continue;
    }
    if (inFence) {
      out.push(rawLine.replace(/\u00A0/g, " ").replace(/&nbsp;/gi, " ").replace(/\s+$/g, ""));
      continue;
    }

    // ── FIX: pass table rows through completely raw (no transforms) ──
    const trimmedRaw = rawLine.trim().replace(/&nbsp;/gi, " ").replace(/\u00A0/g, " ");
    if (isTableRow(trimmedRaw)) {
      out.push(trimmedRaw);
      continue;
    }

    // Preserve standalone Markdown images before punctuation-spacing cleanup.
    // Otherwise `https://...` is rewritten as `https: //...` and the image URL
    // no longer renders. Keep this exemption ahead of every prose transform.
    if (/^!\[.*?\]\(\S+\)$/.test(trimmedRaw)) {
      out.push(trimmedRaw);
      continue;
    }

    // Answer boundaries are structural, not prose subheadings. Preserve them
    // before punctuation spacing can rewrite `**Answer:**` as `**Answer: **`.
    // Both renderers then keep the following points inside the Reveal panel.
    const boundary = trimmedRaw.match(/^\*{0,2}\s*(?:✅\s*)?(Answer|Answers|Answer key|Model answer|Correct answer|Explanation|Rationale)\s*[:：]\s*(.*?)\s*\*{0,2}$/i);
    if (boundary) {
      const label = /explanation|rationale/i.test(boundary[1]) ? "Explanation" : "Answer";
      let value = boundary[2].trim();
      // A frequent import defect stores `**Answer:` on one line and the
      // actual choice on the next. Joining them here prevents literal stars
      // and keeps the complete answer inside the Reveal panel.
      if (!value && sourceLines[idx + 1]) {
        const next = sourceLines[idx + 1].trim();
        if (next && !/^(?:[-*+]\s|#{1,6}\s|Question\s+\d+|Q\d+|---)/i.test(next)) {
          value = next.replace(/^\*+|\*+$/g, "").trim();
          idx++;
        }
      }
      out.push(`**${label}:**${value ? ` ${value}` : ""}`);
      continue;
    }

    const essayParts = splitInlineEssayParts(trimmedRaw);
    if (essayParts) {
      out.push(...essayParts);
      continue;
    }

    const line = rawLine;
    let t = line
      .trim()
      .replace(/&nbsp;/gi, " ")
      .replace(/\u00A0/g, " ")
      .replace(/^[•◦▪]\s*/, "- ")
      .replace(/^HOW\s+TO\s+OPEN>\s*"?/i, "")
      .replace(/^say\s*:?>\s*"?/i, "")
      // Add missing sentence spacing without corrupting decimal section numbers
      // such as "1.0 Introduction" into "1. 0 Introduction".
      .replace(/([:;!?])(?=\S)|\.(?=[A-Za-z])/g, "$1 ")
      .replace(/([a-z)])(?=[A-Z][a-z])/g, "$1 ")
      .replace(/([A-Z]{2,})(?=[A-Z][a-z])/g, "$1 ")
      .replace(/([A-Z]{3,})(?=[a-z]{3,})/g, "$1 ")
      .replace(/([^\s])(?=(?:Explanation|Rationale)\s*[:：])/gi, "$1 ")
      .replace(/\s*(?:->|=>|⟶|⟹)\s*/g, " → ")
      .replace(/([a-z])(?=(?:Think of|The most|Every reaction|Almost always|This is why|If someone|There are|ABO incompatibility)\b)/g, "$1 ");

    if (isCourseBrandingLine(t)) {
      out.push("");
      continue;
    }
    if (/^\*?This complete .+ is split into \d+ parts? for easier reading\.?\*?$/i.test(t)) continue;
    if (/^All \d+ source pages were processed\./i.test(t)) continue;
    if (isOcrNoiseLine(t)) { out.push(""); continue; }
    if (!t) { out.push(""); continue; }

    if (/^#{1,6}$/.test(t) && sourceLines[idx + 1]?.trim()) {
      const next = cleanHeadingText(decodeEntities(sourceLines[idx + 1].trim()));
      if (next && !META_HEADING.test(next)) {
        out.push(`${t.length <= 2 ? "##" : "###"} ${next}`);
        idx++;
        continue;
      }
    }

    if (/^```+$/.test(t)) { out.push(""); continue; }

    // ── FIX: exclude lines that look like table separators from the flowchart regex ──
    if (!isTableRow(t) && /^(\|+|v+|↓+|[-+|\s]+|\s*\+[-+]+\+\s*)$/i.test(t)) {
      out.push(t.includes("+") ? t.replace(/\s+/g, " ") : "↓");
      continue;
    }

    if (/^\*\*\d+\.\s+.+\*\*$/i.test(t)) {
      out.push(t.replace(/^\*\*/, "").replace(/\*\*$/, ""));
      continue;
    }
    if (/^#?(SECTION\s+\d+|PART\s+\d+|PART\s+[A-Z])\b/i.test(t)) {
      out.push(`## ${cleanHeadingText(t.replace(/^#+\s*/, ""))}`);
      continue;
    }
    if (/^-\s*$/.test(t)) continue;
    if (/^[-*_]{3,}$/.test(t)) { out.push(""); continue; }
    if (/^\d+$/.test(t)) continue;
    if (/^-?\s*.+\s\d+\.$/.test(t) && !t.includes("→") && !t.startsWith("|")) continue;

    if (/^#{1,6}\s*/.test(t)) {
      const hashes = t.match(/^#{1,6}/)?.[0] || "##";
      const rawHeading = t.replace(/^#{1,6}\s*/, "");
      const { heading, extras } = splitMalformedHeading(rawHeading);
      if (heading && META_HEADING.test(heading)) continue;
      if (heading) out.push(`${hashes.length === 1 ? "##" : hashes} ${heading}`);
      extras.forEach((extra) => out.push(extra));
      continue;
    }

    // Raw imported markdown sometimes leaves unmatched quote/emphasis wrappers.
    // Keep meaningful inline emphasis, but remove wrappers that would otherwise
    // show as literal publishing syntax.
    t = t.replace(/^(["'“”‘’]+)(.+)\1$/, "$2").replace(/^\*{1,3}(?!\s)(.*?)(?:\*{1,3})?$/, "$1").trim();

    if (t.startsWith("|") && (t.includes("|---") || t.includes("| ---"))) {
      splitInlineTable(t).forEach(r => out.push(r));
      continue;
    }

    if (t.startsWith("- ") && !t.startsWith("#") && !t.startsWith("|")) {
      const allDashes = [...t.matchAll(/ - /g)];
      if (allDashes.length >= 3) {
        t.slice(2).split(" - ").map(s => s.trim()).filter(Boolean).forEach(p => out.push(`- ${p}`));
        continue;
      }
    }

    if (/^#{1,2}\s/.test(t)) {
      const heading = t.replace(/^#+\s+/, "").replace(/\*+/g, "").replace(/⭐+/g, "").trim();
      if (/^key points$/i.test(heading)) { inKeyPoints = true; continue; }
      if (inKeyPoints) inKeyPoints = false;
      if (META_HEADING.test(heading)) continue;
      if (/^(HOW\s+TO\s+OPEN|say\s*:?>)/i.test(heading) || /^".*"$/.test(heading)) {
        out.push(`> ${heading.replace(/^HOW\s+TO\s+OPEN>\s*"?/i, "").replace(/^say\s*:?>\s*"?/i, "").replace(/^"|"$/g, "").trim()}`);
        continue;
      }
      out.push(t);
      continue;
    }

    if (inKeyPoints) continue;

    if (/^#{3,6}\s/.test(t)) {
      const headText = t.replace(/^#{3,6}\s+/, "");
      const bulletSplit = headText.search(/ - (?=[A-Z*\d"(])/);
      if (bulletSplit !== -1) {
        const hashes = t.match(/^(#{3,6})/)?.[1] ?? "###";
        const headOnly = headText.slice(0, bulletSplit).replace(/⭐+/g, "").trim();
        if (headOnly) out.push(`${hashes} ${headOnly}`);
        headText.slice(bulletSplit + 3).split(/ - (?=[A-Z*\d"(])/).map(b => b.trim()).filter(Boolean).forEach(b => out.push(`- ${b}`));
        continue;
      }
      out.push(t);
      continue;
    }

    if (!t.startsWith("- ") && !t.startsWith("#") && !t.startsWith("|")) {
      const capDashes = [...t.matchAll(/ - (?=[A-Z*\d"(])/g)];
      if (capDashes.length >= 2) {
        const firstIdx = capDashes[0].index!;
        const prefix = t.slice(0, firstIdx).replace(/[⭐:\s]+$/, "").trim();
        if (prefix) out.push(`### ${prefix}`);
        t.slice(firstIdx + 3).split(/ - (?=[A-Z*\d"(])/).map(b => b.trim()).filter(Boolean).forEach(b => out.push(`- ${b}`));
        continue;
      }
      if (t.includes(": - ")) {
        const idx = t.indexOf(": - ");
        const prefix = t.slice(0, idx).replace(/⭐+/g, "").trim();
        if (prefix) out.push(`### ${prefix}`);
        out.push("- " + t.slice(idx + 4).trim());
        continue;
      }
    }

    if (/^[A-Z][^|\n]{2,60}:$/.test(t) && !t.startsWith("-") && !t.startsWith("#")) {
      out.push(`### ${t.slice(0, -1).trim()}`);
      continue;
    }

    // ── MCQ choices always get their own row ──
    // Handles glued runs at any starting letter ("C. …D. …E. …"), a stem with
    // choices attached ("…?A) … B) …"), and missing spaces before markers.
    {
      const stripped = spaceOptionMarkers(t.replace(/^\*+|\*+$/g, "").replace(/\*\*/g, ""));
      const startsWithMarker = new RegExp(String.raw`^${OPTION_MARKER_SOURCE}\s+`).test(stripped);
      const markerCount = countOptionMarkers(stripped);

      if (startsWithMarker && markerCount >= 2 && looksLikeChoiceRun(stripped, true)) {
        const parts = splitMarkerRun(stripped);
        if (parts.length >= 2) {
          parts.forEach((p) => out.push(normalizeOptionLine(p)));
          continue;
        }
      }

      if (!startsWithMarker && markerCount >= 3 && looksLikeChoiceRun(stripped, false)) {
        const firstMarker = stripped.search(OPTION_MARKER_RE);
        if (firstMarker > 0) {
          const stem = stripped.slice(0, firstMarker).trim().replace(/[;,:*_\s]+$/, "");
          const parts = splitMarkerRun(stripped.slice(firstMarker).trim());
          if (stem && parts.length >= 2) {
            out.push(stem);
            parts.forEach((p) => out.push(normalizeOptionLine(p)));
            continue;
          }
        }
      }

      // A stem that swallowed only choice A: "…captured by: A. Substrate-level
      // phosphorylation" — give A its own row so all five choices line up.
      if (!startsWithMarker && markerCount === 1) {
        const letters = markerLetters(stripped);
        const firstMarker = stripped.search(OPTION_MARKER_RE);
        if (letters[0] === "A" && firstMarker > 12) {
          const stem = stripped.slice(0, firstMarker).trim();
          const choice = stripped.slice(firstMarker).trim();
          if (/[?:;]$/.test(stem) && choice.length > 3) {
            out.push(stem);
            out.push(normalizeOptionLine(choice));
            continue;
          }
        }
      }
    }

    out.push(t);
  }

  return dropEmptySections(out).join("\n");
}


/* ─── Extract TOC from content ─── */
export interface TocItem { id: string; text: string; level: number }

export function extractToc(content: string): TocItem[] {
  const items: TocItem[] = [];
  const lines = preprocessContent(content).split("\n");
  let secNum = 0;

  for (const line of lines) {
    const t = line.trim();
    if (/^#{1,2}\s/.test(t)) {
      const heading = t.replace(/^#+\s+/, "").replace(/\*+/g, "").replace(/⭐+/g, "").replace(/^\d+\.\s*/, "").trim();
      if (META_HEADING.test(heading)) continue;
      secNum++;
      items.push({ id: slugify(heading) || `section-${secNum}`, text: heading, level: 2 });
    }
    const qMatch = t.match(/^(QUESTION|Question|Q)\s*(\d+)/i);
    if (qMatch) {
      secNum++;
      items.push({ id: `section-${secNum}`, text: `Question ${qMatch[2]}`, level: 2 });
    }
  }

  return items;
}


export function answerKeyByQuestion(lines: string[]): Map<string, string> {
  const answers = new Map<string, string>();
  // Some source papers mark the correct choice by bolding the whole option
  // line ("**D. Pepsinogen …**") instead of printing a separate "Answer:"
  // line. Collected per-question and only trusted as a fallback (see below)
  // when a question has exactly one bold-wrapped option -- two or more means
  // the bolding is just emphasis, not an answer key.
  const boldCandidates = new Map<string, Set<string>>();
  let current = "";
  for (const raw of lines) {
    const trimmed = raw.trim();
    // A leading markdown bullet ("- **Answer: B) Insulin**") is common in
    // some source papers and must be stripped like the other prefix
    // characters, or the line never matches "Answer:" at all even though
    // the answer is right there in plain sight.
    const line = trimmed.replace(/^[-*_#>\s]+/, "");
    const q = line.match(/^(?:MCQ|Question|Q)\s*(\d+)/i) || line.match(/^(\d+)[.)]\s+/);
    if (q) current = q[1];
    const answer = line.match(/^(?:✅\s*)?(?:Answer|Correct answer)\s*[:：]\s*\*?\s*([A-E])\b/i);
    if (current && answer) answers.set(current, answer[1].toUpperCase());

    const boldOption = trimmed.match(/^\*\*\s*([A-E])\s*[.)]\s*.+\*\*\s*$/);
    if (current && boldOption) {
      const set = boldCandidates.get(current) || new Set<string>();
      set.add(boldOption[1].toUpperCase());
      boldCandidates.set(current, set);
    }
  }
  for (const [q, letters] of boldCandidates) {
    if (!answers.has(q) && letters.size === 1) answers.set(q, [...letters][0]);
  }
  return answers;
}

/**
 * Some CAT/past-paper sources give the answer key as one consolidated list
 * near the end of the document ("1 D, 2 C, 3 D, …") instead of marking each
 * question individually. Only meant as a last-resort fallback (see
 * mergeAnswerKeys) for questions nothing more specific could answer, and
 * only trusted when at least MIN_RUN tightly-packed, strictly-increasing
 * entries are found in a row -- so a stray "12 B" elsewhere in the article
 * body can never be misread as a key.
 */
export function parseConsolidatedAnswerKey(content: string): Map<string, string> {
  const MIN_RUN = 5;
  const MAX_GAP = 12;
  const pairRe = /\b(\d{1,3})\s+([A-E])(?:\/[A-E])?\b/g;
  let best: { number: number; letter: string }[] = [];
  let run: { number: number; letter: string }[] = [];
  let lastNumber = -1;
  let lastEnd = -Infinity;
  let match: RegExpExecArray | null;
  while ((match = pairRe.exec(content))) {
    const number = Number(match[1]);
    const letter = match[2].toUpperCase();
    const contiguous = match.index - lastEnd < MAX_GAP;
    if (contiguous && number > lastNumber) {
      run.push({ number, letter });
    } else {
      if (run.length > best.length) best = run;
      run = [{ number, letter }];
    }
    lastNumber = number;
    lastEnd = pairRe.lastIndex;
  }
  if (run.length > best.length) best = run;
  if (best.length < MIN_RUN) return new Map();
  return new Map(best.map((p) => [String(p.number), p.letter]));
}

/** Explicit/bold per-question answers win; a consolidated key only fills in
 *  questions nothing else could answer. */
export function mergeAnswerKeys(primary: Map<string, string>, fallback: Map<string, string>): Map<string, string> {
  const merged = new Map(primary);
  for (const [q, letter] of fallback) {
    if (!merged.has(q)) merged.set(q, letter);
  }
  return merged;
}

function isMcqOptionLine(s: string): boolean {
  return /^\*{0,2}\s*[A-E]\s*[.)]\s*\*{0,2}\s*\S/.test(s);
}

/**
 * True when the next couple of non-blank lines after `idx` look like MCQ
 * options (A/B/C/…). Used to confirm a bare numbered line ("1. …", "### 3.
 * …") is really the start of a question and not an ordinary numbered
 * heading or list item elsewhere in an article.
 */
export function looksLikeUpcomingMcqOptions(lines: string[], idx: number): boolean {
  let seen = 0;
  for (let j = idx + 1; j < Math.min(lines.length, idx + 6); j++) {
    const nt = lines[j].trim();
    if (!nt) continue;
    if (isMcqOptionLine(nt)) {
      seen++;
      if (seen >= 2) return true;
      continue;
    }
    if ((nt.match(/(?:^|\s)[A-E][.)]\s/g) || []).length >= 2) return true;
    break;
  }
  return false;
}
