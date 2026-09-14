export const config = {
  runtime: "edge",
};

const OG_FALLBACK_IMAGE = "https://www.ompathstudy.com/og-default.png";
const GEO_KEYWORDS = "Kenya, Africa, global medical students, MBChB, clinical medicine, nursing, University of Nairobi, Kenyatta University, Moi University, Kabarak University, Aga Khan University";
const STATIC_PAGE_META: Record<string, { title: string; description: string; links: string[] }> = {
  "/": {
    title: "OmpathStudy | Free Medical Notes, MCQs & Exams",
    description: "Free medical notes, MCQs, flashcards and timed exams for MBChB, clinical medicine and health students in Kenya, Africa and worldwide.",
    links: ["/blog", "/mcqs", "/flashcards", "/exams", "/stories", "/year/1", "/year/2", "/year/3", "/year/4", "/year/5", "/year/6"],
  },
  "/blog": {
    title: "Medical Study Notes | OmpathStudy Kenya",
    description: "Browse free medical study notes in pathology, pharmacology, anatomy, physiology, microbiology and biochemistry.",
    links: ["/", "/mcqs", "/flashcards", "/exams", "/stories", "/year/1", "/year/2", "/year/3", "/year/4", "/year/5", "/year/6"],
  },
  "/mcqs": {
    title: "Medical MCQs with Answers | OmpathStudy Kenya",
    description: "Practice medical MCQs with answers and explanations by year and unit for exam-focused revision.",
    links: ["/", "/blog", "/flashcards", "/exams", "/year/1", "/year/2", "/year/3", "/year/4", "/year/5", "/year/6"],
  },
  "/flashcards": {
    title: "Medical Flashcards | OmpathStudy Kenya",
    description: "Study active-recall medical flashcards by year and unit for fast revision across core medical subjects.",
    links: ["/", "/blog", "/mcqs", "/exams", "/year/1", "/year/2", "/year/3", "/year/4", "/year/5", "/year/6"],
  },
  "/exams": {
    title: "Timed Medical Exams | OmpathStudy Kenya",
    description: "Take timed medical exams and past-paper style MCQ practice for MBChB revision by year and unit.",
    links: ["/", "/blog", "/mcqs", "/flashcards", "/year/1", "/year/2", "/year/3", "/year/4", "/year/5", "/year/6"],
  },
  "/stories": {
    title: "Medical School Stories | OmpathStudy Kenya",
    description: "Read reflective medical school stories and student experiences from Kenya and East Africa.",
    links: ["/", "/blog", "/mcqs", "/flashcards", "/exams"],
  },
};

function isCrawler(userAgent: string | null): boolean {
  const ua = (userAgent || "").toLowerCase();
  if (!ua) return false;
  return (
    ua.includes("bot") ||
    ua.includes("crawl") ||
    ua.includes("spider") ||
    // Google fetchers that do NOT contain "bot" in the UA string. Without
    // these, Google-InspectionTool / GoogleOther get the JS shell while
    // Googlebot gets the pre-rendered page — which is exactly what makes
    // Search Console report "Google chose a different canonical".
    ua.includes("inspectiontool") ||
    ua.includes("googleother") ||
    ua.includes("google-safety") ||
    ua.includes("google-extended") ||
    ua.includes("mediapartners-google") ||
    ua.includes("facebookexternalhit") ||
    ua.includes("whatsapp") ||
    ua.includes("telegram") ||
    ua.includes("discord") ||
    ua.includes("slack") ||
    ua.includes("linkedin") ||
    ua.includes("twitter") ||
    ua.includes("prerender") ||
    ua.includes("google") ||
    ua.includes("bing") ||
    ua.includes("semrush") ||
    ua.includes("ahrefs")
  );
}

function cleanForMetaSnippet(input: string): string {
  if (!input) return "";
  return input
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^(summary|introduction|overview|note)[:\s]*/i, "")
    .replace(/[*_`>|]/g, " ")
    .replace(/^\s*[-•]\s+/gm, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[[^\]]+\]\([^)]+\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanQuestionStem(raw: string): string {
  if (!raw) return "";
  return raw
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/^Question\s+\d+[\s:-]*/i, "")
    .replace(/\s*-\s*\(\s*$/, "")
    .replace(/[*_`>|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanOption(raw: string): string {
  if (!raw) return "";
  return raw
    .replace(/^[A-E][.)]\s*/i, "")
    .replace(/\s*-\s*\(\s*$/, "")
    .replace(/\s*\(\s*$/, "")
    .replace(/\s*-\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function to160(input: string): string {
  const s = cleanForMetaSnippet(input);
  if (!s) return "";
  return s.length <= 160 ? s : s.slice(0, 157).trimEnd() + "...";
}

function toMetaTitle(input: string, fallback = "Medical Study Resource"): string {
  const clean = cleanForMetaSnippet(input || fallback)
    .replace(/\s*[|–-]\s*OmpathStudy\s*(Kenya)?\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim() || fallback;
  return clean.length <= 60 ? clean : clean.slice(0, 57).trimEnd() + "...";
}

function toMetaDescription(input: string, fallback: string): string {
  const clean = cleanForMetaSnippet(input || fallback)
    .replace(/\s*[-–—]{2,}\s*/g, " — ")
    .replace(/\s+/g, " ")
    .trim();
  const value = clean.length >= 50 ? clean : fallback;
  const enriched = /\b(Kenya|Africa|MBChB|medical students)\b/i.test(value) ? value : `${value.replace(/[.\s]+$/, "")}. Kenya, Africa and global revision.`;
  return enriched.length <= 155 ? enriched : enriched.slice(0, 152).trimEnd() + "...";
}

function articleDescription(article: Record<string, string>): string {
  const title = cleanForMetaSnippet(article.title || "");
  const fallback = `${title} study notes with key clinical points, exam-focused explanations and revision support for medical students.`;
  let provided = cleanForMetaSnippet(article.meta_description || "").replace(/\s*[-–—]{2,}\s*/g, " — ").trim();
  if (title && provided.toLowerCase().startsWith(title.toLowerCase())) {
    provided = provided.slice(title.length).replace(/^\s*[|:;,.–—-]+\s*/, "").trim();
  }
  const fromContent = cleanForMetaSnippet(article.content || "");
  return toMetaDescription(provided || fromContent, fallback);
}

function htmlEscape(s: string): string {
  return (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const UUID_PREFIX_REGEX =
  /^([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})-(.+)$/i;

function slugify(value: string): string {
  return (value || "")
    .toLowerCase()
    .trim()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function cleanPublicSlug(rawSlug: string | null | undefined, fallbackTitle: string, fallback = "study"): string {
  const base = String(rawSlug || slugify(fallbackTitle) || fallback).trim().toLowerCase();
  return base
    .replace(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/i, "")
    .replace(/-[0-9a-f]{6}$/i, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || fallback;
}

const STOP_WORDS = new Set(["the", "and", "for", "with", "from", "into", "onto", "this", "that", "notes", "note", "mcq", "mcqs", "quiz", "questions", "study"]);

function tokenScore(target: string, candidate: string): number {
  const a = new Set(String(target || "").toLowerCase().replace(/[^a-z0-9\s-]/g, " ").split(/[\s-]+/).filter((t) => t.length > 2 && !STOP_WORDS.has(t)));
  const b = new Set(String(candidate || "").toLowerCase().replace(/[^a-z0-9\s-]/g, " ").split(/[\s-]+/).filter((t) => t.length > 2 && !STOP_WORDS.has(t)));
  if (!a.size || !b.size) return 0;
  let overlap = 0;
  a.forEach((t) => { if (b.has(t)) overlap++; });
  return overlap / (new Set([...a, ...b]).size || 1);
}

async function closestLivePath(table: string, param: string, prefix: "/blog" | "/mcqs" | "/flashcards", fallback: string): Promise<string> {
  const rows = await sbFetch(table, "select=id,title,slug&published=eq.true&deleted_at=is.null&limit=1000");
  let best: Record<string, string> | null = null;
  let score = 0;
  for (const row of rows || []) {
    const publicSlug = cleanPublicSlug(row.slug, row.title, fallback);
    const nextScore = Math.max(tokenScore(param, publicSlug), tokenScore(param, row.title || ""));
    if (nextScore > score) {
      best = row;
      score = nextScore;
    }
  }
  return best && score >= 0.28 ? `${prefix}/${cleanPublicSlug(best.slug, best.title, fallback)}` : prefix;
}

function extractUuidFromParam(value?: string | null): string | null {
  const v = String(value || "").trim();
  if (!v) return null;
  if (UUID_REGEX.test(v)) return v;
  const match = v.match(
    /^([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})(?:-|$)/i,
  );
  return match?.[1] || null;
}

function getSupabaseConfig() {
  const url =
    process.env.VITE_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    "https://dekyjrfwvavtoivqivno.supabase.co";
  const key =
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    "sb_publishable_jOXeiFMWJj1z_M-zShimXA_cG9f2QxL";
  return { url, key };
}

async function sbFetch(table: string, params: string) {
  const { url, key } = getSupabaseConfig();
  const res = await fetch(`${url}/rest/v1/${table}?${params}`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    throw new Error(`Supabase error on ${table}: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

async function fetchArticleBySlug(slug: string) {
  const decoded = decodeURIComponent(slug).trim().toLowerCase();
  const cols =
    "id,title,content,slug,published,deleted_at,meta_title,meta_description,og_image_url,created_at,updated_at,category";

  // 1. Try exact slug match
  const bySlug = await sbFetch(
    "articles",
    `select=${cols}&slug=eq.${encodeURIComponent(decoded)}&published=eq.true&deleted_at=is.null&limit=1`
  );
  if (bySlug && bySlug.length > 0) return bySlug[0];

  // 2. Check if param is UUID-prefixed: {uuid}-{slug}
  const uuidPrefixMatch = decoded.match(UUID_PREFIX_REGEX);
  if (uuidPrefixMatch) {
    const uuid = uuidPrefixMatch[1];
    const strippedSlug = uuidPrefixMatch[2];

    // 2a. Try by ID (most reliable)
    const byId = await sbFetch(
      "articles",
      `select=${cols}&id=eq.${encodeURIComponent(uuid)}&published=eq.true&deleted_at=is.null&limit=1`
    );
    if (byId && byId.length > 0) return byId[0];

    // 2b. Try stripped slug
    const byStripped = await sbFetch(
      "articles",
      `select=${cols}&slug=eq.${encodeURIComponent(strippedSlug)}&published=eq.true&deleted_at=is.null&limit=1`
    );
    if (byStripped && byStripped.length > 0) return byStripped[0];
  }

  // 3. Try pure UUID
  if (UUID_REGEX.test(decoded)) {
    const byId = await sbFetch(
      "articles",
      `select=${cols}&id=eq.${encodeURIComponent(decoded)}&published=eq.true&deleted_at=is.null&limit=1`
    );
    if (byId && byId.length > 0) return byId[0];
  }

  const candidates = await sbFetch(
    "articles",
    `select=id,title,slug&published=eq.true&deleted_at=is.null&limit=1000`
  );
  const match = (candidates || []).find((row: Record<string, string>) =>
    cleanPublicSlug(row.slug, row.title, "article") === decoded ||
    slugify(row.title || "") === decoded ||
    String(row.slug || "").toLowerCase() === decoded
  );
  if (match?.id) {
    const byClean = await sbFetch(
      "articles",
      `select=${cols}&id=eq.${encodeURIComponent(match.id)}&published=eq.true&deleted_at=is.null&limit=1`
    );
    if (byClean && byClean.length > 0) return byClean[0];
  }

  return null;
}

async function fetchMcqSetBySlugOrId(param: string) {
  const cols = "id,title,category,questions,slug,created_at,meta_title,meta_description,og_image_url";
  const decoded = decodeURIComponent(param).trim();

  const bySlug = await sbFetch(
    "mcq_sets",
    `select=${cols}&slug=eq.${encodeURIComponent(decoded)}&published=eq.true&deleted_at=is.null&limit=1`
  );
  if (bySlug && bySlug.length > 0) return bySlug[0];

  const id = extractUuidFromParam(param);
  if (id) {
    const byId = await sbFetch(
      "mcq_sets",
      `select=${cols}&id=eq.${encodeURIComponent(id)}&published=eq.true&deleted_at=is.null&limit=1`
    );
    if (byId && byId.length > 0) return byId[0];
  }

  const candidates = await sbFetch(
    "mcq_sets",
    `select=id,title,slug&published=eq.true&deleted_at=is.null&limit=1000`
  );
  const wanted = decoded.toLowerCase();
  const match = (candidates || []).find((row: Record<string, string>) =>
    cleanPublicSlug(row.slug, row.title, "quiz") === wanted ||
    slugify(row.title || "") === wanted ||
    String(row.slug || "").toLowerCase() === wanted
  );
  if (!match?.id) return null;
  const byClean = await sbFetch(
    "mcq_sets",
    `select=${cols}&id=eq.${encodeURIComponent(match.id)}&published=eq.true&deleted_at=is.null&limit=1`
  );
  return byClean && byClean.length > 0 ? byClean[0] : null;
}

async function fetchFlashcardSetBySlugOrId(param: string) {
  const cols = "id,title,category,cards,slug,created_at";
  const decoded = decodeURIComponent(param).trim();

  const bySlug = await sbFetch(
    "flashcard_sets",
    `select=${cols}&slug=eq.${encodeURIComponent(decoded)}&published=eq.true&deleted_at=is.null&limit=1`
  );
  if (bySlug && bySlug.length > 0) return bySlug[0];

  const id = extractUuidFromParam(param);
  if (id) {
    const byId = await sbFetch(
      "flashcard_sets",
      `select=${cols}&id=eq.${encodeURIComponent(id)}&published=eq.true&deleted_at=is.null&limit=1`
    );
    if (byId && byId.length > 0) return byId[0];
  }

  const candidates = await sbFetch(
    "flashcard_sets",
    `select=id,title,slug&published=eq.true&deleted_at=is.null&limit=1000`
  );
  const wanted = decoded.toLowerCase();
  const match = (candidates || []).find((row: Record<string, string>) =>
    cleanPublicSlug(row.slug, row.title, "flashcards") === wanted ||
    slugify(row.title || "") === wanted ||
    String(row.slug || "").toLowerCase() === wanted
  );
  if (!match?.id) return null;
  const byClean = await sbFetch(
    "flashcard_sets",
    `select=${cols}&id=eq.${encodeURIComponent(match.id)}&published=eq.true&deleted_at=is.null&limit=1`
  );
  return byClean && byClean.length > 0 ? byClean[0] : null;
}

/**
 * Resolve the one true public path for a legacy detail URL (UUID or
 * UUID-prefixed slug). Returns null when nothing matches.
 */
async function resolveCanonicalDetailPath(section: string, param: string): Promise<string | null> {
  try {
    if (section === "blog") {
      const article = await fetchArticleBySlug(param);
      return article ? `/blog/${cleanPublicSlug(article.slug, article.title, "article")}` : "/blog";
    }
    if (section === "mcqs") {
      const mcq = await fetchMcqSetBySlugOrId(param);
      return mcq ? `/mcqs/${cleanPublicSlug(mcq.slug, mcq.title, "quiz")}` : "/mcqs";
    }
    if (section === "flashcards") {
      const set = await fetchFlashcardSetBySlugOrId(param);
      return set ? `/flashcards/${cleanPublicSlug(set.slug, set.title, "flashcards")}` : "/flashcards";
    }
  } catch {
    return null;
  }
  return null;
}

async function buildLiveIndexLinks(section: string, year?: string): Promise<string> {
  const yearPrefix = year && /^[1-6]$/.test(year) ? `Year ${year}:` : "";
  const filterYear = (row: Record<string, string>) => !yearPrefix || String(row.category || "").startsWith(yearPrefix);
  const link = (href: string, label: string, category?: string) =>
    `<li><a href="${htmlEscape(href)}">${htmlEscape(label)}</a>${category ? ` <small>${htmlEscape(category.replace(/^Year\s*\d+:\s*/i, ""))}</small>` : ""}</li>`;

  if (section === "blog" || section === "year") {
    const rows = (await sbFetch("articles", "select=id,title,slug,category&published=eq.true&deleted_at=is.null&order=updated_at.desc&limit=1000")) || [];
    const links = rows.filter(filterYear).map((row: Record<string, string>) => link(`/blog/${cleanPublicSlug(row.slug, row.title, "article")}`, row.title, row.category));
    return links.length ? `<section><h2>Live study notes</h2><ul>${links.join("\n")}</ul></section>` : "";
  }
  if (section === "mcqs") {
    const rows = (await sbFetch("mcq_sets", "select=id,title,slug,category&published=eq.true&deleted_at=is.null&order=updated_at.desc&limit=1000")) || [];
    const links = rows.filter(filterYear).map((row: Record<string, string>) => link(`/mcqs/${cleanPublicSlug(row.slug, row.title, "quiz")}`, row.title, row.category));
    return links.length ? `<section><h2>Live MCQ quizzes</h2><ul>${links.join("\n")}</ul></section>` : "";
  }
  if (section === "flashcards") {
    const rows = (await sbFetch("flashcard_sets", "select=id,title,slug,category&published=eq.true&deleted_at=is.null&order=updated_at.desc&limit=1000")) || [];
    const links = rows.filter(filterYear).map((row: Record<string, string>) => link(`/flashcards/${cleanPublicSlug(row.slug, row.title, "flashcards")}`, row.title, row.category));
    return links.length ? `<section><h2>Live flashcards</h2><ul>${links.join("\n")}</ul></section>` : "";
  }
  if (section === "stories") {
    const rows = (await sbFetch("stories", "select=id,title,slug,category&published=eq.true&deleted_at=is.null&order=created_at.desc&limit=1000")) || [];
    const links = rows.map((row: Record<string, string>) => link(`/stories/${row.id}-${cleanPublicSlug(row.slug, row.title, "story")}`, row.title, row.category));
    return links.length ? `<section><h2>Live stories</h2><ul>${links.join("\n")}</ul></section>` : "";
  }
  return "";
}

async function fetchEssayByIdOrSlug(param: string) {
  const cols = "id,slug,title,category,created_at";
  const decoded = decodeURIComponent(param).trim();

  const bySlug = await sbFetch(
    "essays",
    `select=${cols}&slug=eq.${encodeURIComponent(decoded)}&published=eq.true&deleted_at=is.null&limit=1`
  );
  if (bySlug && bySlug.length > 0) return bySlug[0];

  const byId = await sbFetch(
    "essays",
    `select=${cols}&id=eq.${encodeURIComponent(decoded)}&published=eq.true&deleted_at=is.null&limit=1`
  );
  return byId && byId.length > 0 ? byId[0] : null;
}

async function fetchStoryByParam(param: string) {
  const storyId = extractUuidFromParam(param);
  if (!storyId) return null;
  const cols = "id,title,content,category,cover_image_url,created_at";
  const rows = await sbFetch(
    "stories",
    `select=${cols}&id=eq.${encodeURIComponent(storyId)}&published=eq.true&deleted_at=is.null&limit=1`
  );
  return rows && rows.length > 0 ? rows[0] : null;
}

interface ParsedQuestion {
  stem: string;
  options: string[];
  correctText: string;
  explanation: string;
}

function parseQuestion(q: unknown): ParsedQuestion | null {
  if (!q || typeof q !== "object") return null;
  const obj = q as Record<string, unknown>;

  const rawStem =
    (typeof obj.question === "string" ? obj.question : "") ||
    (typeof obj.stem === "string" ? obj.stem : "") ||
    (typeof obj.text === "string" ? obj.text : "") ||
    (typeof obj.q === "string" ? obj.q : "");
  const stem = cleanQuestionStem(rawStem);
  if (!stem) return null;

  const rawExplanation =
    typeof obj.explanation === "string" ? obj.explanation.trim() : "";
  const explanationPrefix = rawExplanation.slice(0, 30).toLowerCase();

  const options: string[] = [];
  if (Array.isArray(obj.options)) {
    for (const o of obj.options) {
      let raw = "";
      if (typeof o === "string") raw = o;
      else if (o && typeof o === "object") {
        const oo = o as Record<string, unknown>;
        raw =
          (typeof oo.text === "string" ? oo.text : "") ||
          (typeof oo.label === "string" ? oo.label : "");
      }
      if (!raw) continue;
      if (explanationPrefix && raw.trim().toLowerCase().startsWith(explanationPrefix)) continue;
      const cleaned = cleanOption(raw);
      if (!cleaned || cleaned.length < 3) continue;
      options.push(cleaned);
    }
  }

  const correctIdx =
    typeof obj.correct_answer === "number"
      ? obj.correct_answer
      : typeof obj.correct === "number"
      ? obj.correct
      : typeof obj.correctIndex === "number"
      ? obj.correctIndex
      : typeof obj.answer === "number"
      ? obj.answer
      : -1;

  const correctText =
    typeof obj.correctAnswer === "string"
      ? cleanOption(obj.correctAnswer)
      : correctIdx >= 0 && options[correctIdx]
      ? options[correctIdx]
      : options[0] || "";

  const explanation =
    typeof obj.explanation === "string"
      ? cleanForMetaSnippet(obj.explanation)
      : "";

  return { stem, options, correctText, explanation };
}

function getCardFront(c: unknown): string {
  if (!c || typeof c !== "object") return "";
  const obj = c as Record<string, unknown>;
  const raw =
    (typeof obj.front === "string" ? obj.front : "") ||
    (typeof obj.question === "string" ? obj.question : "") ||
    (typeof obj.term === "string" ? obj.term : "") ||
    (typeof obj.q === "string" ? obj.q : "");
  return cleanForMetaSnippet(raw);
}

function getCardBack(c: unknown): string {
  if (!c || typeof c !== "object") return "";
  const obj = c as Record<string, unknown>;
  const raw =
    (typeof obj.back === "string" ? obj.back : "") ||
    (typeof obj.answer === "string" ? obj.answer : "") ||
    (typeof obj.definition === "string" ? obj.definition : "") ||
    (typeof obj.a === "string" ? obj.a : "");
  return cleanForMetaSnippet(raw);
}

function buildHtml(opts: {
  title: string;
  description: string;
  url: string;
  ogImage: string;
  keywords?: string;
  type?: string;
  schemaJson?: string;
  bodyExtra?: string;
}) {
  const title = htmlEscape(opts.title);
  const desc = htmlEscape(opts.description);
  const url = htmlEscape(opts.url);
  const img = htmlEscape(opts.ogImage);
  const keywords = opts.keywords ? htmlEscape(opts.keywords) : "";
  const type = opts.type || "website";

  const bodyExtra = opts.bodyExtra ? opts.bodyExtra.slice(0, 120000) : "";
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <meta name="description" content="${desc}" />
    ${keywords ? `<meta name="keywords" content="${keywords}" />` : ""}
    <link rel="canonical" href="${url}" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${desc}" />
    <meta property="og:type" content="${type}" />
    <meta property="og:url" content="${url}" />
    <meta property="og:image" content="${img}" />
    <meta property="og:site_name" content="OmpathStudy" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${desc}" />
    <meta name="twitter:image" content="${img}" />
    ${opts.schemaJson ? `<script type="application/ld+json">${opts.schemaJson}</script>` : ""}
  </head>
  <body>
    <h1>${title}</h1>
    <p>${desc}</p>
    ${bodyExtra}
    <nav aria-label="Site links"><a href="/">Home</a> <a href="/blog">Study notes</a> <a href="/mcqs">MCQs</a> <a href="/flashcards">Flashcards</a> <a href="/exams">Exams</a> <a href="/stories">Stories</a></nav>
    <a href="${url}">View on OmpathStudy</a>
  </body>
</html>`;
}

function permanentRedirect(path: string): Response {
  return new Response(null, {
    status: 301,
    headers: {
      location: `https://www.ompathstudy.com${path}`,
      "cache-control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}

export default async function handler(req: Request): Promise<Response> {
  const ua = req.headers.get("user-agent");
  const url = new URL(req.url);
  const originalPath = url.searchParams.get("path") || "/";

  if (!isCrawler(ua)) {
    // Legacy UUID / UUID-prefixed detail URLs must collapse to the single
    // canonical slug path for EVERY client, not just crawlers. A client-side
    // replaceState in the SPA is invisible to Google, so those URLs used to
    // stay in the index as duplicates.
    const legacyParts = originalPath.split("?")[0].split("/").filter(Boolean);
    const legacySection = legacyParts[0] || "";
    const legacyParam = legacyParts[1] || "";
    if (
      ["blog", "mcqs", "flashcards"].includes(legacySection) &&
      extractUuidFromParam(legacyParam)
    ) {
      const target = await resolveCanonicalDetailPath(legacySection, legacyParam);
      if (target && target !== `/${legacySection}/${legacyParam}`) {
        return permanentRedirect(target);
      }
      // Never fall through to the 307 below for a legacy UUID URL — that
      // would bounce back into this same handler and loop.
      return permanentRedirect(`/${legacySection}`);
    }
    return Response.redirect(new URL(originalPath, url.origin).toString(), 307);
  }

  try {
    const origin = "https://www.ompathstudy.com";
    const absoluteUrl = `${origin}${originalPath.split("?")[0]}`;
    const parts = originalPath.split("?")[0].split("/").filter(Boolean);
    const section = parts[0] || "";
    const param = parts[1] || "";

    let title = "OmpathStudy | Medical Notes, MCQs & Exams";
    let description =
      "OmpathStudy helps medical and health students study smarter with notes, flashcards, MCQs and exams by year and unit.";
    let ogImage = OG_FALLBACK_IMAGE;
    let keywords =
      "OmpathStudy, medical students Kenya, nursing students Kenya, clinical notes, MCQs, flashcards, exam preparation, medical education Kenya";
    let type = "website";
    let schemaJson = "";
    let bodyExtra = "";

    if (STATIC_PAGE_META[originalPath.split("?")[0]]) {
      const page = STATIC_PAGE_META[originalPath.split("?")[0]];
      title = page.title;
      description = page.description;
      keywords = `OmpathStudy, medical notes Kenya, MCQs, flashcards, exams, MBChB revision`;
      type = "website";
      bodyExtra = `<section><h2>Study resources</h2><p>OmpathStudy provides structured medical learning resources for MBChB and health students across Kenya and East Africa. The public study library includes concise clinical notes, pathology guides, pharmacology revision, anatomy summaries, physiology explanations, microbiology material, active-recall flashcards, practice MCQs and timed exam-style revision. Content is organised by academic year and unit so students can move directly from a year hub to the relevant articles, question banks, flashcards and exam practice.</p><p>Use these links to navigate to live indexable pages without redirects.</p><nav aria-label="Core pages">${page.links.map((path) => `<a href="${path}">${path === "/" ? "Home" : path.replace(/^\//, "")}</a>`).join(" ")}</nav></section>`;
    } else if (!param && ["blog", "mcqs", "flashcards", "stories", "exams"].includes(section)) {
      const pages: Record<string, { title: string; description: string; keywords: string }> = {
        blog: {
          title: "Medical Study Notes | OmpathStudy Kenya",
          description: "Browse free medical study notes in pathology, pharmacology, anatomy, physiology, microbiology and biochemistry for Kenyan and East African students.",
          keywords: "OmpathStudy, medical notes Kenya, MBChB notes, pathology notes, pharmacology notes, anatomy notes",
        },
        mcqs: {
          title: "Medical MCQs with Answers | OmpathStudy Kenya",
          description: "Practice medical MCQs with answers and explanations by year and unit. Built for Kenyan and East African medical students.",
          keywords: "OmpathStudy, MCQs Kenya, medical quizzes, MBChB questions, exam practice",
        },
        flashcards: {
          title: "Medical Flashcards | OmpathStudy Kenya",
          description: "Study active-recall medical flashcards by year and unit for fast exam revision across pathology, pharmacology, anatomy and more.",
          keywords: "OmpathStudy, flashcards Kenya, medical flashcards, active recall, exam revision",
        },
        stories: {
          title: "Medical School Stories | OmpathStudy Kenya",
          description: "Read reflective medical school stories and student experiences from Kenya and East Africa.",
          keywords: "OmpathStudy, medical stories, medical students Kenya, reflective practice",
        },
        exams: {
          title: "Timed Medical Exams | OmpathStudy Kenya",
          description: "Take timed medical exams and past-paper style MCQ practice for MBChB revision by year and unit.",
          keywords: "OmpathStudy, medical exams Kenya, timed exams, MBChB past papers, exam practice",
        },
      };
      title = pages[section].title;
      description = pages[section].description;
      keywords = pages[section].keywords;
      bodyExtra = await buildLiveIndexLinks(section);
    } else if (section === "contests" && param) {
      const rows = await sbFetch("contests", `select=slug,title,subtitle,share_image_url,starts_at&slug=eq.${encodeURIComponent(param)}&published=eq.true&limit=1`);
      const contest = rows?.[0];
      if (!contest) return permanentRedirect("/contests");
      title = `${contest.title} | OmpathStudy`;
      description = toMetaDescription(contest.subtitle || "Register for this live medical knowledge contest.", "Register for this OmpathStudy live medical knowledge contest.");
      ogImage = contest.share_image_url || OG_FALLBACK_IMAGE;
      keywords = `OmpathStudy, medical contest Kenya, ${contest.title}, live exam competition`;
      type = "website";
    } else if (section === "blog" && param) {
      const article = await fetchArticleBySlug(param);
      if (!article) {
        return permanentRedirect(await closestLivePath("articles", param, "/blog", "article"));
      }
      // The requested param may be a stale/UUID/near-match variant of this
      // article's slug. Always 301 to the article's own true canonical path
      // instead of declaring the requested URL canonical — otherwise every
      // variant self-canonicalizes and Google has to guess which one is real.
      const canonicalBlogPath = `/blog/${cleanPublicSlug(article.slug, article.title, "article")}`;
      if (canonicalBlogPath !== `/blog/${param}`) {
        return permanentRedirect(canonicalBlogPath);
      }
      const rawTitle = article.meta_title && !(article.meta_title.length >= 58 && String(article.title || "").startsWith(article.meta_title))
        ? article.meta_title
        : article.title;
      const cleanDesc = articleDescription(article);

      title = toMetaTitle(rawTitle, article.title);
      description = cleanDesc;
      ogImage = article.og_image_url || OG_FALLBACK_IMAGE;
      keywords = `OmpathStudy, study notes Kenya, medical notes, ${article.title || ""}, ${article.category || ""}, clinical revision, exam prep, ${GEO_KEYWORDS}`;
      type = "article";
      schemaJson = JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Article",
        headline: title,
        description,
        image: ogImage,
        url: absoluteUrl,
        datePublished: article.created_at,
        dateModified: article.updated_at || article.created_at,
        author: { "@type": "Organization", name: "OmpathStudy" },
        publisher: { "@type": "Organization", name: "OmpathStudy", logo: { "@type": "ImageObject", url: OG_FALLBACK_IMAGE } },
      });
      if (article.content) {
        bodyExtra = `<div>${htmlEscape(cleanForMetaSnippet(article.content).slice(0, 5000))}</div>`;
      }

    } else if (section === "mcqs" && param) {
      const mcq = await fetchMcqSetBySlugOrId(param);
      if (!mcq) {
        return permanentRedirect(await closestLivePath("mcq_sets", param, "/mcqs", "quiz"));
      }
      const canonicalMcqPath = `/mcqs/${cleanPublicSlug(mcq.slug, mcq.title, "quiz")}`;
      if (canonicalMcqPath !== `/mcqs/${param}`) {
        return permanentRedirect(canonicalMcqPath);
      }
      const rawQuestions: unknown[] = Array.isArray(mcq.questions) ? mcq.questions : [];
      const parsed = rawQuestions.map(parseQuestion).filter((p): p is ParsedQuestion => p !== null);
      const qCount = rawQuestions.length;

      title = toMetaTitle(mcq.meta_title || `${mcq.title} MCQs`, mcq.title);
      description = toMetaDescription(
        mcq.meta_description || `Practice ${qCount > 0 ? qCount + " " : ""}MCQs on ${mcq.title}. Review answers, explanations and exam-focused clinical concepts.`,
        `Practice ${qCount > 0 ? qCount + " " : ""}MCQs on ${mcq.title}. Review answers, explanations and exam-focused clinical concepts.`
      );
      ogImage = OG_FALLBACK_IMAGE;
      keywords = `OmpathStudy, MCQs Kenya, ${mcq.title || ""}, ${mcq.category || ""}, oncology MCQs, pathology MCQs, medical quizzes, exam practice, ${GEO_KEYWORDS}`;
      type = "article";

      if (parsed.length > 0) {
        const items = parsed.map((p, i) => {
          const optionsList = p.options.length > 0
            ? `<ul>${p.options.map(o => `<li>${htmlEscape(o)}</li>`).join("")}</ul>`
            : "";
          const answerLine = p.correctText
            ? `<p><strong>Answer:</strong> ${htmlEscape(p.correctText)}</p>`
            : "";
          const explanationLine = p.explanation
            ? `<p><strong>Explanation:</strong> ${htmlEscape(p.explanation)}</p>`
            : "";
          return `<li>
<p><strong>Q${i + 1}.</strong> ${htmlEscape(p.stem)}</p>
${optionsList}
${answerLine}
${explanationLine}
</li>`;
        });
        bodyExtra = `<h2>Questions, Answers &amp; Explanations</h2>\n<ol>\n${items.join("\n")}\n</ol>`;
      }

      const schemaQuestions = parsed.slice(0, 50).map((p) => {
        const item: Record<string, unknown> = {
          "@type": "Question",
          name: p.stem,
        };
        if (p.correctText) {
          item.acceptedAnswer = {
            "@type": "Answer",
            text: p.correctText + (p.explanation ? " — " + p.explanation : ""),
          };
        }
        return item;
      });

      schemaJson = JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Quiz",
        name: title,
        description,
        url: absoluteUrl,
        datePublished: mcq.created_at,
        provider: { "@type": "Organization", name: "OmpathStudy" },
        ...(schemaQuestions.length > 0 ? { hasPart: schemaQuestions } : {}),
      });

    } else if (section === "flashcards" && param) {
      const set = await fetchFlashcardSetBySlugOrId(param);
      if (!set) {
        return permanentRedirect(await closestLivePath("flashcard_sets", param, "/flashcards", "flashcards"));
      }
      const canonicalFlashcardPath = `/flashcards/${cleanPublicSlug(set.slug, set.title, "flashcards")}`;
      if (canonicalFlashcardPath !== `/flashcards/${param}`) {
        return permanentRedirect(canonicalFlashcardPath);
      }
      const cards: unknown[] = Array.isArray(set.cards) ? set.cards : [];
      const cardCount = cards.length;

      title = `${set.title} | Flashcards | OmpathStudy Kenya`;
      description = to160(
        `Study ${cardCount > 0 ? cardCount + " " : ""}flashcards on ${set.title} with OmpathStudy. Quick, focused revision for Kenyan medical and health students by unit and year.`
      );
      ogImage = OG_FALLBACK_IMAGE;
      keywords = `OmpathStudy, flashcards Kenya, ${set.category || ""}, medical revision, nursing revision, exam prep, medical education Kenya`;
      type = "article";

      const cardItems = cards.map((c, i) => {
        const front = getCardFront(c);
        const back = getCardBack(c);
        if (!front) return "";
        const backLine = back ? `<p><strong>Answer:</strong> ${htmlEscape(back)}</p>` : "";
        return `<li><p><strong>Q${i + 1}.</strong> ${htmlEscape(front)}</p>${backLine}</li>`;
      }).filter(Boolean);

      if (cardItems.length > 0) {
        bodyExtra = `<h2>Flashcards</h2>\n<ol>\n${cardItems.join("\n")}\n</ol>`;
      }

    } else if (section === "exams" && param) {
      const examId = param.replace(/\/start$/, "");
      const exam = await fetchMcqSetBySlugOrId(examId);
      if (exam) {
        const qCount = Array.isArray(exam.questions) ? exam.questions.length : 0;
        title = `${exam.title} | Timed Exam | OmpathStudy Kenya`;
        description = `Take a timed ${qCount}-question MCQ exam on ${exam.title} with OmpathStudy. Built for Kenyan medical and health students.`;
        keywords = `OmpathStudy, timed exam Kenya, MCQ exam, ${exam.category || ""}, medical exams Kenya, exam preparation`;
        schemaJson = JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Quiz",
          name: title,
          description,
          url: absoluteUrl,
          provider: { "@type": "Organization", name: "OmpathStudy" },
        });
        bodyExtra = `<p>Timed exam with ${qCount} MCQs. Unit: ${exam.category || "General"}. Available to Kenyan health students on OmpathStudy.</p>`;
      }

    } else if (section === "essays" && param) {
      return permanentRedirect("/blog");

    } else if (section === "stories" && param) {
      const story = await fetchStoryByParam(param);
      if (!story) {
        return new Response(
          `<html><body><h1>Page not found</h1><p>This story does not exist.</p></body></html>`,
          { status: 404, headers: { "content-type": "text/html" } }
        );
      }
      const canonicalStoryPath = `/stories/${story.id}-${slugify(story.title) || "story"}`;
      if (canonicalStoryPath !== `/stories/${param}`) {
        return permanentRedirect(canonicalStoryPath);
      }
      title = `${story.title} | Story | OmpathStudy Kenya`;
      description =
        to160(story.content || "") ||
        "Read a medical story on OmpathStudy — built for Kenyan medical and health students to learn, reflect, and grow.";
      ogImage = story.cover_image_url || OG_FALLBACK_IMAGE;
      keywords = `OmpathStudy, medical stories, reflective practice, ${story.category || ""}, medical students Kenya`;
      type = "article";

    } else if (section === "year" && param) {
      const yr = param.replace(/[^0-9]/g, "");
      title = `Year ${yr} Study Materials | OmpathStudy Kenya`;
      description = `Browse Year ${yr} medical study notes, flashcards, MCQs, and exams on OmpathStudy for Kenyan health students.`;
      keywords = `OmpathStudy, Year ${yr} medical, Kenya medical students, clinical notes Year ${yr}`;
      bodyExtra = `<section><h2>Year ${yr} resources</h2><p>Year ${yr} on OmpathStudy brings together medical notes, MCQs, flashcards and timed exam practice for students revising by academic year and unit. The page links directly to study notes, practice questions, active-recall cards and exams so crawlers and students can discover the relevant live sections without passing through redirects.</p><nav aria-label="Year ${yr} sections"><a href="/blog?year=Year%20${yr}">Year ${yr} notes</a> <a href="/mcqs?year=Year%20${yr}">Year ${yr} MCQs</a> <a href="/flashcards?year=Year%20${yr}">Year ${yr} flashcards</a> <a href="/exams?year=Year%20${yr}">Year ${yr} exams</a></nav></section>${await buildLiveIndexLinks("year", yr)}`;
    }

    const html = buildHtml({
      title,
      description,
      url: absoluteUrl,
      ogImage,
      keywords,
      type,
      schemaJson,
      bodyExtra,
    });

    return new Response(html, {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "public, max-age=300, stale-while-revalidate=60",
      },
    });
  } catch (err) {
    // Never return 5XX to crawlers — soft-redirect to the section root so
    // pages are removed/consolidated cleanly in Google + Ahrefs reports.
    const safeSection = (() => {
      const seg = (new URL(req.url).searchParams.get("path") || "/").split("?")[0].split("/").filter(Boolean)[0] || "";
      if (["blog", "mcqs", "flashcards", "stories", "exams"].includes(seg)) return `/${seg}`;
      return "/";
    })();
    console.error("og-meta soft-redirect:", err instanceof Error ? err.message : String(err));
    return permanentRedirect(safeSection);
  }
}
