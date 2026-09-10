import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { AlertTriangle, CheckCircle2, Clock3, Loader2, ShieldAlert } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { finishContestAttempt, getContestBySlug, getMyContestRegistration, getOrStartContestAttempt, loadContestQuestions, loadContestRounds, logContestIntegrityEvent, submitContestAnswer, type ContestAttempt, type ContestQuestion, type ContestRound } from "@/lib/contest-store";

export default function ContestRoundPage() {
  const { slug = "", roundId = "" } = useParams();
  const { user, loading: authLoading } = useAuth();
  const [round, setRound] = useState<ContestRound | null>(null);
  const [attempt, setAttempt] = useState<ContestAttempt | null>(null);
  const [questions, setQuestions] = useState<ContestQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [score, setScore] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const questionStarted = useRef(Date.now());

  useEffect(() => {
    if (authLoading || !user) return;
    getContestBySlug(slug).then(async (contest) => {
      if (!contest) throw new Error("Contest not found");
      const [registration, rounds] = await Promise.all([getMyContestRegistration(contest.id, user.id), loadContestRounds(contest.id)]);
      const activeRound = rounds.find((item) => item.id === roundId) || null;
      if (!registration || registration.status !== "verified" || activeRound?.status !== "live") throw new Error("This live round is not available to your account.");
      const activeAttempt = await getOrStartContestAttempt(roundId, registration, user.id);
      setRound(activeRound); setAttempt(activeAttempt);
      if (activeAttempt.status === "submitted") { setScore(activeAttempt.score); return; }
      setQuestions(await loadContestQuestions(roundId));
      setSeconds(Math.max(0, activeRound.duration_seconds - Math.floor((Date.now() - new Date(activeAttempt.started_at).getTime()) / 1000)));
    }).catch((cause) => setError(cause?.message || "Round unavailable")).finally(() => setLoading(false));
  }, [authLoading, roundId, slug, user]);

  useEffect(() => {
    if (!attempt || score !== null) return;
    const timer = window.setInterval(() => setSeconds((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [attempt, score]);

  useEffect(() => {
    if (!attempt || !user || score !== null) return;
    const log = (eventType: string) => { void logContestIntegrityEvent(attempt.id, user.id, eventType).catch(() => undefined); };
    const visibility = () => { if (document.hidden) log("tab_hidden"); };
    const blur = () => log("focus_lost");
    const fullscreen = () => { if (!document.fullscreenElement) log("fullscreen_exit"); };
    document.addEventListener("visibilitychange", visibility); window.addEventListener("blur", blur); document.addEventListener("fullscreenchange", fullscreen);
    return () => { document.removeEventListener("visibilitychange", visibility); window.removeEventListener("blur", blur); document.removeEventListener("fullscreenchange", fullscreen); };
  }, [attempt, score, user]);

  const time = useMemo(() => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`, [seconds]);
  async function next() {
    if (!attempt || !user || selected === null) return;
    setSaving(true); setError("");
    try {
      await submitContestAnswer(attempt.id, questions[index].id, user.id, selected, Date.now() - questionStarted.current);
      if (index + 1 < questions.length) { setIndex(index + 1); setSelected(null); questionStarted.current = Date.now(); }
      else setScore(await finishContestAttempt(attempt.id));
    } catch (cause: any) { setError(cause?.message || "Answer could not be submitted."); }
    finally { setSaving(false); }
  }
  useEffect(() => { if (seconds === 0 && attempt && questions.length && score === null && !saving) void finishContestAttempt(attempt.id).then(setScore).catch(() => setError("Time ended; submission is being reviewed.")); }, [attempt, questions.length, saving, score, seconds]);

  if (!authLoading && !user) return <Navigate to="/login" replace />;
  if (authLoading || loading) return <div className="flex min-h-dvh items-center justify-center bg-[#071315]"><Loader2 className="h-6 w-6 animate-spin text-teal-300" /></div>;
  if (error && !attempt) return <div className="min-h-dvh bg-[#071315] px-5 py-20 text-center text-white"><AlertTriangle className="mx-auto h-9 w-9 text-amber-300" /><p className="mt-4">{error}</p></div>;
  if (score !== null) return <div className="flex min-h-dvh items-center justify-center bg-[#071315] px-5 text-white"><div className="w-full max-w-md rounded-2xl border border-teal-300/20 bg-teal-300/10 p-8 text-center"><CheckCircle2 className="mx-auto h-10 w-10 text-teal-300" /><h1 className="mt-5 font-serif text-3xl font-bold">Attempt submitted</h1><p className="mt-3 text-white/60">Provisional score</p><p className="mt-2 text-5xl font-bold text-teal-200">{score}%</p></div></div>;
  const question = questions[index];
  if (!question) return <div className="min-h-dvh bg-[#071315] px-5 py-20 text-center text-white">No questions have been admitted to this round.</div>;

  return <div className="min-h-dvh bg-[#071315] px-4 py-6 text-white"><div className="mx-auto max-w-3xl">
    <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.035] p-4"><div><p className="text-xs uppercase tracking-wider text-white/40">{round?.title}</p><p className="mt-1 text-sm font-bold">Question {index + 1} of {questions.length}</p></div><p className="flex items-center gap-2 font-mono text-xl font-bold text-teal-200"><Clock3 className="h-5 w-5" />{time}</p></div>
    <p className="mt-4 flex items-center gap-2 text-xs text-amber-200/75"><ShieldAlert className="h-4 w-4" /> Leaving this tab, losing focus or exiting fullscreen is logged for moderator review.</p>
    <article className="mt-6 rounded-2xl border border-white/10 bg-[#0b1d20] p-6 sm:p-8"><h1 className="text-xl font-bold leading-relaxed">{question.stem}</h1><div className="mt-7 space-y-3">{question.options.map((option, optionIndex) => <button key={optionIndex} onClick={() => setSelected(optionIndex)} className={`flex w-full gap-3 rounded-xl border p-4 text-left text-sm transition ${selected === optionIndex ? "border-teal-300 bg-teal-300/10 text-white" : "border-white/10 text-white/65 hover:border-white/25"}`}><span className="font-bold text-teal-300">{String.fromCharCode(65 + optionIndex)}</span>{option}</button>)}</div>{error && <p className="mt-4 text-sm text-red-300">{error}</p>}<button disabled={selected === null || saving} onClick={() => void next()} className="mt-7 flex w-full items-center justify-center rounded-xl bg-teal-300 px-5 py-3.5 font-bold text-[#071315] disabled:opacity-40">{saving ? <Loader2 className="h-5 w-5 animate-spin" /> : index + 1 === questions.length ? "Submit attempt" : "Lock answer and continue"}</button></article>
  </div></div>;
}
