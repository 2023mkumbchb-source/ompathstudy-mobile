import { supabase } from "@/integrations/supabase/client";
import type { ResourceType } from "./academic";
import type { ArticleSummary } from "./store";
import { isOfflineMode, getSummariesOffline } from "./offlineStore";

export type ProgressStatus = "not_started" | "in_progress" | "completed" | "difficult" | "revisit";

export interface ResourceProgress {
  resource_type: ResourceType;
  resource_id: string;
  status: ProgressStatus;
  progress_percent: number;
  last_position: string | null;
  last_opened_at: string;
  completed_at?: string | null;
}

export interface BookmarkRow {
  resource_type: ResourceType;
  resource_id: string;
  collection_name: string | null;
  created_at: string;
}

const LOCAL_PROGRESS = "study:progress";
const LOCAL_BOOKMARKS = "study:bookmarks";

function readLocal<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function writeLocal(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch { /* quota */ }
}

const db = supabase as unknown as { from: (t: string) => any };

/* ---------------- progress ---------------- */

export async function getProgress(userId: string | null): Promise<ResourceProgress[]> {
  if (!userId) return readLocal<ResourceProgress[]>(LOCAL_PROGRESS, []);
  // RLS already scopes this table to the caller's own rows, but the filter is
  // kept explicit as defense in depth (and to match getActivity below, whose
  // policy intentionally lets admins read every user's rows).
  const { data } = await db
    .from("user_resource_progress")
    .select("resource_type, resource_id, status, progress_percent, last_position, last_opened_at, completed_at")
    .eq("user_id", userId)
    .order("last_opened_at", { ascending: false })
    .limit(1000);
  return (data || []) as ResourceProgress[];
}

export async function setProgress(
  userId: string | null,
  resource_type: ResourceType,
  resource_id: string,
  patch: Partial<Omit<ResourceProgress, "resource_type" | "resource_id">>,
) {
  if (!userId) {
    const list = readLocal<ResourceProgress[]>(LOCAL_PROGRESS, []);
    const idx = list.findIndex((p) => p.resource_type === resource_type && p.resource_id === resource_id);
    const base: ResourceProgress = {
      resource_type,
      resource_id,
      status: "in_progress",
      progress_percent: 0,
      last_position: null,
      last_opened_at: new Date().toISOString(),
      ...(idx >= 0 ? list[idx] : {}),
    };
    const next = { ...base, ...patch, last_opened_at: new Date().toISOString() };
    if (idx >= 0) list[idx] = next;
    else list.unshift(next);
    writeLocal(LOCAL_PROGRESS, list.slice(0, 100));
    return;
  }
  await db.from("user_resource_progress").upsert(
    {
      user_id: userId,
      resource_type,
      resource_id,
      last_opened_at: new Date().toISOString(),
      ...(patch.status === "completed" ? { completed_at: new Date().toISOString() } : {}),
      ...patch,
    },
    { onConflict: "user_id,resource_type,resource_id" },
  );
}

/** Pushes local guest progress into the account after sign-in. */
export async function syncLocalProgress(userId: string) {
  const progress = readLocal<ResourceProgress[]>(LOCAL_PROGRESS, []);
  const bookmarks = readLocal<BookmarkRow[]>(LOCAL_BOOKMARKS, []);
  if (progress.length) {
    await db.from("user_resource_progress").upsert(
      progress.map((p) => ({ ...p, user_id: userId })),
      { onConflict: "user_id,resource_type,resource_id" },
    );
    writeLocal(LOCAL_PROGRESS, []);
  }
  if (bookmarks.length) {
    await db.from("user_bookmarks").upsert(
      bookmarks.map((b) => ({ ...b, user_id: userId })),
      { onConflict: "user_id,resource_type,resource_id" },
    );
    writeLocal(LOCAL_BOOKMARKS, []);
  }
}

/* ---------------- bookmarks ---------------- */

export async function getBookmarks(userId: string | null): Promise<BookmarkRow[]> {
  if (!userId || isOfflineMode()) return readLocal<BookmarkRow[]>(LOCAL_BOOKMARKS, []);
  try {
    const { data, error } = await db
      .from("user_bookmarks")
      .select("resource_type, resource_id, collection_name, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    const remote = (data || []) as BookmarkRow[];
    writeLocal(LOCAL_BOOKMARKS, remote);
    return remote;
  } catch (err) {
    console.warn("Could not fetch remote bookmarks, falling back to local cache:", err);
    return readLocal<BookmarkRow[]>(LOCAL_BOOKMARKS, []);
  }
}

export async function toggleBookmark(
  userId: string | null,
  resource_type: ResourceType,
  resource_id: string,
  saved: boolean,
) {
  // Always update local cache first for instant UI response and offline support
  const list = readLocal<BookmarkRow[]>(LOCAL_BOOKMARKS, []).filter(
    (b) => !(b.resource_type === resource_type && b.resource_id === resource_id),
  );
  if (saved) {
    list.unshift({ resource_type, resource_id, collection_name: null, created_at: new Date().toISOString() });
  }
  writeLocal(LOCAL_BOOKMARKS, list);

  if (!userId || isOfflineMode()) {
    return;
  }

  try {
    if (saved) {
      await db.from("user_bookmarks").upsert(
        { user_id: userId, resource_type, resource_id },
        { onConflict: "user_id,resource_type,resource_id" },
      );
    } else {
      await db
        .from("user_bookmarks")
        .delete()
        .eq("user_id", userId)
        .eq("resource_type", resource_type)
        .eq("resource_id", resource_id);
    }
  } catch (err) {
    console.warn("Could not sync bookmark remotely (cached locally):", err);
  }
}

/** Fetches full summaries for all bookmarked articles directly from local IndexedDB */
export async function getOfflineBookmarkedSummaries(): Promise<ArticleSummary[]> {
  const bookmarks = readLocal<BookmarkRow[]>(LOCAL_BOOKMARKS, []);
  const articleIds = new Set(bookmarks.filter((b) => b.resource_type === "article").map((b) => b.resource_id));
  if (articleIds.size === 0) return [];
  const summaries = await getSummariesOffline().catch(() => []);
  return summaries.filter((s) => articleIds.has(s.id));
}

/* ---------------- topics ---------------- */

export interface TopicProgress {
  topic_id: string;
  status: string;
  confidence_level: number;
  correct_answers: number;
  attempted_questions: number;
  completed_at?: string | null;
}

export async function getTopicProgress(userId: string | null): Promise<TopicProgress[]> {
  if (!userId) return [];
  const { data } = await db
    .from("user_topic_progress")
    .select("topic_id, status, confidence_level, correct_answers, attempted_questions")
    .eq("user_id", userId);
  return (data || []) as TopicProgress[];
}

export async function setTopicProgress(userId: string, topic_id: string, patch: Partial<TopicProgress>) {
  await db.from("user_topic_progress").upsert(
    { user_id: userId, topic_id, last_studied_at: new Date().toISOString(), ...patch },
    { onConflict: "user_id,topic_id" },
  );
}

/* ---------------- activity ---------------- */

export async function logActivity(
  userId: string | null,
  activity_type: string,
  extra: Record<string, unknown> = {},
) {
  if (!userId) return;
  await db.from("user_study_activity").insert({ user_id: userId, activity_type, ...extra });
}

export interface ActivityRow { created_at: string; activity_type: string; duration_seconds: number }

export async function getActivity(userId: string | null, days = 30): Promise<ActivityRow[]> {
  if (!userId) return [];
  const since = new Date(Date.now() - days * 86400000).toISOString();
  // Explicit filter is required here, not just defensive: the RLS read policy
  // on user_study_activity intentionally also lets admins see every user's
  // rows (for support/analytics), so without this an admin's own "My
  // Revision" streak would be computed over the whole site's activity.
  const { data } = await db
    .from("user_study_activity")
    .select("created_at, activity_type, duration_seconds")
    .eq("user_id", userId)
    .gte("created_at", since)
    .order("created_at", { ascending: false });
  return (data || []) as ActivityRow[];
}

/** YYYY-MM-DD in the learner's local timezone (not UTC — a plain
 *  toISOString().slice(0,10) shifts the calendar day for anyone east of
 *  UTC, e.g. Kenya at UTC+3, for a chunk of every evening). */
function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function computeStreak(activity: ActivityRow[]): number {
  const days = new Set(activity.map((a) => localDateKey(new Date(a.created_at))));
  let streak = 0;
  const cursor = new Date();
  const todayKey = localDateKey(cursor);
  for (;;) {
    const key = localDateKey(cursor);
    if (days.has(key)) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    } else if (streak === 0 && key === todayKey) {
      cursor.setDate(cursor.getDate() - 1);
    } else break;
  }
  return streak;
}
