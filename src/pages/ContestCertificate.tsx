import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { Award, Loader2, Printer, ShieldCheck } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { getContestBySlug, getMyContestRegistration, loadContestRounds, loadMyContestAttempts, type ContestAttempt, type ContestRecord, type ContestRegistration, type ContestRound } from "@/lib/contest-store";

export default function ContestCertificatePage() {
  const { slug = "", attemptId = "" } = useParams();
  const { user, loading: authLoading } = useAuth();
  const [record, setRecord] = useState<{ contest: ContestRecord; registration: ContestRegistration; round: ContestRound; attempt: ContestAttempt } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (authLoading || !user) return;
    getContestBySlug(slug).then(async (contest) => {
      if (!contest) throw new Error("Contest not found.");
      const registration = await getMyContestRegistration(contest.id, user.id);
      if (!registration) throw new Error("No registration was found for this contest.");
      const [rounds, attempts] = await Promise.all([loadContestRounds(contest.id), loadMyContestAttempts(registration.id)]);
      const attempt = attempts.find((item) => item.id === attemptId);
      const round = rounds.find((item) => item.id === attempt?.round_id);
      if (!attempt || attempt.status !== "submitted" || !round?.results_visible || attempt.score === null) throw new Error("This certificate is not available yet.");
      setRecord({ contest, registration, round, attempt });
    }).catch((cause) => setError(cause?.message || "Certificate unavailable."));
  }, [attemptId, authLoading, slug, user]);

  if (!authLoading && !user) return <Navigate to="/login" replace />;
  if (authLoading || (!record && !error)) return <div className="flex min-h-dvh items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>;
  if (!record) return <div className="mx-auto max-w-lg px-5 py-24 text-center"><Award className="mx-auto h-10 w-10 text-muted-foreground" /><h1 className="mt-4 text-2xl font-bold">Certificate unavailable</h1><p className="mt-2 text-muted-foreground">{error}</p><Link to={`/contests/${slug}/register`} className="mt-6 inline-flex rounded-lg border px-4 py-2 font-bold">Return to contest</Link></div>;

  const { contest, registration, round, attempt } = record;
  const university = registration.contest_universities?.name || "Verified university representative";
  return <main className="certificate-page min-h-dvh bg-slate-100 px-4 py-8 text-slate-900">
    <style>{`@media print { body * { visibility: hidden !important; } .certificate-sheet, .certificate-sheet * { visibility: visible !important; } .certificate-sheet { position: fixed; inset: 0; width: 100%; min-height: 100vh; box-shadow: none !important; } .certificate-actions { display: none !important; } @page { size: A4 landscape; margin: 0; } }`}</style>
    <div className="certificate-actions mx-auto mb-5 flex max-w-5xl items-center justify-between gap-3"><Link to={`/contests/${slug}/register`} className="rounded-lg border bg-white px-4 py-2 text-sm font-bold">Back to dashboard</Link><button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg bg-teal-800 px-5 py-2.5 text-sm font-bold text-white"><Printer className="h-4 w-4" /> Download / save as PDF</button></div>
    <section className="certificate-sheet relative mx-auto flex aspect-[1.414/1] max-w-5xl flex-col justify-between overflow-hidden border-[12px] border-teal-900 bg-[#fffdf5] p-8 text-center shadow-2xl sm:p-14">
      <div className="absolute inset-3 border border-amber-500/60" />
      <div className="relative"><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-teal-900 text-amber-300"><Award className="h-9 w-9" /></div><p className="mt-4 text-sm font-black uppercase tracking-[0.35em] text-teal-900">Ompath Study</p><h1 className="mt-5 font-serif text-4xl font-bold sm:text-6xl">Certificate of Achievement</h1><p className="mt-4 text-sm uppercase tracking-[0.2em] text-slate-500">Official contest result</p></div>
      <div className="relative py-6"><p className="text-sm text-slate-500">This certifies that</p><h2 className="mt-3 font-serif text-3xl font-bold text-teal-950 sm:text-5xl">{user?.user_metadata?.full_name || user?.email || "Contest Participant"}</h2><p className="mt-4 text-lg">representing <strong>{university}</strong></p><p className="mx-auto mt-5 max-w-3xl text-base leading-relaxed text-slate-600">completed <strong>{round.title}</strong> in <strong>{contest.title}</strong> with an official score of</p><p className="mt-3 font-serif text-5xl font-black text-amber-600 sm:text-7xl">{attempt.score}%</p></div>
      <div className="relative grid grid-cols-2 gap-6 border-t border-slate-300 pt-5 text-left text-xs text-slate-500"><div><p className="font-bold uppercase tracking-wider text-slate-700">Issued</p><p className="mt-1">{new Date(attempt.submitted_at || Date.now()).toLocaleString("en-KE", { dateStyle: "long", timeStyle: "short" })}</p></div><div className="text-right"><p className="flex items-center justify-end gap-1 font-bold uppercase tracking-wider text-slate-700"><ShieldCheck className="h-4 w-4 text-teal-700" /> Verification code</p><p className="mt-1 font-mono">{attempt.id}</p></div></div>
    </section>
  </main>;
}
