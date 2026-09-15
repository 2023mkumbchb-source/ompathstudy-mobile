import { useEffect, useState } from "react";

const CACHE_KEY = "ompath_topic_thumb_cache_v3";
const NEG_TTL = 1000 * 60 * 60 * 24 * 7;
export type TopicThumbnail = { url: string; pageUrl: string; credit: string; license: string };
type CacheEntry = { image: TopicThumbnail | null; ts: number };
type Cache = Record<string, CacheEntry>;

function readCache(): Cache { try { return JSON.parse(localStorage.getItem(CACHE_KEY) || "{}"); } catch { return {}; } }
function writeCache(cache: Cache) { try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch { /* quota */ } }

const STOP = new Set([
  "year","unit","mcq","mcqs","study","notes","introduction","basic","advanced","clinical","review","quiz","exam","examination","paper","past","bank","course","outline","questions","answers","answer","guide","part","section","complete","comprehensive","medical","student","students","must","know","high","yield","the","and","of","in","to","for","with","from","an","a","on","by","at",
]);

function hash(value: string): number {
  let result = 2166136261;
  for (let i = 0; i < value.length; i++) result = Math.imul(result ^ value.charCodeAt(i), 16777619);
  return result >>> 0;
}

export function extractTopicKeyword(title: string, category?: string): string | null {
  const source = `${title || ""} ${category || ""}`.toLowerCase();
  const clinicalTopics: Array<[RegExp, string]> = [
    [/epidemiolog|public health|community health/, "epidemiology public health"],
    [/aponeurosis/, "aponeurosis anatomy"],
    [/cardiovascular|heart|cardiac/, "human heart anatomy"],
    [/respiratory|lung|pulmonary/, "human lung anatomy"],
    [/gastrointestinal|digestive|\bgit\b/, "human gastrointestinal anatomy"],
    [/renal|kidney|urinary/, "human kidney anatomy"],
    [/neurolog|brain|nervous system/, "brain anatomy"],
    [/hemat|blood/, "human blood cells microscopy"],
    [/bacter|microbiolog/, "medical bacteriology microscopy"],
    [/parasit|helminth|protozo/, "medical parasitology microscopy"],
    [/virolog|virus/, "medical virology microscopy"],
    [/mycolog|fung/, "medical mycology microscopy"],
    [/pharmac|drug/, "pharmacology medicine"],
    [/histolog|microscop/, "human histology microscopy"],
    [/embryolog|development/, "human embryology"],
    [/anatom/, "human anatomy"],
    [/physiolog/, "human physiology"],
    [/patholog|disease/, "histopathology"],
  ];
  const recognised = clinicalTopics.find(([pattern]) => pattern.test(source));
  if (recognised) return recognised[1];
  const cleaned = (title || "")
    .replace(/&(?:amp|nbsp);/gi, " ").replace(/\b(?:19|20)\d{2}\b/g, " ")
    .replace(/\b(?:MB[A-Z]{1,4}|HBC|UPC|VBC)\s*\d+[A-Z0-9-]*\b/gi, " ")
    .replace(/\b(?:part|set|section)\s*\d+(?:\s*of\s*\d+)?\b/gi, " ")
    .replace(/[^A-Za-z0-9 ]+/g, " ").toLowerCase();
  const words = cleaned.split(/\s+/).filter((word) => word.length > 2 && !STOP.has(word) && !/^\d+$/.test(word));
  if (words.length) return words.slice(0, 4).join(" ");
  return (category || "").replace(/^year\s*\d+\s*[:-]?\s*/i, "").trim() || null;
}

function stripMarkup(value: unknown): string {
  return String(value || "").replace(/<[^>]+>/g, " ").replace(/&[^;]+;/g, " ").replace(/\s+/g, " ").trim();
}

async function fetchCommonsThumb(query: string, identity: string): Promise<TopicThumbnail | null> {
  try {
    const params = new URLSearchParams({ action:"query", format:"json", origin:"*", generator:"search", gsrnamespace:"6", gsrsearch:`${query} medical`, gsrlimit:"12", prop:"imageinfo", iiprop:"url|extmetadata", iiurlwidth:"960" });
    const response = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`);
    if (!response.ok) return null;
    type CommonsMeta = { value?: string };
    type CommonsInfo = { thumburl?: string; url?: string; descriptionurl?: string; extmetadata?: Record<string, CommonsMeta> };
    type CommonsPage = { title?: string; imageinfo?: CommonsInfo[] };
    type CommonsResponse = { query?: { pages?: Record<string, CommonsPage> } };
    const json = await response.json() as CommonsResponse;
    const pages = Object.values(json.query?.pages || {});
    const candidates = pages.flatMap((page) => {
      const info = page.imageinfo?.[0];
      const url = info?.thumburl || info?.url;
      if (!url || /\.svg(?:\?|$)/i.test(url)) return [];
      const meta = info.extmetadata || {};
      const image = { url, pageUrl: info.descriptionurl || `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title || "")}`, credit: stripMarkup(meta.Artist?.value || meta.Credit?.value || "Wikimedia Commons"), license: stripMarkup(meta.LicenseShortName?.value || meta.UsageTerms?.value || "Free licence") } satisfies TopicThumbnail;
      const searchable = `${page.title || ""} ${stripMarkup(meta.ImageDescription?.value || "")}`.toLowerCase();
      const score = query.toLowerCase().split(/\s+/).filter(Boolean).reduce((total, token) => total + (searchable.includes(token) ? 3 : 0), 0)
        - (/logo|icon|map|building|portrait|book cover|exam paper/.test(searchable) ? 8 : 0);
      return [{ image, score }];
    });
    const relevant = candidates.filter((candidate) => candidate.score > 0).sort((a, b) => b.score - a.score);
    if (!relevant.length) return null;
    const bestScore = relevant[0].score;
    const best = relevant.filter((candidate) => candidate.score >= bestScore - 2).slice(0, 4);
    return best[hash(identity) % best.length].image;
  } catch { return null; }
}

export function isGenericThumbnail(url?: string | null): boolean {
  const value = (url || "").toLowerCase();
  if (!value || value.includes("og-default") || value.includes("placeholder") || value.startsWith("data:image/") || value.includes("encrypted-tbn0.gstatic.com") || value.includes("/functions/v1/topic-thumbnail?")) return true;
  return /\/articles\/(?:anatomy|physiology|pathology|general-pathology|microbiology|parasitology|immunology|pharmacology|genetics|molecular-biology|endocrine|clinical-biochem|chemical-pathology|communication|respiratory|gi-pathology|git-physiology|biochem-techniques)\.(?:jpe?g|png|webp)(?:\?|$)/i.test(value);
}

export async function getTopicThumbnailInfo(title: string, category?: string, preferredKeyword?: string | null): Promise<TopicThumbnail | null> {
  const query = preferredKeyword?.trim() || extractTopicKeyword(title, category);
  if (!query) return null;
  const key = `${query}|${title}`.toLowerCase();
  const cache = readCache();
  const hit = cache[key];
  if (hit && (hit.image || Date.now() - hit.ts < NEG_TTL)) return hit.image;
  const image = await fetchCommonsThumb(query, title);
  cache[key] = { image, ts: Date.now() }; writeCache(cache);
  return image;
}

export async function getTopicThumbnail(title: string, category?: string, preferredKeyword?: string | null): Promise<string | null> {
  return (await getTopicThumbnailInfo(title, category, preferredKeyword))?.url || null;
}

export function useTopicThumbnailInfo(title: string, category?: string, enabled = true, preferredKeyword?: string | null): TopicThumbnail | null {
  const [image, setImage] = useState<TopicThumbnail | null>(null);
  useEffect(() => {
    if (!enabled) { setImage(null); return; }
    let cancelled = false;
    getTopicThumbnailInfo(title, category, preferredKeyword).then((result) => { if (!cancelled) setImage(result); });
    return () => { cancelled = true; };
  }, [title, category, enabled, preferredKeyword]);
  return image;
}

export function useTopicThumbnail(title: string, category?: string, enabled = true, preferredKeyword?: string | null): string | null {
  return useTopicThumbnailInfo(title, category, enabled, preferredKeyword)?.url || null;
}
