import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { Loader2, ShieldCheck, Trophy } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { loadAdminContests, updateContestStage, type ContestRecord } from "@/lib/contest-store";
import type { ContestStage } from "@/lib/contest";

const stages: ContestStage[] = ["concept", "registration", "live", "completed"];

export default function ContestAdmin() {
  const { isAdmin, loading: authLoading } = useAuth();
  const [contests, setContests] = useState<ContestRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  useEffect(() => { if (isAdmin) loadAdminContests().then(setContests).finally(() => setLoading(false)); }, [isAdmin]);
  if (!authLoading && !isAdmin) return <Navigate to="/login" replace />;
  if (authLoading || loading) return <div className="flex min-h-[70vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  async function changeStage(contest: ContestRecord, stage: ContestStage) {
    setSavingId(contest.id); setMessage("");
    try {
      await updateContestStage(contest.id, stage);
      setContests((items) => items.map((item) => item.id === contest.id ? { ...item, stage } : item));
      setMessage(`${contest.title} is now ${stage}.`);
    } catch (cause: any) { setMessage(cause?.message || "The contest could not be updated."); }
    finally { setSavingId(null); }
  }

  return <div className="mx-auto max-w-5xl px-5 py-10">
    <div className="flex flex-wrap items-center justify-between gap-4"><div className="flex items-center gap-3"><div className="rounded-xl bg-primary/10 p-3"><Trophy className="h-6 w-6 text-primary" /></div><div><h1 className="font-serif text-3xl font-bold">Contest administration</h1><p className="text-sm text-muted-foreground">Control registration and competition stages.</p></div></div><Link to="/admin/contests/questions" className="rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground">Manage question bank</Link></div>
    {message && <p className="mt-6 rounded-lg border bg-muted p-3 text-sm">{message}</p>}
    <div className="mt-8 space-y-4">{contests.map((contest) => <article key={contest.id} className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center"><div><p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary"><ShieldCheck className="h-4 w-4" /> Published contest</p><h2 className="mt-2 text-lg font-bold">{contest.title}</h2><p className="mt-1 text-sm text-muted-foreground">Changing to registration immediately permits eligible signed-in students to submit.</p></div>
      <label className="text-sm font-semibold">Stage<select value={contest.stage} disabled={savingId === contest.id} onChange={(e) => void changeStage(contest, e.target.value as ContestStage)} className="mt-2 block min-w-48 rounded-md border bg-background px-3 py-2 capitalize">{stages.map((stage) => <option key={stage}>{stage}</option>)}</select></label></div>
    </article>)}</div>
  </div>;
}
