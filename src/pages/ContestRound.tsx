import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { AlertTriangle, CheckCircle2, Clock3, Expand, Loader2, Save, ShieldAlert, Trophy } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { finishContestAttempt, getContestBySlug, getExistingContestAttempt, getMyContestRegistration, getOrStartContestAttempt, loadContestQuestions, loadContestRounds, loadMyContestAnswers, logContestIntegrityEvent, submitContestAnswer, type ContestAttempt, type ContestQuestion, type ContestRegistration, type ContestRound } from "@/lib/contest-store";

export default function ContestRoundPage() {
  const { slug = "", roundId = "" } = useParams();
  const { user, loading: authLoading } = useAuth();
  const [registration, setRegistration] = useState<ContestRegistration | null>(null);
  const [round, setRound] = useState<ContestRound | null>(null);
  const [attempt, setAttempt] = useState<ContestAttempt | null>(null);
  const [questions, setQuestions] = useState<ContestQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [seconds, setSeconds] = useState(-1);
  const [score, setScore] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [started, setStarted] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [eliminated, setEliminated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState("");
  const questionTouchedAt = useRef<Record<string, number>>({});

  useEffect(() => {
    if (authLoading || !user) return;
    getContestBySlug(slug).then(async (contest) => {
      if (!contest) throw new Error("Contest not found");
      const [registered, rounds] = await Promise.all([getMyContestRegistration(contest.id, user.id), loadContestRounds(contest.id)]);
      const activeRound = rounds.find((item) => item.id === roundId) || null;
      if (!registered || registered.status !== "verified" || activeRound?.status !== "live") throw new Error("This live round is not available to your account.");
      setRegistration(registered); setRound(activeRound);
      const [questionRows, existingAttempt] = await Promise.all([loadContestQuestions(roundId), getExistingContestAttempt(roundId, user.id)]);
      setQuestions(questionRows);
      if (existingAttempt) {
        setAttempt(existingAttempt);
        if (existingAttempt.status === "submitted") { setSubmitted(true); if (activeRound.results_visible) setScore(existingAttempt.score); return; }
        if (existingAttempt.status === "eliminated") { setEliminated(true); return; }
        const rows = await loadMyContestAnswers(existingAttempt.id);
        setAnswers(Object.fromEntries(rows.map((item) => [item.question_id, item.selected_index])));
        setSaved(Object.fromEntries(rows.map((item) => [item.question_id, true]))); setStarted(true);
      }
    }).catch((cause) => setError(cause?.message || "Round unavailable")).finally(() => setLoading(false));
  }, [authLoading, roundId, slug, user]);

  useEffect(() => { const on = () => setOnline(true), off = () => setOnline(false); window.addEventListener("online", on); window.addEventListener("offline", off); return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); }; }, []);
  useEffect(() => {
    if (!attempt || submitted || eliminated || !round) return;
    const tick = () => { const personalEnd = new Date(attempt.started_at).getTime() + round.duration_seconds * 1000; const roundEnd = round.ends_at ? new Date(round.ends_at).getTime() : Infinity; setSeconds(Math.max(0, Math.ceil((Math.min(personalEnd, roundEnd) - Date.now()) / 1000))); };
    tick(); const timer = window.setInterval(tick, 1000); return () => window.clearInterval(timer);
  }, [attempt, eliminated, round, submitted]);
  useEffect(() => {
    if (!attempt || !user || submitted || eliminated) return;
    const log = (eventType: string) => { void logContestIntegrityEvent(attempt.id, user.id, eventType).then((removed) => { if (removed) setEliminated(true); }).catch(() => undefined); };
    const visibility = () => { if (document.hidden) log("tab_hidden"); }; const blur = () => log("focus_lost"); const fullscreen = () => { if (!document.fullscreenElement) log("fullscreen_exit"); }; const beforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    document.addEventListener("visibilitychange", visibility); window.addEventListener("blur", blur); document.addEventListener("fullscreenchange", fullscreen); window.addEventListener("beforeunload", beforeUnload);
    return () => { document.removeEventListener("visibilitychange", visibility); window.removeEventListener("blur", blur); document.removeEventListener("fullscreenchange", fullscreen); window.removeEventListener("beforeunload", beforeUnload); };
  }, [attempt, eliminated, submitted, user]);

  async function enterExam() {
    if (!registration || !user || !round || !questions.length) return;
    setError("");
    try { await document.documentElement.requestFullscreen?.().catch(() => undefined); const active = await getOrStartContestAttempt(round.id, registration, user.id); setAttempt(active); setStarted(true); }
    catch (cause: any) { setError(cause?.message || "The exam could not be started."); }
  }
  async function chooseAnswer(question: ContestQuestion, selectedIndex: number) {
    if (!attempt || !user || submitted || eliminated) return;
    const touched = questionTouchedAt.current[question.id] || Date.now(); questionTouchedAt.current[question.id] = touched;
    setAnswers((current) => ({ ...current, [question.id]: selectedIndex })); setSaved((current) => ({ ...current, [question.id]: false }));
    localStorage.setItem(`contest-draft:${roundId}:${question.id}`, String(selectedIndex));
    if (!online) { setError("You are offline. Reconnect and select the answer again to save it."); return; }
    setSavingIds((current) => new Set(current).add(question.id)); setError("");
    try { await submitContestAnswer(attempt.id, question.id, user.id, selectedIndex, Date.now() - touched); localStorage.removeItem(`contest-draft:${roundId}:${question.id}`); setSaved((current) => ({ ...current, [question.id]: true })); }
    catch (cause: any) { setError(cause?.message || "An answer could not be saved. Please select it again."); }
    finally { setSavingIds((current) => { const next = new Set(current); next.delete(question.id); return next; }); }
  }
  async function submitExam(automatic = false) {
    if (!attempt || finishing || submitted) return;
    if (!automatic && !window.confirm(`Submit your exam now? ${questions.length - Object.keys(answers).length} question(s) are unanswered.`)) return;
    setFinishing(true); setError("");
    try { const result = await finishContestAttempt(attempt.id); setSubmitted(true); if (round?.results_visible) setScore(result); if (document.fullscreenElement) await document.exitFullscreen().catch(() => undefined); }
    catch (cause: any) { setError(cause?.message || "Submission could not be completed. Please try again."); }
    finally { setFinishing(false); }
  }
  useEffect(() => { if (seconds === 0 && attempt && questions.length && !submitted && !eliminated && !finishing) void submitExam(true); }, [attempt, eliminated, finishing, questions.length, seconds, submitted]);

  const time = useMemo(() => { const remaining = Math.max(0, seconds); return `${String(Math.floor(remaining / 60)).padStart(2, "0")}:${String(remaining % 60).padStart(2, "0")}`; }, [seconds]);
  const answeredCount = Object.keys(answers).length;
  if (!authLoading && !user) return <Navigate to="/login" replace />;
  if (authLoading || loading) return <div className="flex min-h-dvh items-center justify-center bg-[#071315]"><Loader2 className="h-7 w-7 animate-spin text-teal-300" /></div>;
  if (error && !round) return <StateMessage icon={<AlertTriangle className="h-10 w-10 text-amber-300" />} title="Round unavailable" text={error} />;
  if (eliminated) return <StateMessage icon={<ShieldAlert className="h-10 w-10 text-red-300" />} title="Attempt ended" text="The published integrity threshold was reached. The event remains available for moderator review and appeal." />;
  if (submitted) return <StateMessage icon={<CheckCircle2 className="h-10 w-10 text-teal-300" />} title="Exam submitted" text={score !== null ? `Provisional score: ${score}%` : "Your answers are safely recorded. Results will appear after the moderator publishes them."} />;
  if (!started) return <div className="flex min-h-dvh items-center justify-center bg-[#071315] px-4 py-10 text-white"><div className="w-full max-w-xl rounded-3xl border border-teal-300/20 bg-[#0b1d20] p-6 shadow-2xl sm:p-10"><Trophy className="h-10 w-10 text-amber-300" /><p className="mt-6 text-xs font-bold uppercase tracking-[0.24em] text-teal-300">Competition exam</p><h1 className="mt-2 font-serif text-3xl font-bold sm:text-4xl">{round?.title}</h1><div className="mt-7 grid grid-cols-2 gap-3"><ExamStat label="Questions" value={String(questions.length)} /><ExamStat label="Time" value={`${Math.floor((round?.duration_seconds || 0) / 60)} min`} /></div><div className="mt-6 rounded-xl border border-white/10 p-4 text-sm leading-relaxed text-white/60"><p className="font-bold text-white">Before you enter</p><p className="mt-2">The timer starts when you press the button. The paper opens in full screen, answers save automatically, and leaving the exam window is recorded.</p></div>{error && <p className="mt-4 text-sm text-red-300">{error}</p>}<button onClick={() => void enterExam()} disabled={!questions.length} className="mt-6 flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-teal-300 px-5 font-bold text-[#071315] disabled:opacity-40"><Expand className="h-5 w-5" /> Enter full-screen exam</button></div></div>;

  return <main className="min-h-dvh bg-[#071315] text-white"><header className="sticky top-0 z-30 border-b border-white/10 bg-[#081719]/95 px-3 py-3 shadow-xl backdrop-blur sm:px-6"><div className="mx-auto flex max-w-[1500px] items-center justify-between gap-3"><div className="min-w-0"><p className="truncate text-xs uppercase tracking-wider text-white/40">{round?.title}</p><p className="mt-0.5 text-sm font-bold">{answeredCount}/{questions.length} answered</p></div><div className="flex items-center gap-2 sm:gap-4"><div className="text-right"><p className={`flex items-center gap-1.5 font-mono text-xl font-bold ${seconds < 300 ? "text-red-300" : "text-teal-200"}`}><Clock3 className="h-5 w-5" />{time}</p><p className={`text-[10px] font-bold ${online ? "text-emerald-300" : "text-amber-300"}`}>{online ? "Online · autosaving" : "Offline · not saving"}</p></div><button onClick={() => void submitExam()} disabled={finishing || savingIds.size > 0 || !online} className="min-h-11 rounded-lg bg-teal-300 px-3 text-xs font-bold text-[#071315] disabled:opacity-40 sm:px-5 sm:text-sm">{finishing ? "Submitting…" : "Submit exam"}</button></div></div></header>
    <div className="mx-auto grid max-w-[1500px] gap-5 px-3 py-5 lg:grid-cols-[240px_minmax(0,1fr)] lg:px-6"><aside className="lg:sticky lg:top-24 lg:h-fit"><div className="rounded-2xl border border-white/10 bg-[#0b1d20] p-4"><div className="flex items-center justify-between"><p className="text-sm font-bold">Question navigator</p>{!document.fullscreenElement && <button onClick={() => void document.documentElement.requestFullscreen?.()} className="rounded-lg border border-white/10 p-2 text-white/60" aria-label="Return to fullscreen"><Expand className="h-4 w-4" /></button>}</div><div className="mt-4 flex gap-2 overflow-x-auto pb-1 lg:grid lg:grid-cols-5">{questions.map((question, index) => <a key={question.id} href={`#question-${question.id}`} className={`flex h-9 min-w-9 items-center justify-center rounded-lg border text-xs font-bold ${answers[question.id] !== undefined ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-200" : "border-white/10 text-white/45"}`}>{index + 1}</a>)}</div><p className="mt-4 hidden text-xs leading-relaxed text-white/40 lg:block">All questions are continuous. You may change any answer before submitting.</p></div></aside>
      <section className="space-y-5 pb-28">{error && <div className="rounded-xl border border-red-300/20 bg-red-300/10 p-4 text-sm text-red-200">{error}</div>}{questions.map((question, index) => <article id={`question-${question.id}`} key={question.id} onMouseEnter={() => { questionTouchedAt.current[question.id] ||= Date.now(); }} className="scroll-mt-24 rounded-2xl border border-white/10 bg-[#0b1d20] p-5 shadow-lg sm:p-8"><div className="flex items-start justify-between gap-3"><p className="text-xs font-bold uppercase tracking-wider text-teal-300">Question {index + 1}</p><span className={`flex items-center gap-1 text-[11px] ${savingIds.has(question.id) ? "text-amber-200" : saved[question.id] ? "text-emerald-300" : "text-white/30"}`}>{savingIds.has(question.id) ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}{savingIds.has(question.id) ? "Saving" : saved[question.id] ? "Saved" : "Not answered"}</span></div><h2 className="mt-3 text-base font-semibold leading-relaxed sm:text-lg">{question.stem}</h2><div className="mt-5 grid gap-3">{question.options.map((option, optionIndex) => <button key={optionIndex} onClick={() => void chooseAnswer(question, optionIndex)} className={`flex min-h-14 w-full items-start gap-3 rounded-xl border p-4 text-left text-sm leading-relaxed transition ${answers[question.id] === optionIndex ? "border-teal-300 bg-teal-300/10 text-white ring-1 ring-teal-300/30" : "border-white/10 text-white/65 hover:border-white/25 hover:bg-white/[0.03]"}`}><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-current text-xs font-bold text-teal-300">{String.fromCharCode(65 + optionIndex)}</span><span>{option}</span></button>)}</div></article>)}<div className="rounded-2xl border border-teal-300/20 bg-teal-300/[0.06] p-6 text-center"><p className="font-bold">End of examination</p><p className="mt-2 text-sm text-white/50">You answered {answeredCount} of {questions.length} questions. Review above or submit when ready.</p><button onClick={() => void submitExam()} disabled={finishing || savingIds.size > 0 || !online} className="mt-5 min-h-12 rounded-xl bg-teal-300 px-8 font-bold text-[#071315] disabled:opacity-40">Submit final answers</button></div></section></div>
  </main>;
}

function ExamStat({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4"><p className="text-xs text-white/40">{label}</p><p className="mt-1 text-xl font-bold text-teal-200">{value}</p></div>; }
function StateMessage({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) { return <div className="flex min-h-dvh items-center justify-center bg-[#071315] px-5 text-white"><div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0b1d20] p-8 text-center"><div className="flex justify-center">{icon}</div><h1 className="mt-5 font-serif text-3xl font-bold">{title}</h1><p className="mt-3 text-sm leading-relaxed text-white/60">{text}</p></div></div>; }
