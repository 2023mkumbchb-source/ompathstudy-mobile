/**
 * Offline Image Caching Subsystem
 *
 * Automatically downloads and stores diagrams, photographs, and figures locally
 * in the browser CacheStorage and IndexedDB so students can study visual banks
 * (such as the Aponeurosis Year 1 & 2 Anatomy Spot Bank) without an active internet connection.
 */

const CACHE_NAME = "ompath-offline-images-v1";
const DB_NAME = "ompath_image_db";
const STORE_NAME = "images";

// In-memory registry of active object URLs created from blobs
const memoryBlobUrls = new Map<string, string>();

let idbPromise: Promise<IDBDatabase> | null = null;

function openImageDb(): Promise<IDBDatabase> {
  if (idbPromise) return idbPromise;
  idbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof window === "undefined" || !("indexedDB" in window)) {
      return reject(new Error("IndexedDB not available"));
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return idbPromise;
}

/**
 * Checks whether an image is cached locally in CacheStorage or IndexedDB.
 * If cached, returns a local object URL (blob:...) or data URL for offline display.
 */
export async function getCachedImageUrl(originalUrl: string): Promise<string | null> {
  if (!originalUrl) return null;
  const cleanUrl = originalUrl.trim();

  // If already a local blob/data URL, return directly
  if (cleanUrl.startsWith("blob:") || cleanUrl.startsWith("data:")) {
    return cleanUrl;
  }

  // Check memory map first
  if (memoryBlobUrls.has(cleanUrl)) {
    return memoryBlobUrls.get(cleanUrl)!;
  }

  // 1. Try CacheStorage API
  if (typeof window !== "undefined" && "caches" in window) {
    try {
      const cache = await caches.open(CACHE_NAME);
      const match = await cache.match(cleanUrl);
      if (match) {
        const blob = await match.blob();
        const objUrl = URL.createObjectURL(blob);
        memoryBlobUrls.set(cleanUrl, objUrl);
        return objUrl;
      }
    } catch {
      // Fall through to IndexedDB
    }
  }

  // 2. Try IndexedDB fallback
  try {
    const db = await openImageDb();
    return new Promise<string | null>((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(cleanUrl);
      req.onsuccess = () => {
        const blob = req.result;
        if (blob instanceof Blob) {
          const objUrl = URL.createObjectURL(blob);
          memoryBlobUrls.set(cleanUrl, objUrl);
          resolve(objUrl);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/**
 * Downloads and stores a single image in both CacheStorage and IndexedDB.
 */
export async function cacheSingleImage(url: string): Promise<boolean> {
  if (!url || typeof window === "undefined") return false;
  const cleanUrl = url.trim();
  if (cleanUrl.startsWith("blob:") || cleanUrl.startsWith("data:")) return true;

  try {
    const res = await fetch(cleanUrl, { mode: "cors" });
    if (!res.ok) return false;
    const blob = await res.blob();

    // 1. Save to CacheStorage
    if ("caches" in window) {
      try {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(cleanUrl, new Response(blob.slice(), {
          headers: {
            "Content-Type": blob.type || "image/jpeg",
            "Cache-Control": "public, max-age=31536000",
          },
        }));
      } catch (e) {
        // Cache API put might fail on some schemes, fallback to IndexedDB
      }
    }

    // 2. Save to IndexedDB
    try {
      const db = await openImageDb();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        store.put(blob, cleanUrl);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (e) {
      // ignore
    }

    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Extracts all unique image URLs from markdown and HTML content.
 */
export function extractImageUrls(content: string): string[] {
  if (!content) return [];
  const urls = new Set<string>();

  // Markdown ![alt](url)
  const mdMatches = content.matchAll(/!\[[^\]]*\]\((https?:\/\/[^\s)]+)\)/g);
  for (const m of mdMatches) {
    urls.add(m[1].trim());
  }

  // HTML <img src="url">
  const htmlMatches = content.matchAll(/<img[^>]+src=["'](https?:\/\/[^"']+)["']/gi);
  for (const m of htmlMatches) {
    urls.add(m[1].trim());
  }

  return Array.from(urls);
}

/** Collect every remote image referenced by a stored article, including covers. */
export function extractArticleImageUrls(article: Record<string, unknown>): string[] {
  const urls = new Set<string>();
  for (const field of ["featured_image", "og_image_url", "cover_image", "cover_image_url", "thumbnail_url", "image_url"]) {
    const value = article[field];
    if (typeof value === "string" && /^https?:\/\//i.test(value.trim())) urls.add(value.trim());
  }
  for (const field of ["content", "body", "description"]) {
    const value = article[field];
    if (typeof value === "string") extractImageUrls(value).forEach((url) => urls.add(url));
  }
  return [...urls];
}

/** Cache every image referenced by every supplied published article. */
export async function cacheAllArticleImages(
  articles: Array<Record<string, unknown>>,
  onProgress?: (done: number, total: number) => void,
): Promise<{ cached: number; total: number }> {
  const urls = articles.flatMap(extractArticleImageUrls);
  return cacheImageBatch(urls, 4, onProgress);
}

/**
 * Concurrently caches a batch of image URLs with concurrency limit.
 */
export async function cacheImageBatch(
  urls: string[],
  concurrency = 4,
  onProgress?: (done: number, total: number) => void
): Promise<{ cached: number; total: number }> {
  const uniqueUrls = Array.from(new Set(urls.filter(Boolean)));
  const total = uniqueUrls.length;
  let done = 0;
  let cached = 0;

  const queue = [...uniqueUrls];

  async function worker() {
    while (queue.length > 0) {
      const url = queue.shift();
      if (!url) break;
      const success = await cacheSingleImage(url);
      if (success) cached++;
      done++;
      onProgress?.(done, total);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, total) }, () => worker());
  await Promise.all(workers);

  return { cached, total };
}

/**
 * Specifically precaches all 381 Aponeurosis Year 1 and Year 2 anatomy,
 * histology, and embryology spot bank images so they load offline in airplane mode.
 */
export async function precacheAponeurosisImages(
  onProgress?: (done: number, total: number) => void
): Promise<{ cached: number; total: number }> {
  if (typeof window === "undefined" || !navigator.onLine) {
    return { cached: 0, total: 0 };
  }

  try {
    // 1. Fetch seed bundle to extract all Aponeurosis image URLs
    const res = await fetch("/offline-seed.json");
    if (!res.ok) return { cached: 0, total: 0 };
    const bundle = await res.json();
    const articles = (bundle.articles || []) as { title?: string; category?: string; content?: string }[];

    const aponeurosisArticles = articles.filter((a) =>
      /aponeurosis/i.test(`${a.title || ""} ${a.category || ""}`)
    );

    const imageUrls: string[] = [];
    for (const a of aponeurosisArticles) {
      imageUrls.push(...extractImageUrls(a.content || ""));
    }

    console.log(`[OmpathStudy] Found ${imageUrls.length} Aponeurosis images to precache offline.`);
    return await cacheImageBatch(imageUrls, 5, onProgress);
  } catch (err) {
    console.warn("[OmpathStudy] Failed to precache Aponeurosis images:", err);
    return { cached: 0, total: 0 };
  }
}
