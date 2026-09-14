import { FormEvent, useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { ArrowLeft, Award, BellRing, CheckCircle2, Loader2, LockKeyhole, School, ShieldCheck, Trophy } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { CONTEST_RULES } from "@/lib/contest";
import { getContestBySlug, getMyContestRegistration, loadContestPlatform, loadContestRounds, loadMyContestAttempts, proposeContestUniversity, registerForContest, type ContestAttempt, type ContestRecord, type ContestRegistration, type ContestRound, type ContestUniversity } from "@/lib/contest-store";
import { updateMetaTags } from "@/lib/seo";
import ContestCountdown from "@/components/ContestCountdown";
import ContestCalendarActions from "@/components/ContestCalendarActions";

export default function ContestRegistrationPage() {
  const { slug = "" } = useParams();
  const { user, loading: authLoading } = useAuth();
  const [contest, setContest] = useState<ContestRecord | null>(null);
  const [universities, setUniversities] = useState<ContestUniversity[]>([]);
  const [registration, setRegistration] = useState<ContestRegistration | null>(null);
  const [rounds, setRounds] = useState<ContestRound[]>([]);
  const [attempts, setAttempts] = useState<ContestAttempt[]>([]);
  const [universityId, setUniversityId] = useState("");
  const [newUniversityName, setNewUniversityName] = useState("");
  const [newUniversityAbbreviation, setNewUniversityAbbreviation] = useState("");
  const [studyYear, setStudyYear] = useState("3");
  const [representation, setRepresentation] = useState<"individual" | "university_team">("individual");
  const [teamName, setTeamName] = useState("");
  const [teamRole, setTeamRole] = useState<"captain" | "member">("member");
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    updateMetaTags({ title: "Contest Registration | OmpathStudy", description: "Register for an OmpathStudy inter-university medical contest." });
    Promise.all([getContestBySlug(slug), loadContestPlatform()]).then(async ([record, platform]) => {
      setContest(record);
      setUniversities(platform.universities);
      if (record) {
        setRounds(await loadContestRounds(record.id));
        if (user) { const entry = await getMyContestRegistration(record.id, user.id); setRegistration(entry); if (entry) setAttempts(await loadMyContestAttempts(entry.id)); }
      }
    }).catch(() => setError("Contest registration could not be loaded.")).finally(() => setLoading(false));
  }, [slug, user]);

  if (!authLoading && !user) return <Navigate to="/login" replace />;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!contest || !user || !universityId || !accepted) return;
    setSaving(true); setError("");
    try {
      let selectedUniversityId = universityId;
      if (universityId === "__new__") {
        if (newUniversityName.trim().length < 3) throw new Error("Enter your university's full name.");
        const proposed = await proposeContestUniversity(newUniversityName, newUniversityAbbreviation);
        selectedUniversityId = proposed.id;
      }
      setRegistration(await registerForContest({ contestId: contest.id, userId: user.id, universityId: selectedUniversityId, studyYear: Number(studyYear), representation, teamName, teamRole }));
    } catch (cause: any) {
      setError(cause?.code === "23505" ? "You are already registered for this contest." : cause?.message || "Registration failed.");
    } finally { setSaving(false); }
  }

  if (loading || authLoading) return <div className="flex min-h-[70vh] items-center justify-center bg-[#071315]"><Loader2 className="h-6 w-6 animate-spin text-teal-300" /></div>;
  if (!contest) return <Navigate to="/contests" replace />;
  const isOpen = contest.stage === "registration";
  const nextRound = rounds.filter((round) => ["scheduled", "lobby"].includes(round.status) && round.starts_at).sort((a, b) => new Date(a.starts_at!).getTime() - new Date(b.starts_at!).getTime())[0];
  const latestResult = attempts.find((attempt) => attempt.status === "submitted" && attempt.score !== null);
  const resultRound = latestResult ? rounds.find((round) => round.id === latestResult.round_id) : null;

  return <div className="min-h-dvh bg-[#071315] px-5 py-10 text-white">
    <div className="mx-auto max-w-2xl">
      <Link to="/contests" className="inline-flex items-center gap-2 text-sm text-white/50 hover:text-white"><ArrowLeft className="h-4 w-4" /> Contest overview</Link>
      <div className="mt-7 rounded-2xl border border-white/10 bg-white/[0.035] p-6 sm:p-8">
        <School className="h-7 w-7 text-teal-300" />
        <h1 className="mt-5 font-serif text-3xl font-bold">{contest.title}</h1>
        <p className="mt-2 text-white/50">Participant registration</p>

        {registration ? <div className="mt-7 rounded-xl border border-teal-300/20 bg-teal-300/10 p-5">
          <p className="flex items-center gap-2 font-bold text-teal-200"><CheckCircle2 className="h-5 w-5" /> Contest dashboard</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2"><div className="rounded-lg border border-white/10 bg-black/10 p-3"><p className="text-xs text-white/40">University</p><p className="mt-1 font-bold">{registration.contest_universities?.name || "Pending institution review"}</p></div><div className="rounded-lg border border-white/10 bg-black/10 p-3"><p className="text-xs text-white/40">Admission</p><p className="mt-1 font-bold capitalize">{registration.status}</p></div></div>
          <p className="mt-3 text-sm text-white/55">{registration.status === "verified" ? "Your identity and institution are verified for the secure lobby." : "Institutional verification must be completed before examination entry."}</p>
          {nextRound?.starts_at && <ContestCountdown startsAt={nextRound.starts_at} className="mt-5" />}
          {nextRound?.starts_at && <ContestCalendarActions title={`${contest.title} — ${nextRound.title}`} startsAt={nextRound.starts_at} endsAt={nextRound.ends_at} details={`Your Ompath Study contest is scheduled. Sign in early and enter the secure lobby: https://www.ompathstudy.com/contests/${slug}/lobby`} location={`https://www.ompathstudy.com/contests/${slug}/lobby`} className="mt-4" />}
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-white/10 p-3 text-xs leading-relaxed text-white/50"><BellRing className="mt-0.5 h-4 w-4 shrink-0 text-teal-300" /> Site and email reminders follow your notification preference. Calendar reminders remain on your own device.</div>
          {latestResult && resultRound?.results_visible && <div className="mt-4 rounded-xl border border-amber-300/20 bg-amber-300/10 p-4"><p className="flex items-center gap-2 font-bold text-amber-200"><Trophy className="h-4 w-4" /> Published result: {latestResult.score}%</p><p className="mt-1 text-xs text-white/50">{resultRound.title} · submitted {latestResult.submitted_at ? new Date(latestResult.submitted_at).toLocaleString("en-KE") : "successfully"}</p><Link to={`/contests/${slug}/certificate/${latestResult.id}`} className="mt-3 inline-flex items-center gap-2 rounded-lg border border-amber-200/30 px-3 py-2 text-xs font-bold text-amber-100"><Award className="h-4 w-4" /> Open result certificate</Link></div>}
          <div className="mt-5 flex flex-wrap gap-2"><Link to={`/contests/${slug}/lobby`} className="inline-flex rounded-lg border border-teal-200/30 px-4 py-2 text-sm font-bold text-teal-200">Open contest lobby</Link><Link to={`/contests/${slug}/progress`} className="inline-flex rounded-lg border border-white/15 px-4 py-2 text-sm font-bold text-white/70">My progression</Link><Link to={`/contests/${slug}/leaderboard`} className="inline-flex rounded-lg border border-white/15 px-4 py-2 text-sm font-bold text-white/70">Leaderboard</Link></div>
        </div> : !isOpen ? <div className="mt-7 rounded-xl border border-amber-300/20 bg-amber-300/10 p-5">
          <p className="flex items-center gap-2 font-bold text-amber-200"><LockKeyhole className="h-5 w-5" /> Registration is not open</p>
          <p className="mt-2 text-sm text-white/55">This competition is still in the concept stage. Dates and eligibility rules will be published before registration opens.</p>
        </div> : <form onSubmit={submit} className="mt-7 space-y-5">
          {nextRound?.starts_at && <div className="rounded-xl border border-amber-300/20 bg-amber-300/[0.07] p-4"><p className="text-sm font-bold text-amber-200">Scheduled exam</p><ContestCountdown startsAt={nextRound.starts_at} className="mt-3" /><ContestCalendarActions title={`${contest.title} — ${nextRound.title}`} startsAt={nextRound.starts_at} endsAt={nextRound.ends_at} details="Ompath Study medical competition exam. Sign in and enter the secure lobby before the scheduled start." location={`https://www.ompathstudy.com/contests/${slug}/lobby`} className="mt-4" /></div>}
          <label className="block text-sm font-semibold">University<select required value={universityId} onChange={(e) => setUniversityId(e.target.value)} className="mt-2 w-full rounded-lg border border-white/15 bg-[#0b1d20] px-3 py-3 text-white"><option value="">Select institution</option>{universities.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}<option value="__new__">My university is not listed</option></select></label>
          {universityId === "__new__" && <div className="rounded-xl border border-teal-300/20 bg-teal-300/[0.06] p-4">
            <p className="text-sm font-bold text-teal-200">Add your university</p>
            <p className="mt-1 text-xs leading-relaxed text-white/50">You can register immediately. An administrator will review the institution before verifying your contest admission.</p>
            <label className="mt-4 block text-sm font-semibold">Full university name<input required minLength={3} maxLength={140} value={newUniversityName} onChange={(e) => setNewUniversityName(e.target.value)} placeholder="e.g. Kenya Methodist University" className="mt-2 w-full rounded-lg border border-white/15 bg-[#071315] px-3 py-3 text-white placeholder:text-white/25" /></label>
            <label className="mt-4 block text-sm font-semibold">Abbreviation <span className="font-normal text-white/35">(optional)</span><input maxLength={16} value={newUniversityAbbreviation} onChange={(e) => setNewUniversityAbbreviation(e.target.value)} placeholder="e.g. KeMU" className="mt-2 w-full rounded-lg border border-white/15 bg-[#071315] px-3 py-3 text-white placeholder:text-white/25" /></label>
          </div>}
          <label className="block text-sm font-semibold">Academic year<select value={studyYear} onChange={(e) => setStudyYear(e.target.value)} className="mt-2 w-full rounded-lg border border-white/15 bg-[#0b1d20] px-3 py-3 text-white">{contest.years.map((year) => <option key={year} value={year}>Year {year}</option>)}</select></label>
          <label className="block text-sm font-semibold">Representation<select value={representation} onChange={(e) => setRepresentation(e.target.value as typeof representation)} className="mt-2 w-full rounded-lg border border-white/15 bg-[#0b1d20] px-3 py-3 text-white"><option value="individual">Individual representative</option><option value="university_team">University team</option></select></label>
          {representation === "university_team" && <div className="grid gap-4 rounded-xl border border-white/10 p-4 sm:grid-cols-2"><label className="block text-sm font-semibold">Team name<input required minLength={2} maxLength={80} value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="e.g. MKU Haematology Team" className="mt-2 w-full rounded-lg border border-white/15 bg-[#0b1d20] px-3 py-3 text-white placeholder:text-white/25" /></label><label className="block text-sm font-semibold">Team role<select value={teamRole} onChange={(e) => setTeamRole(e.target.value as typeof teamRole)} className="mt-2 w-full rounded-lg border border-white/15 bg-[#0b1d20] px-3 py-3 text-white"><option value="member">Team member</option><option value="captain">Team captain</option></select></label></div>}
          <div className="rounded-xl border border-white/10 p-4"><p className="flex items-center gap-2 text-sm font-bold"><ShieldCheck className="h-4 w-4 text-teal-300" /> Rules acknowledgement</p><ul className="mt-3 space-y-2 text-xs leading-relaxed text-white/45">{CONTEST_RULES.slice(0,3).map((rule) => <li key={rule}>• {rule}</li>)}</ul><label className="mt-4 flex gap-3 text-sm text-white/65"><input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="mt-1 accent-teal-300" /> I accept the published rules and integrity policy.</label></div>
          {error && <p className="text-sm text-red-300">{error}</p>}
          <button disabled={saving || !accepted || !universityId || (universityId === "__new__" && newUniversityName.trim().length < 3) || (representation === "university_team" && teamName.trim().length < 2)} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-teal-300 px-5 py-3.5 font-bold text-[#071315] disabled:opacity-40">{saving && <Loader2 className="h-4 w-4 animate-spin" />} Submit registration</button>
        </form>}
      </div>
    </div>
  </div>;
}
