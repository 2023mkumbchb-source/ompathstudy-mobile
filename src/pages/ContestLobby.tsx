import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { ArrowLeft, CalendarClock, CheckCircle2, CircleDashed, Clock3, Loader2, LockKeyhole, ShieldCheck } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { getContestBySlug, getMyContestRegistration, loadContestRounds, type ContestRecord, type ContestRegistration, type ContestRound } from "@/lib/contest-store";
import { updateMetaTags } from "@/lib/seo";

function formatDuration(seconds: number) {
  const minutes = Math.round(seconds / 60);
  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}

export default function ContestLobby() {
  const { slug = "" } = useParams();
  const { user, loading: authLoading } = useAuth();
  const [contest, setContest] = useState<ContestRecord | null>(null);
  const [registration, setRegistration] = useState<ContestRegistration | null>(null);
  const [rounds, setRounds] = useState<ContestRound[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    updateMetaTags({ title: "Contest Lobby | OmpathStudy", description: "Check your verified contest admission and upcoming OmpathStudy rounds." });
    if (authLoading || !user) return;
    getContestBySlug(slug).then(async (record) => {
      setContest(record);
      if (!record) return;
      const [entry, roundRows] = await Promise.all([getMyContestRegistration(record.id, user.id), loadContestRounds(record.id)]);
      setRegistration(entry);
      setRounds(roundRows);
    }).catch(() => setError("The contest lobby could not be loaded.")).finally(() => setLoading(false));
  }, [authLoading, slug, user]);

  if (!authLoading && !user) return <Navigate to="/login" replace />;
  if (authLoading || loading) return <div className="flex min-h-[70vh] items-center justify-center bg-[#071315]"><Loader2 className="h-6 w-6 animate-spin text-teal-300" /></div>;
  if (!contest) return <Navigate to="/contests" replace />;

  const verified = registration?.status === "verified";
  const liveRound = rounds.find((round) => round.status === "live");

  return <div className="min-h-dvh bg-[#071315] px-5 py-10 text-white">
    <div className="mx-auto max-w-4xl">
      <Link to="/contests" className="inline-flex items-center gap-2 text-sm text-white/50 hover:text-white"><ArrowLeft className="h-4 w-4" /> Contest overview</Link>
      <header className="mt-7 rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_80%_0%,rgba(45,212,191,0.13),transparent_35%),rgba(255,255,255,0.035)] p-6 sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-300">Secure participant lobby</p>
        <h1 className="mt-3 font-serif text-3xl font-bold sm:text-4xl">{contest.title}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/55">Admission, round timing and system readiness appear here. Monitoring does not begin in the lobby, and microphone access is not requested.</p>
      </header>

      {error && <p className="mt-5 rounded-xl border border-red-300/20 bg-red-300/10 p-4 text-sm text-red-200">{error}</p>}

      <section className="mt-6 grid gap-5 md:grid-cols-[0.8fr,1.2fr]">
        <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-6">
          <h2 className="flex items-center gap-2 font-bold"><ShieldCheck className="h-5 w-5 text-teal-300" /> Admission status</h2>
          {!registration ? <div className="mt-5"><LockKeyhole className="h-8 w-8 text-amber-300" /><p className="mt-3 font-bold">Not registered</p><p className="mt-2 text-sm text-white/50">Register first to begin institutional verification.</p><Link to={`/contests/${slug}/register`} className="mt-5 inline-flex rounded-lg bg-teal-300 px-4 py-2.5 text-sm font-bold text-[#071315]">Open registration</Link></div>
            : verified ? <div className="mt-5"><CheckCircle2 className="h-8 w-8 text-teal-300" /><p className="mt-3 font-bold text-teal-200">Entry verified</p><p className="mt-2 text-sm text-white/50">You can enter when a moderator opens the live round.</p></div>
            : <div className="mt-5"><CircleDashed className="h-8 w-8 text-amber-300" /><p className="mt-3 font-bold capitalize">{registration.status}</p><p className="mt-2 text-sm text-white/50">Your university entry must be verified before any contest questions can be accessed.</p></div>}
        </article>

        <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-6">
          <h2 className="flex items-center gap-2 font-bold"><CalendarClock className="h-5 w-5 text-teal-300" /> Competition rounds</h2>
          <div className="mt-5 space-y-3">
            {rounds.length ? rounds.map((round) => <div key={round.id} className="flex flex-wrap items-center gap-4 rounded-xl border border-white/10 bg-black/10 p-4">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/5 text-sm font-bold text-white/50">{round.round_number}</span>
              <div className="min-w-0 flex-1"><p className="font-bold">{round.title}</p><p className="mt-1 flex items-center gap-1.5 text-xs text-white/45"><Clock3 className="h-3.5 w-3.5" /> {formatDuration(round.duration_seconds)} · {round.question_count || "Questions pending"}</p></div>
              <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-bold capitalize text-white/55">{round.status}</span>
            </div>) : <p className="text-sm text-white/45">Rounds have not been published yet.</p>}
          </div>
          {!liveRound && <div className="mt-5 rounded-xl border border-amber-300/15 bg-amber-300/[0.07] p-4"><p className="text-sm font-bold text-amber-200">Schedule not announced</p><p className="mt-1 text-xs leading-relaxed text-white/45">No attempt can start until a verified moderator opens a scheduled round.</p></div>}
          {liveRound && verified && <div className="mt-5 rounded-xl border border-teal-300/20 bg-teal-300/10 p-4"><p className="font-bold text-teal-200">{liveRound.title} is live</p><p className="mt-1 text-xs text-white/50">The timed question runner will be enabled after moderator and question-bank testing is complete.</p></div>}
        </article>
      </section>
    </div>
  </div>;
}
