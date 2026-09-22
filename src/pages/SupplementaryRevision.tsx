import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { BookOpen, CalendarDays, Check, CheckCircle2, Circle, Clock, ExternalLink, FileQuestion, GraduationCap, Loader2, Search, Target } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { getProgress, logActivity, setProgress, type ProgressStatus, type ResourceProgress } from "@/lib/study";
import type { ResourceType } from "@/lib/academic";
import { toast } from "@/hooks/use-toast";
import { assessAnswerReadiness, classifySupplementaryMaterial, classifySupplementaryResource, SUPPLEMENTARY_GROUPS, SUPPLEMENTARY_MATERIALS, type AnswerReadiness, type SupplementaryMaterial } from "@/lib/supplementary-resources";
import { prefetchArticle } from "@/lib/store";
import { isPublicMcqSet } from "@/lib/content-policy";

type LiveResource = { id: string; title: string; category: string; type: "Article" | "Exam / MCQ" | "Flashcards"; resourceType: ResourceType; material: SupplementaryMaterial; answerReadiness: AnswerReadiness; path: string; group: string; size: number };

const GROUP_ORDER: string[] = [...SUPPLEMENTARY_GROUPS];
const MATERIAL_ORDER = [...SUPPLEMENTARY_MATERIALS];

const progressKey = (type: ResourceType, id: string) => `${type}:${id}`;
const statusLabel = (status?: ProgressStatus) => status === "completed" ? "Completed" : status ? "In progress" : "Untouched";

const plan = [
  ["13 Aug", "Baseline", "40 mixed questions; record weak topics; review bacterial structure and virulence"],
  ["14 Aug", "Year 2 Microbiology", "Sterilisation, disinfection, specimen collection, culture and antimicrobial testing"],
  ["15 Aug", "Year 3 Bacteriology", "Gram-positive cocci, Gram-negative organisms and laboratory diagnosis"],
  ["16 Aug", "Year 2 Parasitology I", "Protozoa: amoebae, Giardia, Trichomonas, malaria and life cycles"],
  ["17 Aug", "Year 2 Parasitology I + Year 3 Parasitology II", "Helminths, schistosomiasis, filariasis, entomology and applied diagnosis"],
  ["18 Aug", "Virology I", "Structure, classification, replication, pathogenesis, diagnostics and vaccines"],
  ["19 Aug", "Virology II", "HIV, hepatitis, herpesviruses, respiratory and oncogenic viruses"],
  ["20 Aug", "Mycology", "Classification, superficial/systemic/opportunistic mycoses and antifungals"],
  ["21 Aug", "General Pathology I", "Cell injury, adaptation, necrosis, apoptosis and inflammation"],
  ["22 Aug", "General Pathology II", "Healing, haemodynamic disorders, immunopathology and neoplasia"],
  ["23 Aug", "Systemic Pathology I", "Cardiovascular, respiratory, gastrointestinal and hepatobiliary"],
  ["24 Aug", "Systemic Pathology II", "Renal, endocrine, CNS, reproductive, breast, bone and skin"],
  ["25 Aug", "Haematology I", "RBC indices, anaemia approach, haemolysis and haemoglobin disorders"],
  ["26 Aug", "Haematology II", "Leukaemias, lymphomas, plasma-cell disorders and marrow failure"],
  ["27 Aug", "Haematology III", "Platelets, coagulation, bleeding disorders and blood transfusion"],
  ["28 Aug", "Mock 1", "Timed microbiology, parasitology, virology and mycology paper; correct every error"],
  ["29 Aug", "Mock 2", "Timed general and systemic pathology paper; write two essay outlines"],
  ["30 Aug", "Mock 3", "Timed haematology paper; revisit the three weakest topics"],
  ["31 Aug", "Final recall", "Life cycles, diagnostic algorithms, comparison tables and error notebook only"],
  ["1 Sep", "Exam day", "20-minute light recall; no new material; arrive early and rested"],
] as const;

export default function SupplementaryRevision() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [done, setDone] = useState<string[]>(() => {
    try {
      const sprint = JSON.parse(localStorage.getItem("supplementary-plan-done") || "[]") as unknown[];
      const legacy = JSON.parse(localStorage.getItem("revision-index-done") || "[]") as unknown[];
      const migrated = legacy.filter((day): day is number => typeof day === "number" && day >= 1 && day <= plan.length).map((day) => plan[day - 1][0]);
      return [...new Set([...sprint.filter((date): date is string => typeof date === "string"), ...migrated])];
    } catch { return []; }
  });
  const [allResources, setAllResources] = useState<LiveResource[]>([]);
  const [resourcesLoading, setResourcesLoading] = useState(true);
  const [resourceError, setResourceError] = useState(false);
  const [progressRows, setProgressRows] = useState<ResourceProgress[]>([]);
  const [progressLoading, setProgressLoading] = useState(false);
  const [updatingKey, setUpdatingKey] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [groupFilter, setGroupFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [materialFilter, setMaterialFilter] = useState("All");
  const [answerFilter, setAnswerFilter] = useState("All answer-ready");
  const [withheldCount, setWithheldCount] = useState(0);
  const [perGroupLimit, setPerGroupLimit] = useState(12);
  useEffect(() => localStorage.setItem("supplementary-plan-done", JSON.stringify(done)), [done]);
  useEffect(() => {
    let active = true;
    (async () => {
      setResourcesLoading(true); setResourceError(false);
      const [articles, exams, flashcards] = await Promise.all([
        supabase.from("articles").select("id,title,slug,category,content_type,exam_type,contains_answer_key,answer_key_verified").eq("published", true).is("deleted_at", null),
        supabase.from("mcq_sets").select("id,title,slug,category,contains_answer_key,answer_key_verified").eq("published", true).is("deleted_at", null),
        supabase.from("flashcard_sets").select("id,title,slug,category,contains_answer_key,answer_key_verified").eq("published", true).is("deleted_at", null),
      ]);
      if (!active) return;
      if (articles.error || exams.error || flashcards.error) { setResourceError(true); setResourcesLoading(false); return; }
      const rows: LiveResource[] = [];
      let withheld = 0;
      for (const row of articles.data || []) {
        const group = classifySupplementaryResource(row.title, row.category); if (!group) continue;
        const material = classifySupplementaryMaterial(row.title, row.content_type, row.exam_type);
        const answer = assessAnswerReadiness({ kind: "article", material, containsAnswerKey: row.contains_answer_key, answerKeyVerified: row.answer_key_verified });
        if (!answer.ready) { withheld++; continue; }
        rows.push({ id: row.id, title: row.title, category: row.category, type: "Article", resourceType: "article", material, answerReadiness: answer.label as AnswerReadiness, path: `/blog/${row.slug || row.id}`, group, size: 0 });
      }
      for (const row of exams.data || []) {
        if (!isPublicMcqSet(row)) { withheld++; continue; }
        const group = classifySupplementaryResource(row.title, row.category); if (!group) continue;
        const answer = assessAnswerReadiness({ kind: "exam", material: "MCQs & timed exams", containsAnswerKey: row.contains_answer_key, answerKeyVerified: row.answer_key_verified });
        if (!answer.ready) { withheld++; continue; }
        rows.push({ id: row.id, title: row.title, category: row.category, type: "Exam / MCQ", resourceType: "exam", material: "MCQs & timed exams", answerReadiness: answer.label as AnswerReadiness, path: `/exams/${row.slug || row.id}/start`, group, size: 0 });
      }
      for (const row of flashcards.data || []) {
        const group = classifySupplementaryResource(row.title, row.category); if (!group) continue;
        const answer = assessAnswerReadiness({ kind: "flashcard", material: "Flashcards", containsAnswerKey: row.contains_answer_key, answerKeyVerified: row.answer_key_verified });
        if (!answer.ready) { withheld++; continue; }
        rows.push({ id: row.id, title: row.title, category: row.category, type: "Flashcards", resourceType: "flashcard", material: "Flashcards", answerReadiness: answer.label as AnswerReadiness, path: `/flashcards/${row.slug || row.id}`, group, size: 0 });
      }
      rows.sort((a, b) => GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group) || a.title.localeCompare(b.title));
      setAllResources(rows); setWithheldCount(withheld); setResourcesLoading(false);
    })().catch(() => { if (active) { setResourceError(true); setResourcesLoading(false); } });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    let active = true;
    getProgress(userId).then((rows) => { if (active) { setProgressRows(rows); setProgressLoading(false); } }).catch(() => { if (active) setProgressLoading(false); });
    return () => { active = false; };
  }, [userId]);
  const progress = useMemo(() => Math.round((done.length / plan.length) * 100), [done]);
  const progressByKey = useMemo(() => new Map(progressRows.map((row) => [progressKey(row.resource_type, row.resource_id), row])), [progressRows]);
  const visibleResources = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return allResources.filter((item) => {
      const tracked = progressByKey.get(progressKey(item.resourceType, item.id));
      const state = tracked?.status === "completed" ? "Completed" : tracked ? "In progress" : "Untouched";
      return (groupFilter === "All" || item.group === groupFilter) && (materialFilter === "All" || item.material === materialFilter) && (answerFilter === "All answer-ready" || item.answerReadiness === answerFilter) && (statusFilter === "All" || state === statusFilter) && (!needle || `${item.title} ${item.category} ${item.type} ${item.material}`.toLowerCase().includes(needle));
    });
  }, [allResources, answerFilter, groupFilter, materialFilter, progressByKey, query, statusFilter]);
  useEffect(() => setPerGroupLimit(12), [answerFilter, groupFilter, materialFilter, query, statusFilter]);
  const renderedResources = useMemo(() => GROUP_ORDER.flatMap((group) => visibleResources.filter((item) => item.group === group).slice(0, perGroupLimit)), [perGroupLimit, visibleResources]);
  const groupedResources = useMemo(() => GROUP_ORDER.map((group) => {
    const resources = renderedResources.filter((item) => item.group === group);
    const materials = MATERIAL_ORDER.map((material) => ({ material, resources: resources.filter((item) => item.material === material) })).filter((entry) => entry.resources.length);
    return { group, resources, materials };
  }).filter((entry) => entry.resources.length), [renderedResources]);
  const trackingTotals = useMemo(() => allResources.reduce((totals, item) => {
    const row = progressByKey.get(progressKey(item.resourceType, item.id));
    if (row?.status === "completed") totals.completed++;
    else if (row) totals.inProgress++;
    else totals.untouched++;
    return totals;
  }, { completed: 0, inProgress: 0, untouched: 0 }), [allResources, progressByKey]);
  const startHere = useMemo(() => GROUP_ORDER.map((group) => ({
    group,
    resources: allResources.filter((item) => item.group === group && item.material === "Notes & revision guides").slice(0, 2),
    answerReady: allResources.filter((item) => item.group === group && item.material !== "Notes & revision guides").length,
  })).filter((entry) => entry.resources.length || entry.answerReady), [allResources]);
  useEffect(() => {
    const warm = () => startHere.flatMap((entry) => entry.resources.slice(0, 1)).forEach((resource) => {
      if (resource.resourceType === "article") prefetchArticle(resource.path.split("/").pop() || resource.id);
    });
    const id = window.setTimeout(warm, 250);
    return () => window.clearTimeout(id);
  }, [startHere]);
  const toggle = (date: string) => setDone((current) => current.includes(date) ? current.filter((x) => x !== date) : [...current, date]);
  const markResource = async (resource: LiveResource) => {
    const key = progressKey(resource.resourceType, resource.id);
    const previous = progressByKey.get(key);
    const nextStatus: ProgressStatus = previous?.status === "completed" ? "in_progress" : "completed";
    setUpdatingKey(key);
    setProgressRows((rows) => [{ resource_type: resource.resourceType, resource_id: resource.id, status: nextStatus, progress_percent: nextStatus === "completed" ? 100 : 25, last_position: previous?.last_position || null, last_opened_at: new Date().toISOString(), completed_at: nextStatus === "completed" ? new Date().toISOString() : null }, ...rows.filter((row) => progressKey(row.resource_type, row.resource_id) !== key)]);
    try {
      await setProgress(userId, resource.resourceType, resource.id, { status: nextStatus, progress_percent: nextStatus === "completed" ? 100 : 25, completed_at: nextStatus === "completed" ? new Date().toISOString() : null });
      await logActivity(userId, nextStatus, { resource_type: resource.resourceType, resource_id: resource.id });
      toast({ description: nextStatus === "completed" ? "Marked completed and synced" : "Moved back to in progress" });
    } catch {
      setProgressRows((rows) => previous ? [previous, ...rows.filter((row) => progressKey(row.resource_type, row.resource_id) !== key)] : rows.filter((row) => progressKey(row.resource_type, row.resource_id) !== key));
      toast({ description: "Progress could not be saved. Try again.", variant: "destructive" });
    } finally { setUpdatingKey(null); }
  };

  return <>
    <Helmet>
      <title>Exam Revision Index 2026 | Ompath Study</title>
      <meta name="description" content="A focused revision schedule for microbiology, parasitology, virology, mycology, general and systemic pathology, and haematology before 1 September 2026." />
    </Helmet>
    <div className="border-b border-border bg-background">
      <section className="mx-auto max-w-6xl px-5 py-9 sm:py-12">
        <div className="max-w-3xl">
          <span className="study-kicker"><Target className="h-4 w-4" /> Supplementary exam sprint</span>
          <h1 className="mt-4 font-serif text-3xl font-bold leading-tight sm:text-5xl">Your focused revision plan to 1 September</h1>
          <p className="mt-4 text-base leading-7 text-muted-foreground sm:text-lg">Seven examinable areas, correctly separated by year and taught in three passes: understand, retrieve, then perform under time.</p>
          <div className="mt-6 border-y border-border bg-background p-4">
            <div className="flex items-center justify-between text-sm font-semibold"><span>{done.length} of {plan.length} days completed</span><span>{progress}%</span></div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} /></div>
          </div>
        </div>
      </section>
    </div>

    <div className="mx-auto max-w-6xl space-y-12 px-5 pb-16">
      {!resourcesLoading && !resourceError && startHere.length > 0 && <section aria-labelledby="start-here-heading">
        <div className="mb-4"><p className="text-xs font-bold uppercase tracking-wider text-primary">Claude + Codex consolidated</p><h2 id="start-here-heading" className="font-serif text-2xl font-bold">Start here by subject</h2><p className="mt-1 text-sm text-muted-foreground">Open a core note first, then move to the answer-ready practice listed for that unit.</p></div>
        <div className="grid gap-0 divide-y divide-border border-y border-border sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">{startHere.map(({ group, resources, answerReady }) => <div key={group} className="rounded-2xl border bg-card p-4"><div className="mb-3 flex items-start justify-between gap-2"><h3 className="text-sm font-bold leading-5">{group}</h3><span className="shrink-0 rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] font-bold text-emerald-700">{answerReady} answer-ready</span></div><div className="space-y-1">{resources.map((resource) => <Link key={resource.id} to={resource.path} className="flex items-start gap-2 rounded-lg p-2 text-sm hover:bg-muted"><BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><span className="line-clamp-2 font-medium">{resource.title}</span></Link>)}</div></div>)}</div>
      </section>}
      <section id="all-resources" className="scroll-mt-24">
        <div className="mb-2 flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-primary">Complete live library</p><h2 className="font-serif text-2xl font-bold">All revision resources, arranged by unit</h2></div><span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-bold text-primary">{allResources.length} resources</span></div>
        <p className="mb-4 text-sm leading-6 text-muted-foreground">Each unit is divided into notes, past papers, CATs, essays, question banks, exams and flashcards. Question resources appear only when usable answers are present. Opening a resource starts it automatically; use the tick to mark it completed.</p>
        {withheldCount > 0 && <p className="mb-4 rounded-xl border border-amber-300/50 bg-amber-500/10 p-3 text-sm"><strong>{withheldCount} question resource{withheldCount === 1 ? "" : "s"} held back:</strong> they need answers before they can appear in this revision plan.</p>}
        {!user && <p className="mb-4 rounded-xl border border-amber-300/50 bg-amber-500/10 p-3 text-sm"><Link to="/login" className="font-bold underline">Log in</Link> to sync progress across your phone and other devices. Guest progress stays on this device.</p>}
        <div className="mb-4 grid grid-cols-3 gap-2">
          <button onClick={() => setStatusFilter(statusFilter === "Untouched" ? "All" : "Untouched")} className={`rounded-xl border p-3 text-left ${statusFilter === "Untouched" ? "border-slate-500 bg-slate-500/10" : "bg-card"}`}><span className="block text-xl font-bold">{trackingTotals.untouched}</span><span className="text-[11px] font-semibold text-muted-foreground">Untouched</span></button>
          <button onClick={() => setStatusFilter(statusFilter === "In progress" ? "All" : "In progress")} className={`rounded-xl border p-3 text-left ${statusFilter === "In progress" ? "border-amber-500 bg-amber-500/10" : "bg-card"}`}><span className="block text-xl font-bold">{trackingTotals.inProgress}</span><span className="text-[11px] font-semibold text-muted-foreground">In progress</span></button>
          <button onClick={() => setStatusFilter(statusFilter === "Completed" ? "All" : "Completed")} className={`rounded-xl border p-3 text-left ${statusFilter === "Completed" ? "border-emerald-500 bg-emerald-500/10" : "bg-card"}`}><span className="block text-xl font-bold">{trackingTotals.completed}</span><span className="text-[11px] font-semibold text-muted-foreground">Completed</span></button>
        </div>
        <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
          <label className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search all revision materials…" className="pl-9" /></label>
          <select value={groupFilter} onChange={(event) => setGroupFilter(event.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm"><option>All</option>{GROUP_ORDER.map((group) => <option key={group}>{group}</option>)}</select>
          <select aria-label="Filter by material" value={materialFilter} onChange={(event) => setMaterialFilter(event.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm"><option>All</option>{MATERIAL_ORDER.map((material) => <option key={material}>{material}</option>)}</select>
          <select aria-label="Filter by answer status" value={answerFilter} onChange={(event) => setAnswerFilter(event.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm"><option>All answer-ready</option><option>Answer key complete</option><option>Answers included</option><option>Study content</option></select>
        </div>
        {(resourcesLoading || progressLoading) ? <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : resourceError ? <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 text-sm">The live resource catalogue could not load. Refresh to try again.</p> : groupedResources.length === 0 ? <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">No resources match this search or progress filter.</p> : <div className="space-y-9">
          {groupedResources.map(({ group, resources, materials }) => <div key={group} className="rounded-2xl border bg-card/40 p-3 sm:p-5"><div className="mb-4 flex items-center justify-between border-b pb-3"><h3 className="font-serif text-xl font-bold">{group}</h3><span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold">{resources.length}</span></div><div className="space-y-6">
            {materials.map(({ material, resources: materialResources }) => <div key={material}><div className="mb-2 flex items-center gap-2"><h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{material}</h4><span className="text-[10px] text-muted-foreground">({materialResources.length})</span></div><div className="grid gap-2 md:grid-cols-2">
              {materialResources.map((resource) => { const Icon = resource.type === "Article" ? BookOpen : resource.type === "Flashcards" ? GraduationCap : FileQuestion; const tracked = progressByKey.get(progressKey(resource.resourceType, resource.id)); const completed = tracked?.status === "completed"; const touched = Boolean(tracked); const key = progressKey(resource.resourceType, resource.id); return <div key={key} className={`flex items-stretch overflow-hidden rounded-xl border bg-card transition-colors ${completed ? "border-emerald-500/40 bg-emerald-500/5" : touched ? "border-amber-500/30" : "hover:border-primary/40"}`}><Link to={resource.path} className="group flex min-w-0 flex-1 items-start gap-3 p-3"><Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><span className="min-w-0 flex-1"><span className="block text-sm font-semibold leading-5 group-hover:text-primary">{resource.title}</span><span className="mt-1 block text-[11px] leading-4 text-muted-foreground">{resource.type} · {resource.size ? resource.type === "Article" ? `${Math.max(1, Math.round(resource.size / 1000))}k characters` : `${resource.size} items` : resource.category}</span><span className={`mt-2 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide ${completed ? "text-emerald-600" : touched ? "text-amber-600" : "text-muted-foreground"}`}>{completed ? <CheckCircle2 className="h-3 w-3" /> : touched ? <Circle className="h-3 w-3 fill-current" /> : <Circle className="h-3 w-3" />}{statusLabel(tracked?.status)}</span></span><ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /></Link><button type="button" onClick={() => markResource(resource)} disabled={updatingKey === key} aria-label={completed ? `Mark ${resource.title} in progress` : `Mark ${resource.title} completed`} className={`flex w-12 shrink-0 items-center justify-center border-l transition-colors ${completed ? "border-emerald-500/30 bg-emerald-500 text-white" : "border-border bg-muted/30 hover:bg-primary/10 hover:text-primary"}`}>{updatingKey === key ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-5 w-5" />}</button></div>; })}
            </div></div>)}
          </div></div>)}
          {renderedResources.length < visibleResources.length && <button type="button" onClick={() => setPerGroupLimit((limit) => limit + 12)} className="mx-auto block min-h-11 rounded-xl border bg-card px-6 py-2 text-sm font-bold text-primary hover:bg-primary/5">Load more resources ({visibleResources.length - renderedResources.length} remaining)</button>}
        </div>}
      </section>

      <section>
        <div className="mb-5 flex items-center gap-2"><CalendarDays className="h-5 w-5 text-primary" /><h2 className="font-serif text-2xl font-bold">Daily schedule</h2></div>
        <div className="mb-4 rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm leading-6"><strong>Daily method:</strong> 60–90 min notes → 45–60 min closed-book questions → 20 min correction log. On mock days, reproduce exam timing and mark every uncertain answer.</div>
        <div className="space-y-2">{plan.map(([date, subject, task]) => {
          const checked = done.includes(date);
          return <button key={date} onClick={() => toggle(date)} className={`grid w-full grid-cols-[2.5rem_4.5rem_minmax(0,1fr)] items-start gap-3 rounded-xl border p-3 text-left transition-colors sm:grid-cols-[2.5rem_5rem_9rem_minmax(0,1fr)] ${checked ? "border-primary/30 bg-primary/5" : "bg-card hover:border-primary/30"}`}>
            <span className={`flex h-7 w-7 items-center justify-center rounded-full border ${checked ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>{checked && <CheckCircle2 className="h-4 w-4" />}</span>
            <span className="pt-1 text-xs font-bold text-muted-foreground">{date}</span><span className="col-span-2 font-semibold sm:col-span-1">{subject}</span><span className="col-start-3 text-sm leading-6 text-muted-foreground sm:col-start-4">{task}</span>
          </button>;
        })}</div>
      </section>

      <section className="rounded-2xl bg-foreground p-6 text-background sm:p-8">
        <div className="flex items-center gap-2"><Clock className="h-5 w-5" /><h2 className="font-serif text-2xl font-bold">Non-negotiable exam rules</h2></div>
        <ul className="mt-4 grid gap-3 text-sm leading-6 text-background/80 sm:grid-cols-2"><li>• Draw every parasite life cycle from memory.</li><li>• For organisms, learn transmission → disease → specimen → test → treatment.</li><li>• For pathology essays, use definition → causes → pathogenesis → morphology → complications.</li><li>• For haematology, interpret indices and coagulation results before naming the disease.</li><li>• Reattempt every wrong question after 24–48 hours.</li><li>• On 31 August, revise your error notebook—not whole textbooks.</li></ul>
      </section>
    </div>
  </>;
}
