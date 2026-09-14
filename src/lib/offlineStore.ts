import type { Article, FlashcardSet, McqSet } from "./store";
import { supabase } from "@/integrations/supabase/client";

const DB_NAME = "ompath_offline_db";
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

export function openOfflineDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof window === "undefined" || !("indexedDB" in window)) {
      return reject(new Error("IndexedDB is not supported in this environment."));
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // 1. Articles store
      if (!db.objectStoreNames.contains("articles")) {
        const articleStore = db.createObjectStore("articles", { keyPath: "id" });
        articleStore.createIndex("slug", "slug", { unique: false });
        articleStore.createIndex("category", "category", { unique: false });
        articleStore.createIndex("updated_at", "updated_at", { unique: false });
      }

      // 2. Article summaries store (for list browsing)
      if (!db.objectStoreNames.contains("article_summaries")) {
        const summaryStore = db.createObjectStore("article_summaries", { keyPath: "id" });
        summaryStore.createIndex("category", "category", { unique: false });
      }

      // 3. MCQ sets store
      if (!db.objectStoreNames.contains("mcq_sets")) {
        const mcqStore = db.createObjectStore("mcq_sets", { keyPath: "id" });
        mcqStore.createIndex("category", "category", { unique: false });
      }

      // 4. Flashcard sets store
      if (!db.objectStoreNames.contains("flashcard_sets")) {
        const flashcardStore = db.createObjectStore("flashcard_sets", { keyPath: "id" });
        flashcardStore.createIndex("category", "category", { unique: false });
      }

      // 5. Metadata / Sync state store
      if (!db.objectStoreNames.contains("sync_state")) {
        db.createObjectStore("sync_state", { keyPath: "key" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return dbPromise;
}

// ── Generic IDB helper ──
async function withStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => Promise<T> | T
): Promise<T> {
  const db = await openOfflineDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);

    let result: any;
    try {
      result = action(store);
    } catch (err) {
      reject(err);
      return;
    }

    if (result instanceof Promise) {
      result.then(resolve).catch(reject);
    } else {
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error);
    }
  });
}

// ── Article Offline Operations ──

export async function saveArticleOffline(article: Article): Promise<void> {
  if (!article || !article.id) return;
  try {
    await withStore("articles", "readwrite", (store) => {
      store.put(article);
    });
  } catch (err) {
    console.warn("Failed to save article offline:", err);
  }
}

export async function saveArticlesOffline(articles: Article[]): Promise<number> {
  if (!articles || !articles.length) return 0;
  const db = await openOfflineDb();
  return new Promise<number>((resolve, reject) => {
    const tx = db.transaction("articles", "readwrite");
    const store = tx.objectStore("articles");
    let count = 0;
    for (const a of articles) {
      if (a?.id) {
        store.put(a);
        count++;
      }
    }
    tx.oncomplete = () => resolve(count);
    tx.onerror = () => reject(tx.error);
  });
}

export async function getArticleOfflineBySlugOrId(slugOrId: string): Promise<Article | null> {
  if (!slugOrId) return null;
  const normalized = decodeURIComponent(String(slugOrId).trim().toLowerCase());

  try {
    const db = await openOfflineDb();
    return new Promise<Article | null>((resolve) => {
      const tx = db.transaction("articles", "readonly");
      const store = tx.objectStore("articles");

      // First check direct ID
      const idReq = store.get(slugOrId);
      idReq.onsuccess = () => {
        if (idReq.result) {
          return resolve(idReq.result as Article);
        }

        // Try lowercase ID
        const idLowerReq = store.get(normalized);
        idLowerReq.onsuccess = () => {
          if (idLowerReq.result) {
            return resolve(idLowerReq.result as Article);
          }

          // Search by slug index
          const slugIdx = store.index("slug");
          const slugReq = slugIdx.get(normalized);
          slugReq.onsuccess = () => {
            if (slugReq.result) {
              return resolve(slugReq.result as Article);
            }

            // Fallback: cursor scan for match or prefix match
            const cursorReq = store.openCursor();
            cursorReq.onsuccess = () => {
              const cursor = cursorReq.result;
              if (cursor) {
                const item = cursor.value as Article;
                const itemSlug = (item.slug || "").toLowerCase();
                if (
                  itemSlug === normalized ||
                  itemSlug.endsWith(`-${normalized}`) ||
                  item.title?.toLowerCase() === normalized
                ) {
                  return resolve(item);
                }
                cursor.continue();
              } else {
                resolve(null);
              }
            };
            cursorReq.onerror = () => resolve(null);
          };
          slugReq.onerror = () => resolve(null);
        };
        idLowerReq.onerror = () => resolve(null);
      };
      idReq.onerror = () => resolve(null);
    });
  } catch (err) {
    console.warn("Offline article lookup failed:", err);
    return null;
  }
}

// ── Article Summaries Offline Operations ──

export async function saveSummariesOffline(summaries: Article[]): Promise<void> {
  if (!summaries || !summaries.length) return;
  const db = await openOfflineDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction("article_summaries", "readwrite");
    const store = tx.objectStore("article_summaries");
    for (const s of summaries) {
      if (s?.id) store.put(s);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getSummariesOffline(year?: string): Promise<Article[]> {
  try {
    const db = await openOfflineDb();
    return new Promise<Article[]>((resolve) => {
      const tx = db.transaction("article_summaries", "readonly");
      const store = tx.objectStore("article_summaries");
      const req = store.getAll();
      req.onsuccess = () => {
        let list = (req.result || []) as Article[];
        if (year && /^Year [1-6]$/.test(year)) {
          list = list.filter((a) => (a.category || "").startsWith(`${year}:`));
        }
        resolve(list);
      };
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

// ── Flashcard Sets Offline Operations ──

export async function saveFlashcardSetsOffline(sets: FlashcardSet[]): Promise<void> {
  if (!sets || !sets.length) return;
  const db = await openOfflineDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction("flashcard_sets", "readwrite");
    const store = tx.objectStore("flashcard_sets");
    for (const s of sets) {
      if (s?.id) store.put(s);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getFlashcardSetsOffline(): Promise<FlashcardSet[]> {
  try {
    const db = await openOfflineDb();
    return new Promise<FlashcardSet[]>((resolve) => {
      const tx = db.transaction("flashcard_sets", "readonly");
      const store = tx.objectStore("flashcard_sets");
      const req = store.getAll();
      req.onsuccess = () => resolve((req.result || []) as FlashcardSet[]);
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

export async function getFlashcardSetOfflineById(id: string): Promise<FlashcardSet | null> {
  if (!id) return null;
  try {
    const db = await openOfflineDb();
    return new Promise<FlashcardSet | null>((resolve) => {
      const tx = db.transaction("flashcard_sets", "readonly");
      const store = tx.objectStore("flashcard_sets");
      const req = store.get(id);
      req.onsuccess = () => resolve((req.result as FlashcardSet) || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

// ── MCQ Sets Offline Operations ──

export async function saveMcqSetsOffline(sets: McqSet[]): Promise<void> {
  if (!sets || !sets.length) return;
  const db = await openOfflineDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction("mcq_sets", "readwrite");
    const store = tx.objectStore("mcq_sets");
    for (const s of sets) {
      if (s?.id) store.put(s);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getMcqSetsOffline(): Promise<McqSet[]> {
  try {
    const db = await openOfflineDb();
    return new Promise<McqSet[]>((resolve) => {
      const tx = db.transaction("mcq_sets", "readonly");
      const store = tx.objectStore("mcq_sets");
      const req = store.getAll();
      req.onsuccess = () => resolve((req.result || []) as McqSet[]);
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

// ── Metadata / Storage Stats ──

export interface OfflineStorageStats {
  articleCount: number;
  summaryCount: number;
  mcqCount: number;
  flashcardCount: number;
  lastSync: string | null;
  isFullySynced: boolean;
}

export async function getOfflineStorageStats(): Promise<OfflineStorageStats> {
  try {
    const db = await openOfflineDb();
    const countStore = (name: string): Promise<number> =>
      new Promise((res) => {
        try {
          const tx = db.transaction(name, "readonly");
          const store = tx.objectStore(name);
          const req = store.count();
          req.onsuccess = () => res(req.result || 0);
          req.onerror = () => res(0);
        } catch {
          res(0);
        }
      });

    const [articleCount, summaryCount, mcqCount, flashcardCount] = await Promise.all([
      countStore("articles"),
      countStore("article_summaries"),
      countStore("mcq_sets"),
      countStore("flashcard_sets"),
    ]);

    let lastSync: string | null = null;
    let isFullySynced = false;
    try {
      const tx = db.transaction("sync_state", "readonly");
      const store = tx.objectStore("sync_state");
      const req = store.get("last_sync");
      await new Promise<void>((res) => {
        req.onsuccess = () => {
          if (req.result?.value) lastSync = req.result.value;
          res();
        };
        req.onerror = () => res();
      });

      const fullSyncReq = store.get("is_fully_synced");
      await new Promise<void>((res) => {
        fullSyncReq.onsuccess = () => {
          if (fullSyncReq.result?.value) isFullySynced = !!fullSyncReq.result.value;
          res();
        };
        fullSyncReq.onerror = () => res();
      });
    } catch {}

    return {
      articleCount,
      summaryCount,
      mcqCount,
      flashcardCount,
      lastSync,
      isFullySynced: isFullySynced || articleCount >= 100,
    };
  } catch {
    return {
      articleCount: 0,
      summaryCount: 0,
      mcqCount: 0,
      flashcardCount: 0,
      lastSync: null,
      isFullySynced: false,
    };
  }
}

export async function setSyncMetadata(key: string, value: any): Promise<void> {
  try {
    await withStore("sync_state", "readwrite", (store) => {
      store.put({ key, value, updated_at: new Date().toISOString() });
    });
  } catch (err) {
    console.warn("Failed to set sync metadata:", err);
  }
}

// ── One-Tap Full Offline Sync ──

export interface SyncProgress {
  phase: "init" | "summaries" | "articles" | "mcqs" | "flashcards" | "complete" | "error";
  message: string;
  current: number;
  total: number;
  percent: number;
}

export async function syncAllContentForOffline(
  onProgress?: (p: SyncProgress) => void
): Promise<{ success: boolean; articleCount: number; error?: string }> {
  try {
    // 1. Fetch all summaries first
    onProgress?.({
      phase: "summaries",
      message: "Fetching index of medical study notes...",
      current: 0,
      total: 100,
      percent: 5,
    });

    const { data: summaries, error: sumErr } = await supabase
      .from("articles")
      .select("id, title, category, created_at, updated_at, published, slug, meta_description, og_image_url, tags, featured_image, content_kind, content_type, semester_number")
      .eq("published", true)
      .eq("is_raw", false)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false });

    if (sumErr) throw sumErr;
    const cleanSummaries = (summaries || []) as Article[];
    await saveSummariesOffline(cleanSummaries);

    // 2. Fetch all full article contents in batches
    const totalArticles = cleanSummaries.length;
    const batchSize = 60;
    let savedArticles = 0;

    onProgress?.({
      phase: "articles",
      message: `Downloading ${totalArticles} medical notes & question banks...`,
      current: 0,
      total: totalArticles,
      percent: 15,
    });

    for (let i = 0; i < totalArticles; i += batchSize) {
      const batchIds = cleanSummaries.slice(i, i + batchSize).map((a) => a.id);
      const { data: fullArticles, error: artErr } = await supabase
        .from("articles")
        .select("*")
        .in("id", batchIds)
        .is("deleted_at", null);

      if (!artErr && fullArticles) {
        await saveArticlesOffline(fullArticles as Article[]);
        savedArticles += fullArticles.length;
      }

      const percent = Math.min(85, Math.round(15 + (savedArticles / totalArticles) * 70));
      onProgress?.({
        phase: "articles",
        message: `Saved ${savedArticles} of ${totalArticles} notes for offline study...`,
        current: savedArticles,
        total: totalArticles,
        percent,
      });
    }

    // 3. Fetch all MCQ / Exam Sets
    onProgress?.({
      phase: "mcqs",
      message: "Caching MCQ question banks...",
      current: savedArticles,
      total: totalArticles,
      percent: 88,
    });

    const { data: mcqSets } = await supabase
      .from("mcq_sets")
      .select("*")
      .eq("published", true)
      .order("updated_at", { ascending: false });

    if (mcqSets) {
      await saveMcqSetsOffline(mcqSets as McqSet[]);
    }

    // 4. Fetch Flashcard Sets
    onProgress?.({
      phase: "flashcards",
      message: "Caching flashcards...",
      current: savedArticles,
      total: totalArticles,
      percent: 94,
    });

    const { data: flashcards } = await supabase
      .from("flashcard_sets")
      .select("*")
      .eq("published", true)
      .order("updated_at", { ascending: false });

    if (flashcards) {
      await saveFlashcardSetsOffline(flashcards as FlashcardSet[]);
    }

    // Record completion
    const timestamp = new Date().toISOString();
    await setSyncMetadata("last_sync", timestamp);
    await setSyncMetadata("is_fully_synced", true);

    onProgress?.({
      phase: "complete",
      message: `Complete! All ${savedArticles} notes & question banks are ready offline.`,
      current: savedArticles,
      total: totalArticles,
      percent: 100,
    });

    return { success: true, articleCount: savedArticles };
  } catch (err: any) {
    const errorMsg = err?.message || "Failed to download offline content";
    onProgress?.({
      phase: "error",
      message: errorMsg,
      current: 0,
      total: 0,
      percent: 0,
    });
    return { success: false, articleCount: 0, error: errorMsg };
  }
}

export async function clearOfflineCache(): Promise<void> {
  const db = await openOfflineDb();
  const clearStore = (name: string) =>
    new Promise<void>((resolve, reject) => {
      try {
        const tx = db.transaction(name, "readwrite");
        const store = tx.objectStore(name);
        store.clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      } catch (e) {
        resolve();
      }
    });

  await Promise.all([
    clearStore("articles"),
    clearStore("article_summaries"),
    clearStore("mcq_sets"),
    clearStore("flashcard_sets"),
    clearStore("sync_state"),
  ]);
}

/**
 * Automatically unpacks the pre-bundled offline seed file on first app launch
 * if the local IndexedDB database is empty.
 */
export async function ensureOfflineSeeded(): Promise<boolean> {
  try {
    const stats = await getOfflineStorageStats();
    if (stats.articleCount > 0) return false;

    const res = await fetch("/offline-seed.json");
    if (!res.ok) return false;
    const bundle = await res.json();

    if (Array.isArray(bundle.summaries) && bundle.summaries.length) {
      await saveSummariesOffline(bundle.summaries);
    }
    if (Array.isArray(bundle.articles) && bundle.articles.length) {
      await saveArticlesOffline(bundle.articles);
    }
    if (Array.isArray(bundle.mcq_sets) && bundle.mcq_sets.length) {
      await saveMcqSetsOffline(bundle.mcq_sets);
    }
    if (Array.isArray(bundle.flashcard_sets) && bundle.flashcard_sets.length) {
      await saveFlashcardSetsOffline(bundle.flashcard_sets);
    }

    if (bundle.generated_at) {
      await setSyncMetadata("last_sync", bundle.generated_at);
      await setSyncMetadata("is_fully_synced", true);
    }
    return true;
  } catch (err) {
    console.warn("Could not seed offline data from bundle:", err);
    return false;
  }
}

/**
 * Intelligent background delta sync:
 * Checks for any articles, question banks, or flashcards updated since last sync,
 * downloading only modified records so the app is always up-to-date without large downloads.
 */
export async function autoDeltaSync(): Promise<{ updated: number }> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { updated: 0 };
  }

  try {
    const stats = await getOfflineStorageStats();
    if (!stats.lastSync) {
      await ensureOfflineSeeded();
      return { updated: 0 };
    }

    const since = stats.lastSync;
    let totalUpdated = 0;

    // 1. Check for updated articles
    const { data: updatedArticles } = await supabase
      .from("articles")
      .select("*")
      .gt("updated_at", since)
      .eq("published", true)
      .eq("is_raw", false)
      .is("deleted_at", null);

    if (updatedArticles && updatedArticles.length > 0) {
      await saveArticlesOffline(updatedArticles as Article[]);
      totalUpdated += updatedArticles.length;
    }

    // 2. Check for updated MCQs
    const { data: updatedMcqs } = await supabase
      .from("mcq_sets")
      .select("*")
      .gt("updated_at", since)
      .eq("published", true)
      .is("deleted_at", null);

    if (updatedMcqs && updatedMcqs.length > 0) {
      await saveMcqSetsOffline(updatedMcqs as McqSet[]);
      totalUpdated += updatedMcqs.length;
    }

    // 3. Check for updated flashcards
    const { data: updatedFlashcards } = await supabase
      .from("flashcard_sets")
      .select("*")
      .gt("updated_at", since)
      .eq("published", true)
      .is("deleted_at", null);

    if (updatedFlashcards && updatedFlashcards.length > 0) {
      await saveFlashcardSetsOffline(updatedFlashcards as FlashcardSet[]);
      totalUpdated += updatedFlashcards.length;
    }

    await setSyncMetadata("last_sync", new Date().toISOString());
    return { updated: totalUpdated };
  } catch (err) {
    console.warn("Delta auto-sync failed:", err);
    return { updated: 0 };
  }
}
