import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Loader2, LockKeyhole, Maximize, MonitorUp, ShieldCheck, Wifi } from "lucide-react";
import { CONTEST_RULES } from "@/lib/contest";
import { getContestBySlug, type ContestRecord } from "@/lib/contest-store";
import { updateMetaTags } from "@/lib/seo";

const checks = [
  { icon: LockKeyhole, label: "Verified account", detail: "Required for live contests" },
  { icon: Wifi, label: "Stable connection", detail: "Reconnect events will be logged" },
  { icon: Maximize, label: "Fullscreen mode", detail: "Required during protected rounds" },
  { icon: MonitorUp, label: "One active device", detail: "Concurrent sessions are blocked" },
];

function useTypedText(text: string, speed = 22) {
  const [shown, setShown] = useState("");
  useEffect(() => {
    setShown("");
    let index = 0;
    const timer = window.setInterval(() => {
      index += 1;
      setShown(text.slice(0, index));
      if (index >= text.length) window.clearInterval(timer);
    }, speed);
    return () => window.clearInterval(timer);
  }, [text, speed]);
  return shown;
}

export default function ContestBriefing() {
  const { slug } = useParams();
  const [accepted, setAccepted] = useState(false);
  const [contest, setContest] = useState<ContestRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const sequence = useMemo(() => "SECURE CONTEST ENVIRONMENT // PREVIEW MODE", []);
  const typed = useTypedText(sequence);

  useEffect(() => {
    updateMetaTags({ title: `Contest Briefing | OmpathStudy`, description: "Preview the secure OmpathStudy Mega Contest participant briefing." });
    if (!slug) { setLoading(false); return; }
    getContestBySlug(slug).then(setContest).finally(() => setLoading(false));
  }, [slug]);

  if (loading) return <div className="flex min-h-dvh items-center justify-center bg-[#03090a]"><Loader2 className="h-6 w-6 animate-spin text-teal-300" /></div>;
  if (!contest) return <Navigate to="/contests" replace />;

  return (
    <div className="min-h-dvh bg-[#03090a] text-white">
      <div className="mx-auto max-w-5xl px-5 py-8 sm:py-12">
        <Link to="/contests" className="inline-flex items-center gap-2 text-sm text-white/50 hover:text-white"><ArrowLeft className="h-4 w-4" /> Contest overview</Link>

        <div className="mt-8 overflow-hidden rounded-2xl border border-teal-300/20 bg-[#071315] shadow-2xl shadow-teal-950/30">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-3 font-mono text-[11px] uppercase tracking-[0.14em] text-teal-300/75">
            <span>{typed}<span className="ml-1 animate-pulse">▌</span></span>
            <span className="hidden capitalize sm:inline">Stage: {contest.stage}</span>
          </div>

          <div className="p-6 sm:p-10">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-teal-300/20 bg-teal-300/10"><ShieldCheck className="h-7 w-7 text-teal-300" /></div>
            <p className="mt-7 text-xs font-bold uppercase tracking-[0.2em] text-teal-300">Participant briefing</p>
            <h1 className="mt-3 max-w-3xl font-serif text-3xl font-bold sm:text-5xl">{contest.title}</h1>
            <p className="mt-4 max-w-2xl leading-relaxed text-white/55">{contest.subtitle || "Review the contest requirements before registration and entry."}</p>

            <div className="mt-9 grid gap-3 sm:grid-cols-2">
              {checks.map(({ icon: Icon, label, detail }) => (
                <div key={label} className="flex gap-4 rounded-xl border border-white/10 bg-white/[0.025] p-4">
                  <Icon className="mt-0.5 h-5 w-5 shrink-0 text-teal-300" />
                  <div><p className="text-sm font-bold">{label}</p><p className="mt-1 text-xs text-white/40">{detail}</p></div>
                </div>
              ))}
            </div>

            <div className="mt-9 border-t border-white/10 pt-8">
              <h2 className="text-sm font-bold uppercase tracking-[0.15em] text-white/70">Contest instructions</h2>
              <ol className="mt-5 space-y-4">
                {CONTEST_RULES.map((rule, index) => (
                  <li key={rule} className="flex gap-4 text-sm leading-relaxed text-white/55"><span className="font-mono text-teal-300">{String(index + 1).padStart(2, "0")}</span><span>{rule}</span></li>
                ))}
              </ol>
            </div>

            <label className="mt-9 flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-white/[0.025] p-4">
              <input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} className="mt-0.5 h-4 w-4 accent-teal-300" />
              <span className="text-sm leading-relaxed text-white/65">I understand how integrity events will be recorded and reviewed during an official contest.</span>
            </label>

            {accepted ? <Link to={contest.stage === "registration" ? `/contests/${contest.slug}/register` : `/contests/${contest.slug}/lobby`} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-teal-300 px-5 py-3.5 text-sm font-bold text-[#071315] transition hover:bg-teal-200">
              <CheckCircle2 className="h-4 w-4" /> {contest.stage === "registration" ? "Continue to registration" : "Enter official lobby"}
            </Link> : <button disabled className="mt-5 inline-flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl bg-teal-300 px-5 py-3.5 text-sm font-bold text-[#071315] opacity-30">
              <CheckCircle2 className="h-4 w-4" /> Accept the instructions to continue
            </button>}
            <p className="mt-3 text-center text-xs text-white/30">Monitoring begins only after you enter an active protected round.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
