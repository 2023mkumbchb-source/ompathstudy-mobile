import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { ArrowLeft, FlaskConical, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { loadAdminContests, loadContestQuestions, loadContestRounds, scoreContestRehearsal, type ContestQuestion, type ContestRecord, type ContestRound, type RehearsalResult } from "@/lib/contest-store";

export default function ContestRehearsal() {
  const { isAdmin, loading: authLoading } = useAuth();
  const [contests, setContests] = useState<ContestRecord[]>([]), [contestId, setContestId] = useState("");
  const [rounds, setRounds] = useState<ContestRound[]>([]), [roundId, setRoundId] = useState("");
  const [questions, setQuestions] = useState<ContestQuestion[]>([]), [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<RehearsalResult | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState("");
  useEffect(() => { if (isAdmin) loadAdminContests().then((rows) => { setContests(rows); setContestId(rows[0]?.id || ""); }); }, [isAdmin]);
  useEffect(() => { if (contestId) loadContestRounds(contestId).then((rows) => { setRounds(rows); setRoundId(rows[0]?.id || ""); }); }, [contestId]);
  useEffect(() => { if (roundId) loadContestQuestions(roundId).then(setQuestions); else setQuestions([]); setAnswers({}); setResult(null); }, [roundId]);
  if (!authLoading && !isAdmin) return <Navigate to="/login" replace />;
  if (authLoading) return <div className="flex min-h-[70vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  async function score() { setBusy(true); setError(""); try { setResult(await scoreContestRehearsal(roundId, answers)); } catch (cause: any) { setError(cause?.message || "Rehearsal could not be scored."); } finally { setBusy(false); } }
  return <div className="mx-auto max-w-4xl px-5 py-10"><Link to="/admin/contests" className="inline-flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft className="h-4 w-4" /> Contest administration</Link>
    <header className="mt-7 rounded-2xl border bg-card p-6"><p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary"><FlaskConical className="h-4 w-4" /> Isolated rehearsal</p><h1 className="mt-2 font-serif text-3xl font-bold">Run the question experience safely</h1><p className="mt-2 text-sm text-muted-foreground">This scores against the private answer key without creating registrations, attempts, answers, results, or integrity events. It cannot open the production round.</p></header>
    <div className="mt-6 grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold">Contest<select value={contestId} onChange={(e) => setContestId(e.target.value)} className="mt-2 w-full rounded-md border bg-background px-3 py-2">{contests.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select></label><label className="text-sm font-semibold">Round<select value={roundId} onChange={(e) => setRoundId(e.target.value)} className="mt-2 w-full rounded-md border bg-background px-3 py-2">{rounds.map((r) => <option key={r.id} value={r.id}>{r.title} · {r.status}</option>)}</select></label></div>
    {error && <p className="mt-5 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm">{error}</p>}
    <div className="mt-7 space-y-5">{questions.map((q, index) => <article key={q.id} className="rounded-xl border bg-card p-5"><p className="text-xs font-bold uppercase text-primary">Question {index + 1}</p><h2 className="mt-2 font-bold">{q.stem}</h2><div className="mt-4 grid gap-2">{q.options.map((option, optionIndex) => <button key={optionIndex} onClick={() => setAnswers((old) => ({ ...old, [q.id]: optionIndex }))} className={`rounded-lg border p-3 text-left text-sm ${answers[q.id] === optionIndex ? "border-primary bg-primary/10" : "hover:bg-muted"}`}>{String.fromCharCode(65 + optionIndex)}. {option}</button>)}</div>{result && <p className={`mt-3 text-sm font-bold ${result.details[index]?.correct ? "text-emerald-600" : "text-red-600"}`}>{result.details[index]?.correct ? "Correct" : "Review needed"}{result.details[index]?.explanation ? ` — ${result.details[index].explanation}` : ""}</p>}</article>)}</div>
    {!questions.length && <p className="mt-8 rounded-xl border border-dashed p-8 text-center text-muted-foreground">No questions are admitted to this round. Import the bank before rehearsing.</p>}
    {questions.length > 0 && <div className="sticky bottom-4 mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-background/95 p-4 shadow-lg backdrop-blur"><p className="text-sm">{result ? `${result.correct}/${result.total} correct · ${result.score}%` : `${Object.keys(answers).length}/${questions.length} answered`}</p><button disabled={busy} onClick={() => void score()} className="rounded-lg bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50">Score rehearsal</button></div>}
  </div>;
}
