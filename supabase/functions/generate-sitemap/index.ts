import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_BASE_URL = "https://www.ompathstudy.com";

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

function normalizeBaseUrl(url: string | null | undefined): string {
  const trimmed = String(url || "").trim();
  if (!trimmed) return DEFAULT_BASE_URL;
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  // Force canonical www host so sitemap entries match robots.txt + canonical tags.
  // Google rejects sitemap URLs that don't share the sitemap's hostname.
  const cleaned = withProtocol.replace(/\/+$/, "");
  try {
    const u = new URL(cleaned);
    if (/(^|\.)ompathstudy\.com$/i.test(u.hostname) && u.hostname.toLowerCase() !== "www.ompathstudy.com") {
      u.hostname = "www.ompathstudy.com";
    }
    u.protocol = "https:";
    return `${u.protocol}//${u.hostname}`;
  } catch {
    return cleaned;
  }
}

function escapeXml(str: string): string {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function extractFirstImage(content: string | null): string | null {
  if (!content) return null;
  const md = content.match(/!\[[^\]]*\]\((https?:\/\/[^\s)]+)\)/i);
  if (md) return md[1];
  const html = content.match(/<img[^>]+src=["'](https?:\/\/[^\s"']+)["'][^>]*>/i);
  return html ? html[1] : null;
}

/**
 * Every remote image inside an article body, with its caption/alt text.
 * Spot/slide-review notes are almost entirely images, so indexing each plate
 * is what makes them discoverable in Google Images.
 */
function extractContentImages(...sources: (string | null | undefined)[]): { loc: string; caption: string }[] {
  const out: { loc: string; caption: string }[] = [];
  const seen = new Set<string>();
  const add = (loc: string, caption: string) => {
    const url = (loc || "").trim();
    if (!url || !/^https?:\/\//i.test(url) || seen.has(url)) return;
    seen.add(url);
    out.push({ loc: url, caption: (caption || "").replace(/\s+/g, " ").trim() });
  };
  for (const content of sources) {
    if (!content) continue;
    for (const m of content.matchAll(/!\[([^\]]*)\]\(\s*<?(https?:\/\/[^\s)>]+)>?(?:\s+["'][^"']*["'])?\s*\)/gi)) add(m[2], m[1]);
    for (const m of content.matchAll(/<img\b[^>]*>/gi)) {
      const tag = m[0];
      const src = tag.match(/(?:src|data-src|data-lazy-src)=["'](https?:\/\/[^"']+)["']/i)?.[1] || "";
      const alt = tag.match(/alt=["']([^"']*)["']/i)?.[1] || "";
      add(src, alt);
      const srcset = tag.match(/(?:srcset|data-srcset)=["']([^"']+)["']/i)?.[1] || "";
      for (const candidate of srcset.split(",")) add(candidate.trim().split(/\s+/)[0], alt);
    }
  }
  return out.slice(0, 900); // Google caps at 1000 images per <url>
}

const EXCLUDED_PATHS = new Set<string>([
  "/sitemap.xml",
  "/sitemap-dynamic.xml",
  "/blog/victory-school-club-membership-system-project-guide",
]);

function sitemapFilterFromFile(file: string | null) {
  const f = String(file || "all.xml").toLowerCase();
  const year = f.match(/year-([1-6])/)?.[1] || null;
  const section = f.includes("blog") ? "blog"
    : f.includes("mcqs") ? "mcqs"
    : f.includes("flashcards") ? "flashcards"
    : f.includes("stories") ? "stories"
    : f.includes("pages") ? "pages"
    : "all";
  return { section, year };
}

function matchesYear(category: string | null | undefined, year: string | null) {
  if (!year) return true;
  return new RegExp(`^Year\\s+${year}\\s*:`, "i").test(String(category || ""));
}

async function fetchAllPublished(sb: any, table: string, select: string, orderColumn = "updated_at") {
  const rows: any[] = [];
  const batchSize = 1000;
  for (let from = 0; ; from += batchSize) {
    const { data, error } = await sb
      .from(table)
      .select(select)
      .eq("published", true)
      .is("deleted_at", null)
      .order(orderColumn, { ascending: false, nullsFirst: false })
      .range(from, from + batchSize - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < batchSize) break;
  }
  return rows;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestUrl = new URL(req.url);
    const filter = sitemapFilterFromFile(requestUrl.searchParams.get("file"));
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) throw new Error("Missing config");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: siteUrlSetting } = await supabase.from("app_settings").select("value").eq("key", "site_url").maybeSingle();
    const baseUrl = normalizeBaseUrl((siteUrlSetting as any)?.value);

    const [articles, mcqs, flashcards, stories] = await Promise.all([
      fetchAllPublished(supabase, "articles", "id, title, slug, created_at, updated_at, category, og_image_url, featured_image, content, original_notes"),
      fetchAllPublished(supabase, "mcq_sets", "id, title, slug, og_image_url, created_at, updated_at, category, questions"),
      fetchAllPublished(supabase, "flashcard_sets", "id, title, slug, created_at, updated_at, category, cards"),
      fetchAllPublished(supabase, "stories", "id, title, slug, created_at, category, cover_image_url", "created_at"),
    ]);

    const years = new Set<number>([1, 2, 3, 4, 5, 6]);
    [...(articles || []), ...(mcqs || []), ...(flashcards || [])].forEach((item: any) => {
      const m = (item.category || "").match(/^Year (\d)/);
      if (m) years.add(parseInt(m[1]));
    });

    const includePages = filter.section === "all" || filter.section === "pages";
    const includeBlog = filter.section === "all" || filter.section === "blog";
    const includeStories = filter.section === "all" || filter.section === "stories";
    const includeMcqs = filter.section === "all" || filter.section === "mcqs";
    const includeFlashcards = filter.section === "all" || filter.section === "flashcards";
    const emittedPaths = new Set<string>();
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
`;

    if (includePages) {
      [
        ["/", "1.0", "daily"],
        ["/blog", "0.9", "daily"],
        ["/stories", "0.8", "daily"],
        ["/flashcards", "0.8", "daily"],
        ["/mcqs", "0.8", "daily"],
        ["/exams", "0.8", "weekly"],
      ].forEach(([path, priority, changefreq]) => {
        emittedPaths.add(path);
        xml += `  <url><loc>${baseUrl}${path}</loc><priority>${priority}</priority><changefreq>${changefreq}</changefreq></url>\n`;
      });
    }

    for (const y of Array.from(years).sort()) {
      if (!includePages && filter.section !== "all") continue;
      const path = `/year/${y}`;
      emittedPaths.add(path);
      xml += `  <url><loc>${baseUrl}${path}</loc><priority>0.8</priority><changefreq>weekly</changefreq></url>\n`;
    }

    // Articles
    for (const a of (articles || []) as any[]) {
      if (!includeBlog || !matchesYear(a.category, filter.year)) continue;
      const articleSlug = cleanPublicSlug(a.slug, a.title, "article");
      const path = `/blog/${articleSlug}`;
      if (emittedPaths.has(path) || EXCLUDED_PATHS.has(path)) continue;
      emittedPaths.add(path);
      const lastmod = (a.updated_at || a.created_at) ? new Date(a.updated_at || a.created_at).toISOString().split("T")[0] : "";
      const imageUrl = a.og_image_url || a.featured_image || extractFirstImage(a.content) || extractFirstImage(a.original_notes) || null;
      const contentImages = extractContentImages(a.content, a.original_notes);
      xml += `  <url>\n    <loc>${baseUrl}${path}</loc>\n`;
      if (lastmod) xml += `    <lastmod>${lastmod}</lastmod>\n`;
      xml += `    <priority>0.7</priority>\n    <changefreq>weekly</changefreq>\n`;
      const emittedImages = new Set<string>();
      if (imageUrl) {
        emittedImages.add(imageUrl);
        xml += `    <image:image>\n      <image:loc>${escapeXml(imageUrl)}</image:loc>\n      <image:title>${escapeXml(a.title)}</image:title>\n    </image:image>\n`;
      }
      for (const img of contentImages) {
        if (emittedImages.has(img.loc)) continue;
        emittedImages.add(img.loc);
        xml += `    <image:image>\n      <image:loc>${escapeXml(img.loc)}</image:loc>\n      <image:title>${escapeXml(a.title)}</image:title>\n`;
        if (img.caption) xml += `      <image:caption>${escapeXml(img.caption)}</image:caption>\n`;
        xml += `    </image:image>\n`;
      }
      xml += `  </url>\n`;
    }

    // Stories
    for (const s of (stories || []) as any[]) {
      if (!includeStories) continue;
      const storySlug = cleanPublicSlug(s.slug, s.title, "story");
      const path = `/stories/${s.id}-${storySlug}`;
      if (emittedPaths.has(path) || EXCLUDED_PATHS.has(path)) continue;
      emittedPaths.add(path);
      const lastmod = s.created_at ? new Date(s.created_at).toISOString().split("T")[0] : "";
      const imageUrl = s.cover_image_url || null;
      xml += `  <url>\n    <loc>${baseUrl}${path}</loc>\n`;
      if (lastmod) xml += `    <lastmod>${lastmod}</lastmod>\n`;
      xml += `    <priority>0.7</priority>\n    <changefreq>weekly</changefreq>\n`;
      if (imageUrl) {
        xml += `    <image:image>\n      <image:loc>${escapeXml(imageUrl)}</image:loc>\n      <image:title>${escapeXml(s.title)}</image:title>\n    </image:image>\n`;
      }
      xml += `  </url>\n`;
    }

    // MCQs
    for (const m of (mcqs || []) as any[]) {
      if (!includeMcqs || !matchesYear(m.category, filter.year)) continue;
      if (!Array.isArray(m.questions) || m.questions.length < 5) continue;
      const mcqSlug = cleanPublicSlug(m.slug, m.title, "quiz");
      const path = `/mcqs/${mcqSlug}`;
      if (emittedPaths.has(path) || EXCLUDED_PATHS.has(path)) continue;
      emittedPaths.add(path);
      const lastmod = (m.updated_at || m.created_at) ? new Date(m.updated_at || m.created_at).toISOString().split("T")[0] : "";
      xml += `  <url>\n    <loc>${baseUrl}${path}</loc>\n`;
      if (lastmod) xml += `    <lastmod>${lastmod}</lastmod>\n`;
      xml += `    <priority>0.7</priority>\n    <changefreq>weekly</changefreq>\n`;
      if (m.og_image_url) {
        xml += `    <image:image>\n      <image:loc>${escapeXml(m.og_image_url)}</image:loc>\n      <image:title>${escapeXml(m.title)}</image:title>\n    </image:image>\n`;
      }
      xml += `  </url>\n`;
    }

    // Flashcards
    for (const f of (flashcards || []) as any[]) {
      if (!includeFlashcards || !matchesYear(f.category, filter.year)) continue;
      if (!Array.isArray(f.cards) || f.cards.length < 5) continue;
      const flashcardSlug = cleanPublicSlug(f.slug, f.title, "flashcards");
      const path = `/flashcards/${flashcardSlug}`;
      if (emittedPaths.has(path) || EXCLUDED_PATHS.has(path)) continue;
      emittedPaths.add(path);
      const lastmod = (f.updated_at || f.created_at) ? new Date(f.updated_at || f.created_at).toISOString().split("T")[0] : "";
      xml += `  <url>\n    <loc>${baseUrl}${path}</loc>\n`;
      if (lastmod) xml += `    <lastmod>${lastmod}</lastmod>\n`;
      xml += `    <priority>0.7</priority>\n    <changefreq>weekly</changefreq>\n`;
      xml += `  </url>\n`;
    }

    xml += `</urlset>`;

    return new Response(xml, {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
    });
  } catch (error: unknown) {
    console.error("Sitemap error:", error);
    return new Response(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${DEFAULT_BASE_URL}/</loc><priority>1.0</priority><changefreq>daily</changefreq></url>
  <url><loc>${DEFAULT_BASE_URL}/blog</loc><priority>0.9</priority><changefreq>daily</changefreq></url>
  <url><loc>${DEFAULT_BASE_URL}/mcqs</loc><priority>0.8</priority><changefreq>daily</changefreq></url>
  <url><loc>${DEFAULT_BASE_URL}/flashcards</loc><priority>0.8</priority><changefreq>daily</changefreq></url>
  <url><loc>${DEFAULT_BASE_URL}/exams</loc><priority>0.8</priority><changefreq>weekly</changefreq></url>
  <url><loc>${DEFAULT_BASE_URL}/stories</loc><priority>0.8</priority><changefreq>daily</changefreq></url>
  <url><loc>${DEFAULT_BASE_URL}/year/1</loc><priority>0.8</priority><changefreq>weekly</changefreq></url>
  <url><loc>${DEFAULT_BASE_URL}/year/2</loc><priority>0.8</priority><changefreq>weekly</changefreq></url>
  <url><loc>${DEFAULT_BASE_URL}/year/3</loc><priority>0.8</priority><changefreq>weekly</changefreq></url>
  <url><loc>${DEFAULT_BASE_URL}/year/4</loc><priority>0.8</priority><changefreq>weekly</changefreq></url>
  <url><loc>${DEFAULT_BASE_URL}/year/5</loc><priority>0.8</priority><changefreq>weekly</changefreq></url>
  <url><loc>${DEFAULT_BASE_URL}/year/6</loc><priority>0.8</priority><changefreq>weekly</changefreq></url>
</urlset>`, {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600" },
    });
  }
});
