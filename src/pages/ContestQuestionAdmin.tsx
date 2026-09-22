import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { ArrowLeft, FileJson2, Loader2, ShieldCheck } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { importContestQuestions, loadAdminContests, loadContestRounds, type ContestRecord, type ContestRound } from "@/lib/contest-store";

const example = JSON.stringify([{ stem: "Which structure forms the anatomical snuffbox floor?", options: ["Scaphoid and trapezium", "Lunate and capitate", "Radius and ulna", "Pisiform and hamate"], correctIndex: 0, explanation: "The scaphoid and trapezium form the floor." }], null, 2);

export default function ContestQuestionAdmin() {
  const { isAdmin, loading: authLoading } = useAuth();
  const [contests, setContests] = useState<ContestRecord[]>([]);
  const [rounds, setRounds] = useState<ContestRound[]>([]);
  const [contestId, setContestId] = useState("");
  const [roundId, setRoundId] = useState("");
  const [source, setSource] = useState(example);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => { if (isAdmin) loadAdminContests().then((rows) => { setContests(rows); setContestId(rows[0]?.id || ""); }); }, [isAdmin]);
  useEffect(() => { if (contestId) loadContestRounds(contestId).then((rows) => { setRounds(rows); setRoundId(rows[0]?.id || ""); }); }, [contestId]);
  if (!authLoading && !isAdmin) return <Navigate to="/login" replace />;
  if (authLoading) return <div className="flex min-h-[70vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  async function upload() {
    setSaving(true); setMessage("");
    try {
      const parsed = JSON.parse(source);
      if (!Array.isArray(parsed)) throw new Error("The JSON must be an array of questions.");
      const count = await importContestQuestions(roundId, parsed);
      setMessage(`${count} question${count === 1 ? "" : "s"} imported. The answer keys were stored privately.`);
      setRounds((items) => items.map((round) => round.id === roundId ? { ...round, question_count: count } : round));
    } catch (cause: any) { setMessage(cause?.message || "Question import failed."); }
    finally { setSaving(false); }
  }

  return <div className="mx-auto max-w-4xl px-5 py-10">
    <Link to="/admin/contests" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Contest administration</Link>
    <div className="mt-7 flex items-center gap-3"><div className="rounded-xl bg-primary/10 p-3"><FileJson2 className="h-6 w-6 text-primary" /></div><div><h1 className="font-serif text-3xl font-bold">Question-bank import</h1><p className="text-sm text-muted-foreground">Replace an unlocked scheduled round with a reviewed JSON snapshot.</p></div></div>
    <div className="mt-8 grid gap-5 border bg-card p-5 sm:grid-cols-2"><label className="text-sm font-semibold">Contest<select value={contestId} onChange={(e) => setContestId(e.target.value)} className="mt-2 w-full rounded-md border bg-background px-3 py-2">{contests.map((contest) => <option key={contest.id} value={contest.id}>{contest.title}</option>)}</select></label><label className="text-sm font-semibold">Scheduled round<select value={roundId} onChange={(e) => setRoundId(e.target.value)} className="mt-2 w-full rounded-md border bg-background px-3 py-2">{rounds.map((round) => <option key={round.id} value={round.id}>{round.title} · {round.question_count} questions · {round.status}</option>)}</select></label></div>
    <div className="mt-5 border bg-card p-5"><p className="flex items-center gap-2 text-sm font-bold"><ShieldCheck className="h-4 w-4 text-primary" /> Secure import format</p><p className="mt-2 text-xs leading-relaxed text-muted-foreground">Use zero-based <code>correctIndex</code>: 0=A, 1=B, 2=C. Importing replaces the selected round atomically and is blocked after the round is locked or opened.</p><textarea value={source} onChange={(e) => setSource(e.target.value)} rows={18} spellCheck={false} className="mt-4 w-full border bg-background p-4 font-mono text-xs" />{message && <p className="mt-4 rounded-lg bg-muted p-3 text-sm">{message}</p>}<button disabled={saving || !roundId} onClick={() => void upload()} className="mt-4 flex items-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-bold text-primary-foreground disabled:opacity-40">{saving && <Loader2 className="h-4 w-4 animate-spin" />} Validate and replace round</button></div>
  </div>;
}
