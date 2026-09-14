import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { ArrowLeft, Building2, CheckCircle2, ClipboardPaste, Loader2, Plus, Sparkles, Trash2, Trophy } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { parseContestQuestions, type ParsedContestQuestion } from "@/lib/contest-parse";
import {
  addContestUniversity, configureContestRound, createContest, createContestRound, createSampleContest,
  deleteContestRound, importContestQuestions, loadAdminContests, loadAllContestUniversities, loadContestRounds,
  setContestUniversityActive, updateContestDetails, updateContestStage,
  type ContestRecord, type ContestRound, type ContestUniversity,
} from "@/lib/contest-store";
import type { ContestStage } from "@/lib/contest";

const SAMPLE_PASTE = `1. Which structure forms the floor of the anatomical snuffbox?
A. Scaphoid and trapezium *
B. Lunate and capitate
C. Radius and ulna
D. Pisiform and hamate
Explanation: The scaphoid and trapezium form the floor.

2. The nerve at risk in a mid-shaft humeral fracture is the
A. Median nerve
B. Radial nerve
C. Ulnar nerve
D. Axillary nerve
Answer: B`;

const emptyDraft = {
  title: "", subtitle: "", subjects: "Anatomy, Physiology, Pathology", years: [1, 2, 3] as number[],
  format: "Qualifier → Semifinal → Grand final", registrationOpensAt: "", registrationClosesAt: "", startsAt: "",
};

const toLocal = (value: string | null) => (value ? new Date(value).toISOString().slice(0, 16) : "");
const toIso = (value: string) => (value ? new Date(value).toISOString() : null);

export default function ContestSetup() {
  const { isAdmin, loading: authLoading } = useAuth();
  const [contests, setContests] = useState<ContestRecord[]>([]);
  const [contestId, setContestId] = useState("");
  const [rounds, setRounds] = useState<ContestRound[]>([]);
  const [universities, setUniversities] = useState<(ContestUniversity & { active: boolean })[]>([]);
  const [draft, setDraft] = useState(emptyDraft);
  const [creating, setCreating] = useState(false);
  const [roundTitle, setRoundTitle] = useState("Qualifier round");
  const [roundMinutes, setRoundMinutes] = useState(20);
  const [targetRound, setTargetRound] = useState("");
  const [paste, setPaste] = useState(SAMPLE_PASTE);
  const [parsed, setParsed] = useState<ParsedContestQuestion[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [newUniversity, setNewUniversity] = useState({ name: "", abbreviation: "" });
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const contest = contests.find((item) => item.id === contestId) || null;

  useEffect(() => {
    if (!isAdmin) return;
    void Promise.all([loadAdminContests(), loadAllContestUniversities()]).then(([contestRows, universityRows]) => {
      setContests(contestRows);
      setUniversities(universityRows);
      setContestId((current) => current || contestRows[0]?.id || "");
    }).catch((cause) => setError(cause?.message || "The contest workspace could not be loaded."));
  }, [isAdmin]);

  useEffect(() => {
    if (!contestId) { setRounds([]); return; }
    void loadContestRounds(contestId).then((rows) => { setRounds(rows); setTargetRound(rows[0]?.id || ""); });
  }, [contestId]);

  if (!authLoading && !isAdmin) return <Navigate to="/login" replace />;
  if (authLoading) return <div className="flex min-h-[70vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  async function run(key: string, work: () => Promise<string>) {
    setBusy(key); setError(""); setMessage("");
    try { setMessage(await work()); }
    catch (cause: any) { setError(cause?.message || "That step could not be completed."); }
    finally { setBusy(""); }
  }

  const refreshRounds = async () => setRounds(await loadContestRounds(contestId));

  return (
    <div className="mx-auto max-w-5xl px-5 py-10">
      <Link to="/admin/contests" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Contest administration
      </Link>

      <header className="mt-6 overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary/10 via-card to-card p-6 sm:p-8">
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-primary"><Trophy className="h-4 w-4" /> Contest setup</p>
        <h1 className="mt-3 font-serif text-3xl font-bold sm:text-4xl">Build a contest between universities</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Create the competition, list the competing universities, paste questions from a past paper or exam, then open the lobby. Every step below is saved immediately.
        </p>
        <button
          disabled={busy === "sample"}
          onClick={() => void run("sample", async () => {
            const created = await createSampleContest();
            setContests(await loadAdminContests());
            setContestId(created.id);
            return `Sample contest published at /contests/${created.slug} with five questions and five universities.`;
          })}
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground disabled:opacity-50"
        >
          {busy === "sample" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Publish a working sample contest
        </button>
      </header>

      {message && <p className="mt-5 rounded-xl border border-primary/30 bg-primary/10 p-4 text-sm">{message}</p>}
      {error && <p className="mt-5 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm">{error}</p>}

      <section className="mt-8 rounded-2xl border border-border bg-card p-6">
        <h2 className="text-lg font-bold">1. Create a new contest</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-semibold">Title
            <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Inter-University Anatomy Challenge 2026" className="mt-2 w-full rounded-lg border bg-background px-3 py-2.5 text-sm font-normal" />
          </label>
          <label className="text-sm font-semibold">Competition path
            <input value={draft.format} onChange={(e) => setDraft({ ...draft, format: e.target.value })} className="mt-2 w-full rounded-lg border bg-background px-3 py-2.5 text-sm font-normal" />
          </label>
          <label className="text-sm font-semibold sm:col-span-2">Subtitle
            <input value={draft.subtitle} onChange={(e) => setDraft({ ...draft, subtitle: e.target.value })} placeholder="A national knowledge arena for medical students." className="mt-2 w-full rounded-lg border bg-background px-3 py-2.5 text-sm font-normal" />
          </label>
          <label className="text-sm font-semibold">Subjects (comma separated)
            <input value={draft.subjects} onChange={(e) => setDraft({ ...draft, subjects: e.target.value })} className="mt-2 w-full rounded-lg border bg-background px-3 py-2.5 text-sm font-normal" />
          </label>
          <div className="text-sm font-semibold">Eligible years
            <div className="mt-2 flex flex-wrap gap-2">
              {[1, 2, 3, 4, 5, 6].map((year) => {
                const on = draft.years.includes(year);
                return (
                  <button key={year} type="button" onClick={() => setDraft({ ...draft, years: on ? draft.years.filter((item) => item !== year) : [...draft.years, year] })}
                    className={`rounded-lg border px-3 py-2 text-xs font-bold ${on ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground"}`}>
                    Year {year}
                  </button>
                );
              })}
            </div>
          </div>
          <label className="text-sm font-semibold">Registration opens
            <input type="datetime-local" value={draft.registrationOpensAt} onChange={(e) => setDraft({ ...draft, registrationOpensAt: e.target.value })} className="mt-2 w-full rounded-lg border bg-background px-3 py-2.5 text-sm font-normal" />
          </label>
          <label className="text-sm font-semibold">Registration closes
            <input type="datetime-local" value={draft.registrationClosesAt} onChange={(e) => setDraft({ ...draft, registrationClosesAt: e.target.value })} className="mt-2 w-full rounded-lg border bg-background px-3 py-2.5 text-sm font-normal" />
          </label>
          <label className="text-sm font-semibold">Contest starts
            <input type="datetime-local" value={draft.startsAt} onChange={(e) => setDraft({ ...draft, startsAt: e.target.value })} className="mt-2 w-full rounded-lg border bg-background px-3 py-2.5 text-sm font-normal" />
          </label>
          <label className="flex items-end gap-3 text-sm font-semibold">
            <input type="checkbox" checked={creating} onChange={(e) => setCreating(e.target.checked)} className="h-4 w-4" /> Publish immediately
          </label>
        </div>
        <button
          disabled={busy === "create"}
          onClick={() => void run("create", async () => {
            const created = await createContest({
              title: draft.title, subtitle: draft.subtitle,
              subjects: draft.subjects.split(",").map((item) => item.trim()).filter(Boolean),
              years: draft.years, format: draft.format,
              registrationOpensAt: toIso(draft.registrationOpensAt), registrationClosesAt: toIso(draft.registrationClosesAt),
              startsAt: toIso(draft.startsAt), published: creating,
            });
            setContests(await loadAdminContests());
            setContestId(created.id);
            setDraft(emptyDraft);
            return `Contest created at /contests/${created.slug}. Add a round and questions below.`;
          })}
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground disabled:opacity-50"
        >
          {busy === "create" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Create contest
        </button>
      </section>

      <section className="mt-6 rounded-2xl border border-border bg-card p-6">
        <h2 className="text-lg font-bold">2. Choose the contest you are working on</h2>
        <select value={contestId} onChange={(e) => setContestId(e.target.value)} className="mt-4 w-full max-w-xl rounded-lg border bg-background px-3 py-2.5 text-sm">
          {contests.map((item) => <option key={item.id} value={item.id}>{item.title} · {item.stage}{item.published ? "" : " · unpublished"}</option>)}
        </select>
        {contest && (
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button disabled={busy === "publish"} onClick={() => void run("publish", async () => {
              await updateContestDetails(contest.id, {
                title: contest.title, subtitle: contest.subtitle,
                subjects: contest.subjects, years: contest.years, format: contest.format,
                registrationOpensAt: contest.registrationOpensAt, registrationClosesAt: contest.registrationClosesAt,
                startsAt: contest.startsAt, published: !contest.published,
              });
              setContests(await loadAdminContests());
              return contest.published ? "Contest hidden from the public page." : "Contest is now visible on the public contest page.";
            })} className="rounded-lg border px-4 py-2.5 text-sm font-bold">
              {contest.published ? "Unpublish" : "Publish to the site"}
            </button>
            {(["concept", "registration", "live", "completed"] as ContestStage[]).map((stage) => (
              <button key={stage} disabled={busy === stage || contest.stage === stage} onClick={() => void run(stage, async () => {
                await updateContestStage(contest.id, stage);
                setContests(await loadAdminContests());
                return `Contest stage set to ${stage}.`;
              })} className={`rounded-lg border px-4 py-2.5 text-sm font-bold capitalize disabled:opacity-40 ${contest.stage === stage ? "border-primary bg-primary/10 text-primary" : ""}`}>
                {stage}
              </button>
            ))}
            <Link to={`/contests/${contest.slug}/briefing`} className="text-sm font-bold text-primary hover:underline">Open public page →</Link>
          </div>
        )}
        <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
          A contest can only go live once one of its rounds holds questions and is opened as a lobby or live round in step 4.
        </p>
      </section>

      <section className="mt-6 rounded-2xl border border-border bg-card p-6">
        <h2 className="text-lg font-bold">3. Rounds</h2>
        <div className="mt-4 space-y-3">
          {rounds.length ? rounds.map((round) => (
            <div key={round.id} className="flex flex-wrap items-center gap-3 rounded-xl border p-4">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-sm font-bold">{round.round_number}</span>
              <div className="min-w-0 flex-1">
                <p className="font-bold">{round.title}</p>
                <p className="text-xs text-muted-foreground">{round.question_count} questions · {Math.round(round.duration_seconds / 60)} min · {round.status}</p>
              </div>
              <button disabled={busy === round.id} onClick={() => void run(round.id, async () => {
                await deleteContestRound(round.id); await refreshRounds(); return `${round.title} removed.`;
              })} className="rounded-lg border p-2 text-muted-foreground" aria-label={`Delete ${round.title}`}><Trash2 className="h-4 w-4" /></button>
            </div>
          )) : <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">No rounds yet.</p>}
        </div>
        <div className="mt-5 flex flex-wrap items-end gap-3">
          <label className="text-sm font-semibold">Round title
            <input value={roundTitle} onChange={(e) => setRoundTitle(e.target.value)} className="mt-2 block rounded-lg border bg-background px-3 py-2.5 text-sm font-normal" />
          </label>
          <label className="text-sm font-semibold">Minutes
            <input type="number" min={1} max={240} value={roundMinutes} onChange={(e) => setRoundMinutes(Number(e.target.value))} className="mt-2 block w-24 rounded-lg border bg-background px-3 py-2.5 text-sm font-normal" />
          </label>
          <button disabled={!contestId || busy === "round"} onClick={() => void run("round", async () => {
            await createContestRound(contestId, roundTitle, Math.max(60, roundMinutes * 60));
            await refreshRounds();
            return `${roundTitle} added.`;
          })} className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground disabled:opacity-50">
            <Plus className="h-4 w-4" /> Add round
          </button>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-border bg-card p-6">
        <h2 className="flex items-center gap-2 text-lg font-bold"><ClipboardPaste className="h-5 w-5 text-primary" /> 4. Paste a paper, exam or MCQ set</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Paste numbered questions with lettered choices. Mark the correct choice with an asterisk or add an <strong>Answer: B</strong> line. Explanations are optional and stay private.
        </p>
        <label className="mt-4 block text-sm font-semibold">Round to fill
          <select value={targetRound} onChange={(e) => setTargetRound(e.target.value)} className="mt-2 w-full max-w-xl rounded-lg border bg-background px-3 py-2.5 text-sm font-normal">
            {rounds.map((round) => <option key={round.id} value={round.id}>{round.title} · {round.question_count} questions · {round.status}</option>)}
          </select>
        </label>
        <textarea value={paste} onChange={(e) => setPaste(e.target.value)} rows={14} spellCheck={false} className="mt-4 w-full rounded-xl border bg-background p-4 font-mono text-xs" />
        <div className="mt-4 flex flex-wrap gap-3">
          <button onClick={() => { const result = parseContestQuestions(paste); setParsed(result.questions); setWarnings(result.warnings); setMessage(`${result.questions.length} question${result.questions.length === 1 ? "" : "s"} recognised.`); setError(""); }}
            className="rounded-xl border px-5 py-3 text-sm font-bold">Check the paste</button>
          <button disabled={!parsed.length || !targetRound || busy === "import"} onClick={() => void run("import", async () => {
            const count = await importContestQuestions(targetRound, parsed);
            await refreshRounds();
            return `${count} question${count === 1 ? "" : "s"} imported. Answer keys were stored privately.`;
          })} className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground disabled:opacity-50">
            <CheckCircle2 className="h-4 w-4" /> Import into the round
          </button>
        </div>
        {warnings.length > 0 && (
          <ul className="mt-4 space-y-1 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs">
            {warnings.map((warning) => <li key={warning}>{warning}</li>)}
          </ul>
        )}
        {parsed.length > 0 && (
          <ol className="mt-5 space-y-3">
            {parsed.map((question, index) => (
              <li key={index} className="rounded-xl border p-4">
                <p className="text-sm font-bold">{index + 1}. {question.stem}</p>
                <div className="mt-2 grid gap-1 text-sm">
                  {question.options.map((option, optionIndex) => (
                    <span key={optionIndex} className={optionIndex === question.correctIndex ? "font-bold text-primary" : "text-muted-foreground"}>
                      {String.fromCharCode(65 + optionIndex)}. {option}
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="mt-6 rounded-2xl border border-border bg-card p-6">
        <h2 className="flex items-center gap-2 text-lg font-bold"><Building2 className="h-5 w-5 text-primary" /> 5. Competing universities</h2>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {universities.map((university) => (
            <label key={university.id} className="flex items-center gap-3 rounded-xl border p-3 text-sm">
              <input type="checkbox" checked={university.active} onChange={(e) => void run(university.id, async () => {
                await setContestUniversityActive(university.id, e.target.checked);
                setUniversities(await loadAllContestUniversities());
                return `${university.name} ${e.target.checked ? "added to" : "removed from"} the competing list.`;
              })} className="h-4 w-4" />
              <span className="min-w-0 flex-1 truncate">{university.name}</span>
              {university.abbreviation && <span className="text-xs font-bold text-muted-foreground">{university.abbreviation}</span>}
            </label>
          ))}
        </div>
        <div className="mt-5 flex flex-wrap items-end gap-3">
          <label className="text-sm font-semibold">University name
            <input value={newUniversity.name} onChange={(e) => setNewUniversity({ ...newUniversity, name: e.target.value })} className="mt-2 block w-64 rounded-lg border bg-background px-3 py-2.5 text-sm font-normal" />
          </label>
          <label className="text-sm font-semibold">Short form
            <input value={newUniversity.abbreviation} onChange={(e) => setNewUniversity({ ...newUniversity, abbreviation: e.target.value })} className="mt-2 block w-28 rounded-lg border bg-background px-3 py-2.5 text-sm font-normal" />
          </label>
          <button disabled={busy === "university"} onClick={() => void run("university", async () => {
            await addContestUniversity(newUniversity.name, newUniversity.abbreviation);
            setUniversities(await loadAllContestUniversities());
            setNewUniversity({ name: "", abbreviation: "" });
            return "University added and available for registration.";
          })} className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground disabled:opacity-50">
            <Plus className="h-4 w-4" /> Add university
          </button>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-border bg-card p-6">
        <h2 className="text-lg font-bold">6. Open the round</h2>
        <p className="mt-2 text-sm text-muted-foreground">A lobby round is visible to verified participants; a live round accepts attempts and needs start and end times.</p>
        <div className="mt-4 space-y-3">
          {rounds.map((round) => (
            <div key={round.id} className="flex flex-wrap items-center gap-3 rounded-xl border p-4">
              <div className="min-w-0 flex-1"><p className="font-bold">{round.title}</p><p className="text-xs text-muted-foreground">{round.question_count} questions · currently {round.status}</p></div>
              {(["lobby", "live", "closed"] as ContestRound["status"][]).map((status) => (
                <button key={status} disabled={busy === round.id + status} onClick={() => void run(round.id + status, async () => {
                  const startsAt = round.starts_at || new Date().toISOString();
                  const endsAt = round.ends_at && new Date(round.ends_at) > new Date(startsAt)
                    ? round.ends_at
                    : new Date(new Date(startsAt).getTime() + round.duration_seconds * 1000).toISOString();
                  await configureContestRound({
                    roundId: round.id, status, startsAt, endsAt,
                    durationSeconds: round.duration_seconds, tabSwitchLimit: round.tab_switch_limit,
                    focusLossLimit: round.focus_loss_limit, autoEliminate: round.auto_eliminate,
                  });
                  await refreshRounds();
                  return `${round.title} is now ${status}.`;
                })} className={`rounded-lg border px-4 py-2 text-sm font-bold capitalize disabled:opacity-40 ${round.status === status ? "border-primary bg-primary/10 text-primary" : ""}`}>
                  {status}
                </button>
              ))}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
