import { supabase } from "@/integrations/supabase/client";
import type { ContestPreview, ContestStage } from "@/lib/contest";

export interface ContestUniversity {
  id: string;
  name: string;
  slug: string;
  abbreviation: string | null;
  verified: boolean;
}

export interface ContestRecord extends ContestPreview {
  id: string;
  registrationOpensAt: string | null;
  registrationClosesAt: string | null;
  startsAt: string | null;
  published: boolean;
}

export async function loadContestPlatform(): Promise<{ contests: ContestRecord[]; universities: ContestUniversity[] }> {
  const [{ data: contestRows, error: contestError }, { data: universityRows, error: universityError }] = await Promise.all([
    (supabase as any).from("contests").select("id,slug,title,subtitle,status,subjects,eligible_years,competition_format,registration_opens_at,registration_closes_at,starts_at,published").eq("published", true).order("created_at"),
    (supabase as any).from("contest_universities").select("id,name,slug,abbreviation,verified").eq("active", true).order("name"),
  ]);
  if (contestError) throw contestError;
  if (universityError) throw universityError;
  return {
    contests: (contestRows || []).map((row: any) => ({
      id: row.id, slug: row.slug, title: row.title, subtitle: row.subtitle,
      stage: row.status as ContestStage, subjects: row.subjects || [], years: row.eligible_years || [],
      format: row.competition_format || "", teams: "University teams and individual representatives",
      registrationOpensAt: row.registration_opens_at, registrationClosesAt: row.registration_closes_at,
      startsAt: row.starts_at, published: row.published,
    })),
    universities: (universityRows || []) as ContestUniversity[],
  };
}

export interface ContestRegistration {
  id: string;
  contest_id: string;
  university_id: string;
  study_year: number;
  representation: "individual" | "university_team";
  status: "pending" | "verified" | "rejected" | "withdrawn";
}

export interface ContestRound {
  id: string;
  contest_id: string;
  title: string;
  round_number: number;
  status: "scheduled" | "lobby" | "live" | "closed" | "cancelled";
  starts_at: string | null;
  ends_at: string | null;
  duration_seconds: number;
  question_count: number;
}

export async function loadContestRounds(contestId: string): Promise<ContestRound[]> {
  const { data, error } = await (supabase as any).from("contest_rounds")
    .select("id,contest_id,title,round_number,status,starts_at,ends_at,duration_seconds,question_count")
    .eq("contest_id", contestId).order("round_number");
  if (error) throw error;
  return (data || []) as ContestRound[];
}

export async function getContestBySlug(slug: string): Promise<ContestRecord | null> {
  const { contests } = await loadContestPlatform();
  return contests.find((contest) => contest.slug === slug) || null;
}

export async function getMyContestRegistration(contestId: string, userId: string): Promise<ContestRegistration | null> {
  const { data, error } = await (supabase as any).from("contest_registrations")
    .select("id,contest_id,university_id,study_year,representation,status")
    .eq("contest_id", contestId).eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return data as ContestRegistration | null;
}

export async function registerForContest(input: { contestId: string; userId: string; universityId: string; studyYear: number; representation: "individual" | "university_team" }) {
  const { data, error } = await (supabase as any).from("contest_registrations").insert({
    contest_id: input.contestId, user_id: input.userId, university_id: input.universityId,
    study_year: input.studyYear, representation: input.representation, status: "pending",
    accepted_rules_at: new Date().toISOString(),
  }).select("id,contest_id,university_id,study_year,representation,status").single();
  if (error) throw error;
  return data as ContestRegistration;
}

export async function loadAdminContests(): Promise<ContestRecord[]> {
  const { data, error } = await (supabase as any).from("contests")
    .select("id,slug,title,subtitle,status,subjects,eligible_years,competition_format,registration_opens_at,registration_closes_at,starts_at,published")
    .order("created_at");
  if (error) throw error;
  return (data || []).map((row: any) => ({
    id: row.id, slug: row.slug, title: row.title, subtitle: row.subtitle, stage: row.status,
    subjects: row.subjects || [], years: row.eligible_years || [], format: row.competition_format || "",
    teams: "University teams and individual representatives", registrationOpensAt: row.registration_opens_at,
    registrationClosesAt: row.registration_closes_at, startsAt: row.starts_at, published: row.published,
  }));
}

export async function updateContestStage(id: string, stage: ContestStage) {
  const { error } = await (supabase as any).from("contests").update({ status: stage, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}
