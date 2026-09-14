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
  tab_switch_limit: number;
  focus_loss_limit: number;
  auto_eliminate: boolean;
  integrity_policy: string;
}

export async function loadContestRounds(contestId: string): Promise<ContestRound[]> {
  const { data, error } = await (supabase as any).from("contest_rounds")
    .select("id,contest_id,title,round_number,status,starts_at,ends_at,duration_seconds,question_count,tab_switch_limit,focus_loss_limit,auto_eliminate,integrity_policy")
    .eq("contest_id", contestId).order("round_number");
  if (error) throw error;
  return (data || []) as ContestRound[];
}

export interface ContestQuestion {
  id: string;
  round_id: string;
  position: number;
  stem: string;
  options: string[];
}

export interface ContestAttempt {
  id: string;
  round_id: string;
  registration_id: string;
  user_id: string;
  status: "active" | "submitted" | "eliminated" | "expired" | "void";
  started_at: string;
  submitted_at: string | null;
  score: number | null;
}

export async function getOrStartContestAttempt(roundId: string, registration: ContestRegistration, userId: string): Promise<ContestAttempt> {
  const existing = await (supabase as any).from("contest_attempts")
    .select("id,round_id,registration_id,user_id,status,started_at,submitted_at,score")
    .eq("round_id", roundId).eq("user_id", userId).maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) return existing.data as ContestAttempt;
  const { data, error } = await (supabase as any).from("contest_attempts").insert({ round_id: roundId, registration_id: registration.id, user_id: userId })
    .select("id,round_id,registration_id,user_id,status,started_at,submitted_at,score").single();
  if (error) throw error;
  return data as ContestAttempt;
}

export async function loadContestQuestions(roundId: string): Promise<ContestQuestion[]> {
  const { data, error } = await (supabase as any).from("contest_questions")
    .select("id,round_id,position,stem,options").eq("round_id", roundId).order("position");
  if (error) throw error;
  return (data || []) as ContestQuestion[];
}

export async function submitContestAnswer(attemptId: string, questionId: string, userId: string, selectedIndex: number, responseMs: number) {
  const { error } = await (supabase as any).from("contest_answers").insert({ attempt_id: attemptId, question_id: questionId, user_id: userId, selected_index: selectedIndex, response_ms: responseMs });
  if (error && error.code !== "23505") throw error;
}

export async function logContestIntegrityEvent(attemptId: string, _userId: string, eventType: string): Promise<boolean> {
  const { data, error } = await supabase.functions.invoke("contest-control", { body: { action: "log_integrity_event", attemptId, eventType } });
  if (error || data?.error) throw error || new Error(data.error);
  return Boolean(data.eliminated);
}

export async function finishContestAttempt(attemptId: string): Promise<number> {
  const { data, error } = await supabase.functions.invoke("contest-control", { body: { action: "submit_attempt", attemptId } });
  if (error || data?.error) throw error || new Error(data.error);
  return Number(data.score || 0);
}

export async function importContestQuestions(roundId: string, questions: unknown[]): Promise<number> {
  const { data, error } = await supabase.functions.invoke("contest-control", { body: { action: "import_questions", roundId, questions } });
  if (error || data?.error) throw error || new Error(data.error);
  return Number(data.count || 0);
}

export interface AdminContestRegistration extends ContestRegistration {
  user_id: string;
  created_at: string;
  contest_universities: { name: string; abbreviation: string | null } | null;
}

export async function loadAdminContestRegistrations(contestId: string): Promise<AdminContestRegistration[]> {
  const { data, error } = await (supabase as any).from("contest_registrations")
    .select("id,contest_id,user_id,university_id,study_year,representation,status,created_at,contest_universities(name,abbreviation)")
    .eq("contest_id", contestId).order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []) as AdminContestRegistration[];
}

export async function setContestRegistrationStatus(registrationId: string, status: ContestRegistration["status"]) {
  const { data, error } = await supabase.functions.invoke("contest-control", { body: { action: "registration_status", registrationId, status } });
  if (error || data?.error) throw error || new Error(data.error);
}

export async function configureContestRound(input: { roundId: string; status: ContestRound["status"]; startsAt: string | null; endsAt: string | null; durationSeconds: number; tabSwitchLimit: number; focusLossLimit: number; autoEliminate: boolean }) {
  const { data, error } = await supabase.functions.invoke("contest-control", { body: { action: "configure_round", ...input } });
  if (error || data?.error) throw error || new Error(data.error);
}

export async function loadContestIntegritySummary(roundId: string) {
  const [{ data: attempts, error: attemptError }, { data: events, error: eventError }] = await Promise.all([
    (supabase as any).from("contest_attempts").select("id,round_id,user_id,registration_id,status,score,started_at").eq("round_id", roundId).order("started_at", { ascending: false }),
    (supabase as any).from("contest_integrity_events").select("attempt_id,event_type,occurred_at").order("occurred_at", { ascending: false }).limit(500),
  ]);
  if (attemptError) throw attemptError;
  if (eventError) throw eventError;
  const ids = new Set((attempts || []).map((item: any) => item.id));
  return { attempts: attempts || [], events: (events || []).filter((event: any) => ids.has(event.attempt_id)) };
}

export interface RehearsalResult { score: number; correct: number; total: number; details: { questionId: string; correct: boolean; explanation: string | null }[] }
export async function scoreContestRehearsal(roundId: string, answers: Record<string, number>): Promise<RehearsalResult> {
  const { data, error } = await supabase.functions.invoke("contest-control", { body: { action: "rehearsal_score", roundId, answers } });
  if (error || data?.error) throw error || new Error(data.error);
  return data as RehearsalResult;
}

export async function overrideContestAttempt(attemptId: string, status: ContestAttempt["status"], reason: string) {
  const { data, error } = await supabase.functions.invoke("contest-control", { body: { action: "override_attempt", attemptId, status, reason } });
  if (error || data?.error) throw error || new Error(data.error);
}

export async function decideContestAdvancement(input: { registrationId: string; sourceRoundId: string; targetRoundId?: string | null; decision: "advanced" | "eliminated" | "wildcard"; reason: string }) {
  const { data, error } = await supabase.functions.invoke("contest-control", { body: { action: "advance_registration", ...input } });
  if (error || data?.error) throw error || new Error(data.error);
}

export interface ContestAdvancement { id: string; decision: "advanced" | "eliminated" | "wildcard"; reason: string; created_at: string; contest_rounds: { title: string } | null }
export async function loadMyContestAdvancements(contestId: string, registrationId: string): Promise<ContestAdvancement[]> {
  const { data, error } = await (supabase as any).from("contest_advancements")
    .select("id,decision,reason,created_at,contest_rounds!contest_advancements_source_round_id_fkey(title)")
    .eq("contest_id", contestId).eq("registration_id", registrationId).order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []) as ContestAdvancement[];
}

export interface ContestAppeal { id: string; contest_id: string; registration_id: string; attempt_id: string | null; advancement_id: string | null; user_id: string; category: "integrity" | "score" | "advancement" | "technical"; statement: string; status: "open" | "reviewing" | "upheld" | "overturned" | "dismissed"; resolution: string | null; created_at: string }
export async function loadMyContestAppeals(contestId: string): Promise<ContestAppeal[]> { const { data, error } = await (supabase as any).from("contest_appeals").select("id,contest_id,registration_id,attempt_id,advancement_id,user_id,category,statement,status,resolution,created_at").eq("contest_id", contestId).order("created_at", { ascending: false }); if (error) throw error; return (data || []) as ContestAppeal[]; }
export async function loadMyContestAttempts(registrationId: string): Promise<ContestAttempt[]> { const { data, error } = await (supabase as any).from("contest_attempts").select("id,round_id,registration_id,user_id,status,started_at,submitted_at,score").eq("registration_id", registrationId).order("started_at", { ascending: false }); if (error) throw error; return (data || []) as ContestAttempt[]; }
export async function submitContestAppeal(input: { contestId: string; registrationId: string; attemptId?: string | null; advancementId?: string | null; category: ContestAppeal["category"]; statement: string }) { const { data, error } = await supabase.functions.invoke("contest-control", { body: { action: "submit_appeal", ...input } }); if (error || data?.error) throw error || new Error(data.error); }
export async function loadAdminContestAppeals(): Promise<ContestAppeal[]> { const { data, error } = await (supabase as any).from("contest_appeals").select("id,contest_id,registration_id,attempt_id,advancement_id,user_id,category,statement,status,resolution,created_at").order("created_at", { ascending: false }); if (error) throw error; return (data || []) as ContestAppeal[]; }
export async function resolveContestAppeal(appealId: string, status: "reviewing" | "upheld" | "overturned" | "dismissed", resolution: string) { const { data, error } = await supabase.functions.invoke("contest-control", { body: { action: "resolve_appeal", appealId, status, resolution } }); if (error || data?.error) throw error || new Error(data.error); }

export async function publishContestResults(roundId: string): Promise<number> {
  const { data, error } = await supabase.functions.invoke("contest-control", { body: { action: "publish_results", roundId } });
  if (error || data?.error) throw error || new Error(data.error);
  return Number(data.count || 0);
}

export interface ContestUniversityResult {
  id: string; rank: number; participant_count: number; average_score: number; total_points: number; published_at: string;
  contest_universities: { name: string; abbreviation: string | null } | null;
  contest_rounds: { title: string } | null;
}

export async function loadContestLeaderboard(contestId: string): Promise<ContestUniversityResult[]> {
  const { data, error } = await (supabase as any).from("contest_university_results")
    .select("id,rank,participant_count,average_score,total_points,published_at,contest_universities(name,abbreviation),contest_rounds(title)")
    .eq("contest_id", contestId).order("rank");
  if (error) throw error;
  return (data || []) as ContestUniversityResult[];
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
  const { data, error } = await supabase.functions.invoke("contest-control", { body: { action: "update_contest_stage", contestId: id, stage } });
  if (error || data?.error) throw error || new Error(data.error);
}

async function contestControl<T = any>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("contest-control", { body });
  if (error || data?.error) throw error || new Error(data.error);
  return data as T;
}

export interface ContestDraft {
  title: string;
  subtitle: string;
  subjects: string[];
  years: number[];
  format: string;
  registrationOpensAt: string | null;
  registrationClosesAt: string | null;
  startsAt: string | null;
  published: boolean;
}

export async function createContest(draft: ContestDraft) {
  const data = await contestControl({ action: "create_contest", ...draft });
  return data.contest as { id: string; slug: string };
}

export async function updateContestDetails(contestId: string, draft: ContestDraft) {
  await contestControl({ action: "update_contest", contestId, ...draft });
}

export async function createContestRound(contestId: string, title: string, durationSeconds: number) {
  const data = await contestControl({ action: "create_round", contestId, title, durationSeconds });
  return data.round as ContestRound;
}

export async function deleteContestRound(roundId: string) {
  await contestControl({ action: "delete_round", roundId });
}

export async function addContestUniversity(name: string, abbreviation: string) {
  const data = await contestControl({ action: "add_university", name, abbreviation });
  return data.university as ContestUniversity;
}

export async function setContestUniversityActive(universityId: string, active: boolean) {
  await contestControl({ action: "set_university_active", universityId, active });
}

export async function createSampleContest(title?: string) {
  const data = await contestControl({ action: "create_sample_contest", title });
  return data.contest as { id: string; slug: string; title: string };
}

export async function loadAllContestUniversities(): Promise<(ContestUniversity & { active: boolean })[]> {
  const { data, error } = await (supabase as any).from("contest_universities")
    .select("id,name,slug,abbreviation,verified,active").order("name");
  if (error) throw error;
  return data || [];
}
