import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { ArrowLeft, CalendarClock, CheckCircle2, CircleDashed, Clock3, Loader2, LockKeyhole, ShieldCheck } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { getContestBySlug, getMyContestRegistration, loadContestRounds, type ContestRecord, type ContestRegistration, type ContestRound } from "@/lib/contest-store";
import { updateMetaTags } from "@/lib/seo";
import ContestCountdown from "@/components/ContestCountdown";

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
  const scheduledRound = rounds
    .filter((round) => ["scheduled", "lobby"].includes(round.status) && round.starts_at)
    .sort((a, b) => new Date(a.starts_at!).getTime() - new Date(b.starts_at!).getTime())[0];

  return <div className="min-h-dvh bg-[#071315] px-3 py-5 text-white sm:px-5 sm:py-10">
    <div className="mx-auto max-w-4xl">
      <nav className="flex items-center justify-between gap-3"><Link to="/contests" className="inline-flex items-center gap-2 text-sm text-white/50 hover:text-white"><ArrowLeft className="h-4 w-4" /> Contests</Link>{registration && <Link to={`/contests/${slug}/progress`} className="inline-flex text-sm font-bold text-teal-300 hover:text-teal-200">My progress</Link>}</nav>
      <header className="mt-5 border-y border-white/10 bg-white/[0.025] p-5 sm:mt-7 sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-300">Secure participant lobby</p>
        <h1 className="mt-3 break-words font-serif text-2xl font-bold leading-tight sm:text-4xl">{contest.title}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/55">Admission, round timing and system readiness appear here. Monitoring does not begin in the lobby, and microphone access is not requested.</p>
      </header>

      {error && <p className="mt-5 rounded-xl border border-red-300/20 bg-red-300/10 p-4 text-sm text-red-200">{error}</p>}

      <section className="mt-4 grid gap-4 sm:mt-6 md:grid-cols-[0.8fr,1.2fr] md:gap-5">
        <article className="border-y border-white/10 bg-white/[0.025] p-5 sm:p-6">
          <h2 className="flex items-center gap-2 font-bold"><ShieldCheck className="h-5 w-5 text-teal-300" /> Admission status</h2>
          {!registration ? <div className="mt-5"><LockKeyhole className="h-8 w-8 text-amber-300" /><p className="mt-3 font-bold">Not registered</p><p className="mt-2 text-sm text-white/50">Register first to begin institutional verification.</p><Link to={`/contests/${slug}/register`} className="mt-5 inline-flex rounded-lg bg-teal-300 px-4 py-2.5 text-sm font-bold text-[#071315]">Open registration</Link></div>
            : verified ? <div className="mt-5"><CheckCircle2 className="h-8 w-8 text-teal-300" /><p className="mt-3 font-bold text-teal-200">Entry verified</p><p className="mt-2 text-sm text-white/50">You can enter when a moderator opens the live round.</p></div>
            : <div className="mt-5"><CircleDashed className="h-8 w-8 text-amber-300" /><p className="mt-3 font-bold capitalize">{registration.status}</p><p className="mt-2 text-sm text-white/50">Your university entry must be verified before any contest questions can be accessed.</p></div>}
        </article>

        <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 sm:p-6">
          <h2 className="flex items-center gap-2 font-bold"><CalendarClock className="h-5 w-5 text-teal-300" /> Competition rounds</h2>
          <div className="mt-5 space-y-3">
            {rounds.length ? rounds.map((round) => <div key={round.id} className="grid grid-cols-[auto,1fr] gap-3 rounded-xl border border-white/10 bg-black/10 p-3 sm:flex sm:flex-wrap sm:items-center sm:gap-4 sm:p-4">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/5 text-sm font-bold text-white/50">{round.round_number}</span>
              <div className="min-w-0 flex-1"><p className="font-bold">{round.title}</p><p className="mt-1 flex items-center gap-1.5 text-xs text-white/45"><Clock3 className="h-3.5 w-3.5" /> {formatDuration(round.duration_seconds)} · {round.question_count || "Questions pending"}</p>{round.auto_eliminate && <p className="mt-1 text-xs text-amber-200/70">Automatic threshold: {round.tab_switch_limit} hidden tabs or {round.focus_loss_limit} focus losses.</p>}</div>
              <span className="col-span-2 w-fit rounded-full border border-white/10 px-3 py-1 text-xs font-bold capitalize text-white/55 sm:col-span-1">{round.status}</span>
            </div>) : <p className="text-sm text-white/45">Rounds have not been published yet.</p>}
          </div>
          {!liveRound && scheduledRound?.starts_at && <ContestCountdown startsAt={scheduledRound.starts_at} className="mt-5 rounded-xl border border-teal-300/20 bg-teal-300/[0.07] p-4" />}
          {!liveRound && !scheduledRound?.starts_at && <div className="mt-5 rounded-xl border border-amber-300/15 bg-amber-300/[0.07] p-4"><p className="text-sm font-bold text-amber-200">Schedule not announced</p><p className="mt-1 text-xs leading-relaxed text-white/45">The moderator has not assigned a start date and time yet.</p></div>}
          {liveRound && verified && <div className="mt-5 rounded-xl border border-teal-300/20 bg-teal-300/10 p-4"><p className="font-bold text-teal-200">{liveRound.title} is live</p><p className="mt-1 text-xs text-white/50">Your timer begins when the secure attempt is created.</p><Link to={`/contests/${slug}/round/${liveRound.id}`} className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-teal-300 px-4 py-2.5 text-sm font-bold text-[#071315] sm:w-auto">Enter live round</Link></div>}
        </article>
      </section>
    </div>
  </div>;
}
