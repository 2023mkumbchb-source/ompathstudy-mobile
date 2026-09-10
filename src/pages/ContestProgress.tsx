import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, Route } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { getContestBySlug, getMyContestRegistration, loadMyContestAdvancements, type ContestAdvancement } from "@/lib/contest-store";

export default function ContestProgress() {
  const { slug = "" } = useParams(), { user, loading: authLoading } = useAuth();
  const [items, setItems] = useState<ContestAdvancement[]>([]), [loading, setLoading] = useState(true), [missing, setMissing] = useState(false);
  useEffect(() => { if (!user || authLoading) return; getContestBySlug(slug).then(async (contest) => { if (!contest) return setMissing(true); const registration = await getMyContestRegistration(contest.id, user.id); if (!registration) return setMissing(true); setItems(await loadMyContestAdvancements(contest.id, registration.id)); }).finally(() => setLoading(false)); }, [authLoading, slug, user]);
  if (!authLoading && !user) return <Navigate to="/login" replace />;
  if (authLoading || loading) return <div className="flex min-h-[70vh] items-center justify-center bg-[#071315]"><Loader2 className="h-6 w-6 animate-spin text-teal-300" /></div>;
  if (missing) return <Navigate to={`/contests/${slug}/lobby`} replace />;
  return <div className="min-h-dvh bg-[#071315] px-5 py-10 text-white"><div className="mx-auto max-w-3xl"><Link to={`/contests/${slug}/lobby`} className="inline-flex items-center gap-2 text-sm text-white/50"><ArrowLeft className="h-4 w-4" /> Contest lobby</Link><header className="mt-7 rounded-2xl border border-white/10 bg-white/[0.035] p-6"><Route className="h-7 w-7 text-teal-300" /><h1 className="mt-3 font-serif text-3xl font-bold">My contest progression</h1><p className="mt-2 text-sm text-white/50">Only you and authorised contest administrators can see these decisions.</p></header><div className="mt-6 space-y-3">{items.length ? items.map((item) => <article key={item.id} className="rounded-xl border border-white/10 bg-white/[0.035] p-5"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-bold">{item.contest_rounds?.title || "Contest round"}</h2><span className="rounded-full border border-teal-300/20 px-3 py-1 text-xs font-bold capitalize text-teal-200">{item.decision}</span></div><p className="mt-3 text-sm text-white/60">{item.reason}</p></article>) : <p className="rounded-xl border border-dashed border-white/15 p-8 text-center text-sm text-white/45">No progression decision has been published for you yet.</p>}</div></div></div>;
}
