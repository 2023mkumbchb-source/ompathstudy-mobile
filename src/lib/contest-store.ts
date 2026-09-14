import { supabase } from "@/integrations/supabase/client";
import type { ContestPreview, ContestStage } from "@/lib/contest";

export interface ContestUniversity {
  id: string;
  name: string;
  slug: string;
  abbreviation: string | null;
  verified: boolean;
  active?: boolean;
}

export interface ContestRecord extends ContestPreview {
  id: string;
  registrationOpensAt: string | null;
  registrationClosesAt: string | null;
  startsAt: string | null;
  shareImageUrl: string | null;
  published: boolean;
  maxParticipantsPerUniversity: number;
}

export async function loadContestPlatform(): Promise<{ contests: ContestRecord[]; universities: ContestUniversity[] }> {
  const [{ data: contestRows, error: contestError }, { data: universityRows, error: universityError }] = await Promise.all([
    (supabase as any).from("contests").select("id,slug,title,subtitle,status,subjects,eligible_years,competition_format,registration_opens_at,registration_closes_at,starts_at,share_image_url,published,max_participants_per_university").eq("published", true).order("created_at"),
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
      startsAt: row.starts_at, shareImageUrl: row.share_image_url, published: row.published, maxParticipantsPerUniversity: row.max_participants_per_university || 50,
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
  contest_universities?: { name: string; abbreviation: string | null } | null;
  team_name?: string | null;
  team_role?: "captain" | "member";
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
  source_mcq_set_id: string | null;
  source_exam_title: string | null;
  auto_open: boolean;
  auto_close: boolean;
  entry_grace_minutes: number;
  results_visible: boolean;
  university_a_id: string | null;
  university_b_id: string | null;
  university_a: { name: string; abbreviation: string | null } | null;
  university_b: { name: string; abbreviation: string | null } | null;
  shuffle_questions: boolean;
  marks_correct: number;
  marks_incorrect: number;
}

export async function loadContestRounds(contestId: string): Promise<ContestRound[]> {
  const { data, error } = await (supabase as any).from("contest_rounds")
    .select("id,contest_id,title,round_number,status,starts_at,ends_at,duration_seconds,question_count,tab_switch_limit,focus_loss_limit,auto_eliminate,integrity_policy,source_mcq_set_id,source_exam_title,auto_open,auto_close,entry_grace_minutes,results_visible,university_a_id,university_b_id,shuffle_questions,marks_correct,marks_incorrect,university_a:contest_universities!contest_rounds_university_a_id_fkey(name,abbreviation),university_b:contest_universities!contest_rounds_university_b_id_fkey(name,abbreviation)")
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

export async function getExistingContestAttempt(roundId: string, userId: string): Promise<ContestAttempt | null> {
  const { data, error } = await (supabase as any).from("contest_attempts")
    .select("id,round_id,registration_id,user_id,status,started_at,submitted_at,score")
    .eq("round_id", roundId).eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return (data as ContestAttempt | null) || null;
}

export async function loadContestQuestions(roundId: string): Promise<ContestQuestion[]> {
  const { data, error } = await (supabase as any).from("contest_questions")
    .select("id,round_id,position,stem,options").eq("round_id", roundId).order("position");
  if (error) throw error;
  return (data || []) as ContestQuestion[];
}

export async function submitContestAnswer(attemptId: string, questionId: string, userId: string, selectedIndex: number, responseMs: number) {
  void userId;
  const { data, error } = await supabase.functions.invoke("contest-control", { body: { action: "save_answer", attemptId, questionId, selectedIndex, responseMs } });
  if (error || data?.error) throw error || new Error(data.error);
}

export async function proposeContestUniversity(name: string, abbreviation: string): Promise<ContestUniversity> {
  const { data, error } = await supabase.functions.invoke("contest-control", { body: { action: "propose_university", name, abbreviation } });
  if (error || data?.error) throw error || new Error(data.error);
  return data.university as ContestUniversity;
}

export async function logContestIntegrityEvent(attemptId: string, _userId: string, eventType: string): Promise<{ eliminated: boolean; strikes: number; limit: number }> {
  const { data, error } = await supabase.functions.invoke("contest-control", { body: { action: "log_integrity_event", attemptId, eventType } });
  if (error || data?.error) throw error || new Error(data.error);
  return { eliminated: Boolean(data.eliminated), strikes: Number(data.strikes || 0), limit: Number(data.limit || 3) };
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

export interface AdminExamPaper {
  id: string;
  title: string;
  category: string;
  slug: string;
  question_count: number;
}

export async function loadAdminExamPapers(): Promise<AdminExamPaper[]> {
  const { data, error } = await (supabase as any).from("mcq_sets")
    .select("id,title,category,slug,questions")
    .eq("published", true)
    .is("deleted_at", null)
    .order("category")
    .order("title");
  if (error) throw error;
  return (data || []).map((paper: any) => ({
    id: paper.id,
    title: paper.title,
    category: paper.category || "Uncategorised",
    slug: paper.slug,
    question_count: Array.isArray(paper.questions) ? paper.questions.length : 0,
  })).filter((paper: AdminExamPaper) => paper.question_count > 0);
}

export async function importExamPaperToContestRound(roundId: string, examId: string): Promise<{ count: number; title: string }> {
  const data = await contestControl<{ count: number; title: string }>({ action: "import_exam_paper", roundId, examId });
  return { count: Number(data.count || 0), title: data.title };
}

export interface AdminContestRegistration extends ContestRegistration {
  user_id: string;
  created_at: string;
  contest_universities: { name: string; abbreviation: string | null } | null;
}

export async function loadAdminContestRegistrations(contestId: string): Promise<AdminContestRegistration[]> {
  const { data, error } = await (supabase as any).from("contest_registrations")
    .select("id,contest_id,user_id,university_id,study_year,representation,status,team_name,team_role,created_at,contest_universities(name,abbreviation)")
    .eq("contest_id", contestId).order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []) as AdminContestRegistration[];
}

export async function setContestRegistrationStatus(registrationId: string, status: ContestRegistration["status"]) {
  const { data, error } = await supabase.functions.invoke("contest-control", { body: { action: "registration_status", registrationId, status } });
  if (error || data?.error) throw error || new Error(data.error);
}

export async function configureContestRound(input: { roundId: string; status: ContestRound["status"]; startsAt: string | null; endsAt: string | null; durationSeconds: number; tabSwitchLimit: number; focusLossLimit: number; autoEliminate: boolean; autoOpen?: boolean; autoClose?: boolean; entryGraceMinutes?: number; resultsVisible?: boolean; universityAId?: string | null; universityBId?: string | null; shuffleQuestions?: boolean; marksCorrect?: number; marksIncorrect?: number }) {
  const { data, error } = await supabase.functions.invoke("contest-control", { body: { action: "configure_round", ...input } });
  if (error || data?.error) throw error || new Error(data.error);
}

export async function announceContestSchedule(roundId: string): Promise<{ recipients: number; delivered: number; emailConfigured: boolean }> {
  const data = await contestControl<{ recipients: number; delivered: number; emailConfigured: boolean }>({ action: "announce_schedule", roundId });
  return data;
}

export async function uploadContestPoster(contestId: string, file: File): Promise<string> {
  if (!file.type.match(/^image\/(jpeg|png|webp)$/)) throw new Error("Use a JPG, PNG or WebP image.");
  if (file.size > 5 * 1024 * 1024) throw new Error("The poster must be smaller than 5 MB.");
  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${contestId}/poster-${Date.now()}.${extension}`;
  const { error } = await supabase.storage.from("contest-posters").upload(path, file, { cacheControl: "3600", upsert: false });
  if (error) throw error;
  return supabase.storage.from("contest-posters").getPublicUrl(path).data.publicUrl;
}

export async function loadMyContestAnswers(attemptId: string): Promise<{ question_id: string; selected_index: number }[]> {
  const { data, error } = await (supabase as any).from("contest_answers").select("question_id,selected_index").eq("attempt_id", attemptId);
  if (error) throw error;
  return data || [];
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

export interface ContestQuestionAnalytics { questionId: string; position: number; stem: string; responses: number; choiceCounts: number[]; leadingChoiceRate: number }
export async function loadContestQuestionAnalytics(roundId: string): Promise<ContestQuestionAnalytics[]> {
  const data = await contestControl<{ analytics: ContestQuestionAnalytics[] }>({ action: "question_analytics", roundId });
  return data.analytics || [];
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
    .select("id,contest_id,university_id,study_year,representation,status,team_name,team_role,contest_universities(name,abbreviation)")
    .eq("contest_id", contestId).eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return data as ContestRegistration | null;
}

export async function registerForContest(input: { contestId: string; userId: string; universityId: string; studyYear: number; representation: "individual" | "university_team"; teamName?: string; teamRole?: "captain" | "member" }) {
  void input.userId;
  const data = await contestControl<{ registration: ContestRegistration }>({ action: "register_contest", ...input });
  return data.registration;
}

export async function loadAdminContests(): Promise<ContestRecord[]> {
  const { data, error } = await (supabase as any).from("contests")
    .select("id,slug,title,subtitle,status,subjects,eligible_years,competition_format,registration_opens_at,registration_closes_at,starts_at,share_image_url,published,max_participants_per_university")
    .order("created_at");
  if (error) throw error;
  return (data || []).map((row: any) => ({
    id: row.id, slug: row.slug, title: row.title, subtitle: row.subtitle, stage: row.status,
    subjects: row.subjects || [], years: row.eligible_years || [], format: row.competition_format || "",
    teams: "University teams and individual representatives", registrationOpensAt: row.registration_opens_at,
    registrationClosesAt: row.registration_closes_at, startsAt: row.starts_at, shareImageUrl: row.share_image_url, published: row.published, maxParticipantsPerUniversity: row.max_participants_per_university || 50,
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
  shareImageUrl: string | null;
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
