import { supabase } from "@/integrations/supabase/client";
import { getAcademicYears, type ResourceType } from "./academic";
import { dedupeResourceSummaries, hasStoryContent, isPublicMcqSet, isPublicStudyTitle } from "./content-policy";
import {
  isOfflineMode,
  getSummariesOffline,
  getMcqSetsOffline,
  getFlashcardSetsOffline,
} from "./offlineStore";

/** Accepts "Year 2", "2", or 2 and returns the numeric year, or null. */
export function parseYearNumber(year: string | number | undefined): number | null {
  if (year === undefined || year === null || year === "") return null;
  const match = String(year).match(/\d+/);
  return match ? Number(match[0]) : null;
}

export interface SearchHit {
  id: string;
  title: string;
  slug: string | null;
  category: string;
  kind: ResourceType | "unit" | "topic";
  contentType: string;
  reason: string;
  updated_at?: string | null;
  exam_year?: string | null;
  href: string;
  score: number;
}

export interface SearchFilters {
  year?: string;
  unitId?: string;
  contentType?: string;
  examYear?: string;
  verifiedOnly?: boolean;
  recentOnly?: boolean;
  includeStories?: boolean;
}

let aliasCache: { at: number; rows: { canonical_term: string; alias: string }[] } | null = null;

async function getAliases() {
  if (aliasCache && Date.now() - aliasCache.at < 10 * 60 * 1000) return aliasCache.rows;
  const { data } = await supabase.from("search_aliases").select("canonical_term, alias").eq("approved", true);
  aliasCache = { at: Date.now(), rows: (data || []) as { canonical_term: string; alias: string }[] };
  return aliasCache.rows;
}

/** Expands a query with curated medical aliases + simple spelling variants. */
export async function expandQuery(query: string): Promise<{ terms: string[]; related: string[] }> {
  const q = query.trim().toLowerCase();
  if (!q) return { terms: [], related: [] };
  const rows = await getAliases();
  const terms = new Set<string>([q]);
  const related = new Set<string>();

  for (const row of rows) {
    const alias = row.alias.toLowerCase();
    const canonical = row.canonical_term.toLowerCase();
    if (q === alias || q.includes(` ${alias} `) || q.startsWith(`${alias} `) || q.endsWith(` ${alias}`)) {
      terms.add(canonical);
      related.add(row.canonical_term);
    }
    if (q === canonical) {
      terms.add(alias);
      related.add(row.alias);
    }
  }

  // British/American spelling variants both ways
  const variants: [RegExp, string][] = [
    [/haem/g, "hem"], [/hem(?!p)/g, "haem"], [/oedema/g, "edema"], [/edema/g, "oedema"],
    [/oesoph/g, "esoph"], [/esoph/g, "oesoph"], [/paediatr/g, "pediatr"], [/pediatr/g, "paediatr"],
    [/gynaecol/g, "gynecol"], [/gynecol/g, "gynaecol"], [/anaem/g, "anem"], [/anem/g, "anaem"],
    [/diarrhoea/g, "diarrhea"], [/diarrhea/g, "diarrhoea"],
  ];
  for (const [re, rep] of variants) {
    if (re.test(q)) terms.add(q.replace(re, rep));
  }
  // singular/plural
  if (q.endsWith("s")) terms.add(q.slice(0, -1));
  else terms.add(`${q}s`);

  return { terms: [...terms].filter(Boolean).slice(0, 8), related: [...related].slice(0, 6) };
}

function orIlike(cols: string[], terms: string[]) {
  return terms.flatMap((t) => cols.map((c) => `${c}.ilike.%${t.replace(/[,%]/g, " ")}%`)).join(",");
}

export async function globalSearchOffline(
  query: string,
  filters: SearchFilters = {}
): Promise<{ hits: SearchHit[]; related: string[] }> {
  const q = query.trim().toLowerCase();
  if (!q) return { hits: [], related: [] };

  const terms = q.split(/\s+/).filter(Boolean);
  const yearNumber = parseYearNumber(filters.year);
  const yearLabel = yearNumber ? `Year ${yearNumber}` : null;

  const [articles, mcqs, flashcards] = await Promise.all([
    getSummariesOffline().catch(() => []),
    getMcqSetsOffline().catch(() => []),
    getFlashcardSetsOffline().catch(() => []),
  ]);

  const hits: SearchHit[] = [];

  // Articles & Notes
  for (const row of articles) {
    if (!isPublicStudyTitle(row.title)) continue;
    const titleLower = (row.title || "").toLowerCase();
    const catLower = (row.category || "").toLowerCase();
    const tagsLower = (Array.isArray(row.tags) ? row.tags.join(" ") : "").toLowerCase();

    if (yearLabel && !catLower.startsWith(yearLabel.toLowerCase())) continue;
    if (filters.examYear && row.exam_year !== filters.examYear) continue;

    const matchesTitle = terms.some((t) => titleLower.includes(t));
    const matchesCat = terms.some((t) => catLower.includes(t));
    const matchesTags = terms.some((t) => tagsLower.includes(t));
    if (!matchesTitle && !matchesCat && !matchesTags) continue;

    let score = 50;
    let reason = "Found in study notes";
    if (titleLower.includes(q)) {
      score = 110;
      reason = "Matched note title";
    } else if (matchesTitle) {
      score = 85;
      reason = "Matched note title";
    } else if (matchesCat) {
      score = 65;
      reason = "Matched category";
    } else if (matchesTags) {
      score = 60;
      reason = "Matched topic tag";
    }

    hits.push({
      id: row.id,
      title: row.title,
      slug: row.slug || null,
      category: row.category || "General",
      kind: "article",
      contentType: row.content_type || "Notes",
      reason,
      updated_at: row.updated_at,
      exam_year: row.exam_year,
      href: `/blog/${row.slug || row.id}`,
      score,
    });
  }

  // MCQs
  for (const row of dedupeResourceSummaries(mcqs)) {
    if (!isPublicMcqSet(row)) continue;
    if (filters.contentType && filters.contentType !== "MCQ Bank") continue;
    const titleLower = (row.title || "").toLowerCase();
    const catLower = (row.category || "").toLowerCase();

    if (yearLabel && !catLower.startsWith(yearLabel.toLowerCase())) continue;
    if (filters.examYear && row.exam_year !== filters.examYear) continue;

    const matchesTitle = terms.some((t) => titleLower.includes(t));
    const matchesCat = terms.some((t) => catLower.includes(t));
    if (!matchesTitle && !matchesCat) continue;

    hits.push({
      id: row.id,
      title: row.title,
      slug: row.slug || null,
      category: row.category || "MCQ Bank",
      kind: "mcq",
      contentType: "MCQ Bank",
      reason: matchesTitle ? "Matched MCQ title" : "Matched unit",
      updated_at: row.updated_at,
      href: `/exams/${row.slug || row.id}/start`,
      score: titleLower.includes(q) ? 95 : 70,
    });
  }

  // Flashcards
  for (const row of flashcards) {
    if (filters.contentType && filters.contentType !== "Flashcards") continue;
    const titleLower = (row.title || "").toLowerCase();
    const catLower = (row.category || "").toLowerCase();
    const matchesTitle = terms.some((t) => titleLower.includes(t));
    const matchesCat = terms.some((t) => catLower.includes(t));
    if (!matchesTitle && !matchesCat) continue;

    hits.push({
      id: row.id,
      title: row.title,
      slug: row.slug || null,
      category: row.category || "Flashcards",
      kind: "flashcard",
      contentType: "Flashcards",
      reason: matchesTitle ? "Matched deck title" : "Matched unit",
      updated_at: row.updated_at,
      href: `/flashcards/${row.slug || row.id}`,
      score: 65,
    });
  }

  hits.sort((a, b) => b.score - a.score);
  return { hits: hits.slice(0, 50), related: [] };
}

export async function globalSearch(query: string, filters: SearchFilters = {}): Promise<{ hits: SearchHit[]; related: string[] }> {
  if (isOfflineMode()) {
    return globalSearchOffline(query, filters);
  }

  try {
    const { terms, related } = await expandQuery(query);
    if (!terms.length) return { hits: [], related: [] };
    const primary = terms[0];

  // Year can arrive as "Year 2", "2", or 2 — normalize once so the filter
  // reliably matches the "Year N: ..." category strings used across content.
  const yearNumber = parseYearNumber(filters.year);
  const yearLabel = yearNumber ? `Year ${yearNumber}` : null;

  const recentSince = new Date(Date.now() - 60 * 86400000).toISOString();

  let articleQ = supabase
    .from("articles")
    .select(
      "id, title, slug, category, content_type, exam_year, updated_at, meta_description, tags, verification_status, completeness_status, university, lecturer",
    )
    .eq("published", true)
    .is("deleted_at", null)
    .or(orIlike(["title", "meta_description", "category", "unit", "university"], terms))
    .limit(40);
  if (yearLabel) articleQ = articleQ.ilike("category", `${yearLabel}:%`);
  if (filters.unitId) articleQ = articleQ.eq("unit_id", filters.unitId);
  if (filters.examYear) articleQ = articleQ.eq("exam_year", filters.examYear);
  if (filters.recentOnly) articleQ = articleQ.gte("updated_at", recentSince);

  let mcqQ = supabase
    .from("mcq_sets")
    .select("id, title, slug, category, content_type, exam_year, updated_at")
    .eq("published", true)
    .is("deleted_at", null)
    .or(orIlike(["title", "category"], terms))
    .limit(40);
  if (yearLabel) mcqQ = mcqQ.ilike("category", `${yearLabel}:%`);
  if (filters.unitId) mcqQ = mcqQ.eq("unit_id", filters.unitId);
  if (filters.examYear) mcqQ = mcqQ.eq("exam_year", filters.examYear);
  if (filters.recentOnly) mcqQ = mcqQ.gte("updated_at", recentSince);

  let flashQ = supabase
    .from("flashcard_sets")
    .select("id, title, slug, category, content_type, updated_at")
    .eq("published", true)
    .is("deleted_at", null)
    .or(orIlike(["title", "category"], terms))
    .limit(40);
  if (yearLabel) flashQ = flashQ.ilike("category", `${yearLabel}:%`);
  if (filters.unitId) flashQ = flashQ.eq("unit_id", filters.unitId);
  if (filters.recentOnly) flashQ = flashQ.gte("updated_at", recentSince);

  // Reuse the shared, cached academic-years lookup instead of an extra
  // roundtrip on every keystroke — this table rarely changes.
  const years = await getAcademicYears();
  const yearsById = new Map<string, number>();
  const idByYear = new Map<number, string>();
  for (const y of years) { yearsById.set(y.id, y.year_number); idByYear.set(y.year_number, y.id); }
  const yearId = yearNumber ? idByYear.get(yearNumber) : undefined;

  let unitQ = supabase
    .from("units")
    .select("id, name, slug, course_code, description, academic_year_id")
    .eq("published", true)
    .or(orIlike(["name", "course_code", "description"], terms))
    .limit(10);
  if (filters.unitId) unitQ = unitQ.eq("id", filters.unitId);
  else if (yearId) unitQ = unitQ.eq("academic_year_id", yearId);

  let topicQ = supabase
    .from("syllabus_topics")
    .select("id, title, unit_id, description")
    .eq("published", true)
    .or(orIlike(["title", "description"], terms))
    .limit(10);
  if (filters.unitId) topicQ = topicQ.eq("unit_id", filters.unitId);

  const storyQ = filters.includeStories
    ? (supabase as any)
        .from("stories")
        .select("id, title, slug, category, updated_at, content")
        .eq("published", true)
        .is("deleted_at", null)
        .or(orIlike(["title", "category"], terms))
        .limit(10)
    : Promise.resolve({ data: [] as { id: string; title: string; slug: string | null; category: string | null; updated_at: string | null }[] });

  const [articles, mcqs, flashcards, units, topics, stories] = await Promise.all([
    articleQ, mcqQ, flashQ, unitQ, topicQ, storyQ,
  ]);

  const hits: SearchHit[] = [];
  const reasonFor = (row: Record<string, unknown>) => {
    const title = String(row.title || row.name || "").toLowerCase();
    if (title.includes(primary)) return "Matched title";
    if (String(row.course_code || "").toLowerCase().includes(primary)) return `Course code: ${row.course_code}`;
    if (String(row.category || "").toLowerCase().includes(primary)) return "Matched unit";
    if (related.length) return `Related term: ${related[0]}`;
    return "Found in content";
  };

  for (const row of articles.data || []) {
    if (!isPublicStudyTitle(row.title)) continue;
    if (filters.verifiedOnly && row.verification_status !== "verified") continue;
    if (row.completeness_status === "incomplete") continue;
    const ct = row.content_type || "Notes";
    if (filters.contentType && filters.contentType !== ct) continue;
    hits.push({
      id: row.id, title: row.title, slug: row.slug, category: row.category, kind: "article",
      contentType: ct, reason: reasonFor(row), updated_at: row.updated_at, exam_year: row.exam_year,
      href: `/blog/${row.slug || row.id}`,
      score: row.title.toLowerCase().includes(primary) ? 100 : 60,
    });
  }
  for (const row of dedupeResourceSummaries(mcqs.data || [])) {
    if (!isPublicMcqSet(row)) continue;
    if (filters.contentType && filters.contentType !== "MCQ Bank") continue;
    hits.push({
      id: row.id, title: row.title, slug: row.slug, category: row.category, kind: "mcq",
      contentType: "MCQ Bank", reason: reasonFor(row), updated_at: row.updated_at,
      href: `/exams/${row.slug || row.id}/start`, score: 70,
    });
  }
  for (const row of flashcards.data || []) {
    if (filters.contentType && filters.contentType !== "Flashcards") continue;
    hits.push({
      id: row.id, title: row.title, slug: row.slug, category: row.category, kind: "flashcard",
      contentType: "Flashcards", reason: reasonFor(row), updated_at: row.updated_at,
      href: `/flashcards/${row.slug || row.id}`, score: 65,
    });
  }
  for (const row of units.data || []) {
    const yr = row.academic_year_id ? yearsById.get(row.academic_year_id) : undefined;
    hits.push({
      id: row.id, title: row.name, slug: row.slug, category: yr ? `Year ${yr}` : "",
      kind: "unit", contentType: "Unit", reason: reasonFor(row),
      href: yr ? `/year/${yr}/unit/${row.slug}` : "/", score: 120,
    });
  }
  for (const row of topics.data || []) {
    hits.push({
      id: row.id, title: row.title, slug: null, category: "Syllabus topic", kind: "topic",
      contentType: "Syllabus Topic", reason: reasonFor(row), href: `/search?q=${encodeURIComponent(row.title)}`,
      score: 80,
    });
  }
  for (const row of stories.data || []) {
    if (!hasStoryContent(row)) continue;
    hits.push({
      id: row.id, title: row.title, slug: row.slug, category: row.category || "Stories",
      kind: "story", contentType: "Clinical Story", reason: reasonFor(row),
      href: `/stories/${row.id}`, score: 30,
    });
  }

  hits.sort((a, b) => b.score - a.score);
  void logSearch(query, hits.length);
  return { hits, related };
  } catch (err) {
    console.warn("Online search failed, using offline fallback:", err);
    return globalSearchOffline(query, filters);
  }
}

export async function logSearch(query: string, results: number, clicked?: { type: string; id: string }) {
  if (isOfflineMode()) return;
  try {
    await supabase.from("search_queries").insert({
      query,
      normalized_query: query.trim().toLowerCase(),
      results_count: results,
      clicked_resource_type: clicked?.type ?? null,
      clicked_resource_id: clicked?.id ?? null,
    });
  } catch { /* analytics is best-effort */ }
}

export const SEARCH_GROUPS = [
  "Best Explanation",
  "Notes",
  "CAT",
  "Past Paper",
  "MCQ Bank",
  "Flashcards",
  "Timed Exam",
  "Unit",
  "Syllabus Topic",
  "Clinical Story",
] as const;

export function groupHits(hits: SearchHit[]): Record<string, SearchHit[]> {
  const groups: Record<string, SearchHit[]> = {};
  const best = hits.find((h) => h.kind === "article" && h.contentType === "Notes");
  for (const hit of hits) {
    if (best && hit === best) {
      groups["Best Explanation"] = [hit];
      continue;
    }
    const key = hit.contentType === "Revision Guide" || hit.contentType === "Course Outline" ? "Notes" : hit.contentType;
    (groups[key] ||= []).push(hit);
  }
  return groups;
}
