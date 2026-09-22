import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, Medal, Trophy } from "lucide-react";
import { getContestBySlug, loadContestLeaderboard, type ContestRecord, type ContestUniversityResult } from "@/lib/contest-store";
import { updateMetaTags } from "@/lib/seo";

export default function ContestLeaderboard() {
  const { slug = "" } = useParams();
  const [contest, setContest] = useState<ContestRecord | null>(null);
  const [results, setResults] = useState<ContestUniversityResult[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { updateMetaTags({ title: "Contest Leaderboard | OmpathStudy", description: "Published inter-university medical contest results." }); getContestBySlug(slug).then(async (record) => { setContest(record); if (record) setResults(await loadContestLeaderboard(record.id)); }).finally(() => setLoading(false)); }, [slug]);
  if (loading) return <div className="flex min-h-[70vh] items-center justify-center bg-[#071315]"><Loader2 className="h-6 w-6 animate-spin text-teal-300" /></div>;
  if (!contest) return <Navigate to="/contests" replace />;
  return <div className="min-h-dvh bg-[#071315] px-5 py-10 text-white"><div className="mx-auto max-w-4xl"><Link to="/contests" className="inline-flex items-center gap-2 text-sm text-white/50 hover:text-white"><ArrowLeft className="h-4 w-4" /> Contest overview</Link><header className="mt-7 border-y border-white/10 bg-white/[0.025] p-7"><Trophy className="h-8 w-8 text-amber-300" /><h1 className="mt-4 font-serif text-4xl font-bold">University leaderboard</h1><p className="mt-2 text-white/50">{contest.title} · only moderator-published, closed-round results appear here.</p></header><div className="mt-6 space-y-3">{results.length ? results.map((result) => <article key={result.id} className="flex items-center gap-4 border-y border-white/10 bg-white/[0.025] p-5"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/5 text-lg font-bold text-teal-300">{result.rank}</span><Medal className={`h-5 w-5 ${result.rank <= 3 ? "text-amber-300" : "text-white/25"}`} /><div className="min-w-0 flex-1"><h2 className="font-bold">{result.contest_universities?.name || "University"}</h2><p className="mt-1 text-xs text-white/40">{result.contest_rounds?.title} · {result.participant_count} participant{result.participant_count === 1 ? "" : "s"}</p></div><div className="text-right"><p className="font-bold text-teal-200">{Number(result.total_points).toFixed(1)} pts</p><p className="text-xs text-white/40">{Number(result.average_score).toFixed(1)}% average</p></div></article>) : <div className="border-y border-dashed border-white/15 p-10 text-center text-white/45">No results have been published. The inaugural season still has a clean record.</div>}</div></div></div>;
}
