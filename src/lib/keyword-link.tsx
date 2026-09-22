import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { isPublicStudyTitle } from "@/lib/content-policy";
import { buildBlogPath, buildFlashcardPath } from "@/lib/store";
import { slugify } from "@/lib/deep-link";
import { buildStoryPath, stripRichText } from "@/lib/seo";

export type LinkEntry = { term: string; path: string; lower: string; target: string; category?: string | null; quality: number };
interface Ctx { entries: LinkEntry[]; used: Set<string>; usedTargets: Set<string>; currentPath: string | null; currentCategory: string | null }
const KeywordLinkContext = createContext<Ctx | null>(null);
let cache: LinkEntry[] | null = null;
let cachePromise: Promise<LinkEntry[]> | null = null;

const HIGH_VALUE_TERMS = [
  "general pathology", "clinical pathology", "clinical techniques", "oncopathology", "oncology",
  "osteochondroma", "bone tumour", "bone tumor", "parasitology", "entomology", "bacteriology",
  "microbiology", "hematopathology", "neuropathology", "inflammation", "neoplasia", "necrosis",
  "thrombosis", "embolism", "granuloma", "tuberculosis", "malaria", "schistosomiasis",
  "university of nairobi", "uon", "kenyatta university", "moi university", "kabarak university", "aga khan",
  "apoptosis", "metaplasia", "dysplasia", "hyperplasia", "hypertrophy", "atrophy", "ischemia",
  "infarction", "atherosclerosis", "vasculitis", "amyloidosis", "carcinoma", "sarcoma", "lymphoma",
  "leukemia", "anaemia", "anemia", "haemostasis", "hemostasis", "coagulation", "immunology",
  "hypersensitivity", "autoimmunity", "immunodeficiency", "mycology", "virology", "helminthiasis",
  "toxoplasmosis", "leishmaniasis", "trypanosomiasis", "amoebiasis", "giardiasis", "candidiasis",
  "cryptococcosis", "aspergillosis", "dermatophytosis", "influenza", "hepatitis", "rabies", "hiv",
  "streptococcus", "staphylococcus", "clostridium", "mycobacterium", "pseudomonas", "salmonella",
  "shigella", "cholera", "syphilis", "pharmacology", "pharmacokinetics", "pharmacodynamics",
];
const HIGH_VALUE_SET = new Set(HIGH_VALUE_TERMS);

export function stripCatalogLabel(title: string): string {
  return title
    .replace(/\s+[—–-]\s+(?:Notes|CAT(?:\s+20\d{2}(?:\/\d{2,4})?)?|Past Paper(?:\s+20\d{2}(?:\/\d{2,4})?)?|MCQ Bank|Course Outline|Revision Guide)\s*$/i, "")
    .replace(/\s+\|\s+(?:Notes|CAT|Past Paper|MCQ Bank|Course Outline|Revision Guide)\s*$/i, "")
    .trim();
}

function cleanTerm(raw: string): string {
  return stripRichText(raw).replace(/^[\u{1F300}-\u{1FAFF}\u2600-\u27BF\s]+/gu, "")
    .replace(/\b(year|unit|chapter|overview|introduction|definition|summary|clinical notes|study notes)\b/gi, " ")
    .replace(/\s+/g, " ").trim().replace(/^[-—–:;,.]+|[-—–:;,.]+$/g, "");
}

export function isUsefulTerm(term: string): boolean {
  if (term.length < 5 || term.length > 80 || !/[a-z]/i.test(term) || /^\d+$/.test(term)) return false;
  const words = term.split(/\s+/);
  if (words.length > 8) return false;
  const banned = /^(the|and|but|with|from|into|onto|over|under|this|that|these|those|also|then|than|when|where|while|because|therefore|however|thus|hence|other|another|first|second|third|final|note|notes|definition|overview|introduction|summary|causes|cause|features|feature|management|treatment|diagnosis|classification|types|type|examples|example|important|various|common|general|specific|clinical|study|chapter|section|topic|topics|article|articles|page|pages|year|years|unit|units|method|methods|process|processes|effect|effects|symptom|symptoms|sign|signs|drug|drugs|disease|diseases|patient|patients|test|tests|level|levels|stage|stages|step|steps|number|numbers|name|names|group|groups|case|cases|tissue|tissues|body|organ|organs|cell|cells|blood|fluid|fluids|system|systems|function|functions|structure|structures|action|actions|table|tables|figure|figures|image|images|review)$/i;
  if (words.length === 1) {
    if (banned.test(term)) return false;
    // Single words are highlighted only when they are recognised medical
    // concepts (or have a strongly medical scientific suffix).
    return HIGH_VALUE_SET.has(term.toLowerCase()) || /(?:itis|osis|oma|emia|uria|pathy|plasm|cyte|virus|coccus|mycin)$/i.test(term);
  }
  const meaningful = words.filter(word => word.length > 3 && !banned.test(word));
  return meaningful.length > 0;
}

async function loadEntries(): Promise<LinkEntry[]> {
  if (cache) return cache;
  if (cachePromise) return cachePromise;
  cachePromise = (async () => {
    try {
      const [{ data: articles }, { data: flashcards }, { data: stories }, { data: concepts }, { data: conceptAliases }] = await Promise.all([
        supabase.from("articles").select("id,title,slug,meta_title,meta_description,tags,category,exam_type").eq("published", true).is("deleted_at", null).limit(1500),
        (supabase as any).from("flashcard_sets").select("id,title,slug,meta_title,meta_description,category").eq("published", true).is("deleted_at", null).limit(1200),
        (supabase as any).from("stories").select("id,title,meta_title,meta_description,content").eq("published", true).limit(500),
        supabase.from("medical_concepts").select("id,canonical_term,importance,preferred_article_id").eq("approved", true).eq("enabled", true).limit(2000),
        supabase.from("medical_concept_aliases").select("concept_id,alias,abbreviation").eq("approved", true).limit(4000),
      ]);
      const entries: LinkEntry[] = [], seen = new Set<string>();
      const add = (raw: string | null | undefined, path: string, quality: number, category?: string | null) => {
        const term = cleanTerm(raw || ""), lower = term.toLowerCase(), key = `${path}|${lower}`;
        if (!isUsefulTerm(term) || seen.has(key)) return;
        seen.add(key); entries.push({ term, lower, path, target: slugify(term), category, quality });
      };
      const addTitle = (raw: string | null | undefined, path: string, category?: string | null, quality = 12) => {
        const base = stripCatalogLabel(stripRichText(raw || ""));
        add(base, path, quality, category);
        add(base.replace(/\b(MCQs?|Quiz|Questions?|Answers?|Exam(?:ination)?|Study Notes?|Flashcards?)\b/gi, " "), path, quality - 1, category);
        if (base.split(/\s+/).length <= 7) base.split(/\s+(?:and|vs\.?|versus|&)\s+|\s*[:—–]\s*/i).forEach(p => add(p, path, quality - 2, category));
      };
      const aliases = (title: string | null | undefined, path: string, desc?: string | null, tags?: string[], category?: string | null, quality = 12) => {
        addTitle(title, path, category, quality);
        add(category, path, 2, category);
        (tags || []).slice(0, 8).forEach(t => add(t, path, 4, category));
        const base = stripCatalogLabel(title || "");
        add(base.replace(/\([^)]{2,80}\)/g, " "), path, quality - 2, category);
        base.match(/\(([^)]{3,80})\)/g)?.forEach(m => add(m.slice(1, -1), path, quality - 3, category));
        base.split(/[:—–-]/).forEach(p => add(p, path, quality - 4, category));
        const haystack = `${title || ""} ${desc || ""}`.toLowerCase();
        HIGH_VALUE_TERMS.forEach(term => { if (haystack.includes(term)) add(term, path, 5, category); });
      };
      (articles || []).filter(a => isPublicStudyTitle(a.title)).forEach(a => aliases(
        a.meta_title || a.title,
        buildBlogPath({ id: a.id, title: a.title, slug: a.slug ?? undefined }),
        a.meta_description, a.tags, a.category, a.exam_type ? 10 : 14,
      ));
      const articlePaths = new Map((articles || []).map((a) => [a.id, buildBlogPath({ id: a.id, title: a.title, slug: a.slug ?? undefined })]));
      const conceptPaths = new Map<string, string>();
      (concepts || []).forEach((concept) => {
        const path = concept.preferred_article_id ? articlePaths.get(concept.preferred_article_id) : undefined;
        if (!path) return;
        conceptPaths.set(concept.id, path);
        add(concept.canonical_term, path, 30 + Math.min(10, Number(concept.importance) || 0));
      });
      (conceptAliases || []).forEach((alias) => {
        const path = conceptPaths.get(alias.concept_id);
        if (path) add(alias.alias, path, alias.abbreviation ? 31 : 28);
      });
      (flashcards || []).forEach(f => aliases(
        f.meta_title || f.title,
        buildFlashcardPath({ id: f.id, title: f.title, slug: f.slug }),
        f.meta_description, [], f.category, 8,
      ));
      (stories || []).forEach(s => aliases(s.meta_title || s.title, buildStoryPath(s), s.meta_description, [], null, 6));
      entries.sort((a,b) => b.term.length-a.term.length || b.quality-a.quality); cache=entries; return entries;
    } catch { return []; }
  })();
  return cachePromise;
}

export function KeywordLinkProvider({ currentPath, currentCategory, children }: { currentPath?: string; currentCategory?: string; children: ReactNode }) {
  const [entries,setEntries]=useState<LinkEntry[]>(cache||[]);
  useEffect(()=>{ loadEntries().then(setEntries); },[]);
  const ctx=useMemo<Ctx>(()=>({entries,used:new Set(),usedTargets:new Set(),currentPath:currentPath||null,currentCategory:currentCategory||null}),[entries,currentPath,currentCategory]);
  return <KeywordLinkContext.Provider value={ctx}>{children}</KeywordLinkContext.Provider>;
}

export function linkifyText(text: string, ctx: Ctx | null, keyPrefix = "k"): ReactNode {
  if (!ctx || !ctx.entries.length || !text) return text;
  const { entries, used, usedTargets, currentPath, currentCategory } = ctx;
  const pool = entries
    .filter((e) => !used.has(e.lower) && e.path !== currentPath && (!usedTargets.has(e.path) || e.quality >= 12))
    .sort((a, b) => Number(b.category === currentCategory) - Number(a.category === currentCategory) || b.quality - a.quality || b.term.length - a.term.length)
    .slice(0, 5000);
  const trie = buildLinkTrie(pool);

  const out: ReactNode[] = [];
  let rest = text;
  let i = 0;
  while (true) {
    const found = findBestMatch(rest, trie);
    if (!found) {
      out.push(rest);
      break;
    }
    const { entry, index, matched } = found;
    const before = rest.slice(0, index);
    used.add(entry.lower);
    usedTargets.add(entry.path);
    if (before) out.push(<span key={`${keyPrefix}-b-${i}`}>{before}</span>);
    out.push(<DeepLinkSpan key={`${keyPrefix}-l-${i}`} path={`${entry.path}#${entry.target || slugify(matched)}`} title={entry.term} label={matched} />);
    rest = rest.slice(index + matched.length);
    if (++i > 28) {
      out.push(rest);
      break;
    }
  }
  return <>{out}</>;
}

function DeepLinkSpan({ path, title, label }: { path: string; title: string; label: string }) {
  const navigate = useNavigate();
  return (
    <span
      role="link"
      tabIndex={0}
      className="deep-link"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        try {
          sessionStorage.setItem("deep_link_return", `${window.location.pathname}${window.location.search}${window.location.hash}|${window.scrollY}`);
        } catch { /* private-browsing / quota — the deep-link still navigates, just without a scroll-back position */ }
        navigate(path);
      }}
      onKeyDown={(e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        e.stopPropagation();
        navigate(path);
      }}
      aria-label={`${label}: open the detailed ${title} study page`}
      title={`Study ${title} in detail`}
    >
      {label}
    </span>
  );
}

interface TrieNode {
  children: Map<string, TrieNode>;
  entry?: LinkEntry;
}

/**
 * Builds a trie over every candidate term's lowercased text. Terms sharing a
 * prefix (or being identical) share nodes, so a single left-to-right scan of
 * the text can find the best match at each position in roughly O(text length)
 * instead of the previous O(pool size × text length) -- which mattered once
 * the candidate pool and article bodies both grew large. `pool` is expected
 * to already be sorted by priority (category match, then quality, then term
 * length); when two entries share the exact same lowercased term, the first
 * one inserted (i.e. the higher-priority one) wins the node.
 */
export function buildLinkTrie(pool: LinkEntry[]): TrieNode {
  const root: TrieNode = { children: new Map() };
  for (const entry of pool) {
    let node = root;
    for (const ch of entry.lower) {
      let next = node.children.get(ch);
      if (!next) {
        next = { children: new Map() };
        node.children.set(ch, next);
      }
      node = next;
    }
    if (!node.entry) node.entry = entry;
  }
  return root;
}

function isWordChar(ch: string | undefined): boolean {
  return !!ch && /[a-z0-9]/i.test(ch);
}

export interface LinkMatch {
  entry: LinkEntry;
  index: number;
  matched: string;
}

/**
 * Single left-to-right scan for the earliest, then longest, then
 * highest-priority whole-word match in `trie`. Matches must sit on word
 * boundaries on both sides, mirroring the previous regex-free boundary check.
 */
export function findBestMatch(text: string, trie: TrieNode): LinkMatch | null {
  const lower = text.toLowerCase();
  for (let start = 0; start < lower.length; start++) {
    if (isWordChar(lower[start - 1])) continue;
    let node = trie;
    let best: { entry: LinkEntry; end: number } | null = null;
    for (let end = start; end < lower.length; end++) {
      const next = node.children.get(lower[end]);
      if (!next) break;
      node = next;
      if (node.entry && !isWordChar(lower[end + 1])) best = { entry: node.entry, end: end + 1 };
    }
    if (best) return { entry: best.entry, index: start, matched: text.slice(start, best.end) };
  }
  return null;
}

export function useKeywordLinks() {
  return useContext(KeywordLinkContext);
}
