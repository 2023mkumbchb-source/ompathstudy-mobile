import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import {
  BookOpen, Check, ClipboardList, FileText, GraduationCap, Info, ListChecks, Loader2, Target, Trophy,
} from "lucide-react";
import {
  classifyContentType, getTopicsForUnit, getUnitBySlug, getUnitResources, resourcePath,
  type SyllabusTopic, type Unit, type UnitResource,
} from "@/lib/academic";
import { getTopicProgress, setTopicProgress, type TopicProgress } from "@/lib/study";
import { useAuth } from "@/hooks/useAuth";
import { SITE_URL } from "@/lib/seo";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";

const TABS = ["Overview", "Syllabus", "Notes", "Questions", "CATs", "Past Papers", "Flashcards", "Exams"] as const;

function ResourceRow({ r }: { r: UnitResource }) {
  const type = classifyContentType(r);
  return (
    <Link
      to={resourcePath(r)}
      className="flex items-start gap-3 rounded-lg border border-border bg-card px-3 py-3 transition-colors hover:border-primary/40 hover:bg-primary/5"
    >
      <FileText className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-foreground">{r.title}</span>
        <span className="mt-0.5 block text-[11px] text-muted-foreground">
          {type}
          {r.exam_year ? ` · ${r.exam_year}` : ""} · updated {new Date(r.updated_at || r.created_at).toLocaleDateString()}
        </span>
      </span>
    </Link>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
      {label}
    </p>
  );
}

export default function UnitPage() {
  const { yearNumber, unitSlug } = useParams();
  const year = Number(yearNumber);
  const { user } = useAuth();
  const [unit, setUnit] = useState<Unit | null>(null);
  const [topics, setTopics] = useState<SyllabusTopic[]>([]);
  const [resources, setResources] = useState<UnitResource[]>([]);
  const [topicProgress, setTopicProgressState] = useState<TopicProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const found = await getUnitBySlug(year, String(unitSlug));
        if (!alive) return;
        setUnit(found);
        if (!found) { setLoading(false); return; }
        const [t, r, tp] = await Promise.all([
          getTopicsForUnit(found.id),
          getUnitResources(found),
          getTopicProgress(user?.id ?? null),
        ]);
        if (!alive) return;
        setTopics(t);
        setResources(r);
        setTopicProgressState(tp);
      } catch {
        if (alive) setError("We could not load this unit. Please refresh to try again.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [year, unitSlug, user?.id]);

  const byType = useMemo(() => {
    const groups: Record<string, UnitResource[]> = {};
    for (const r of resources) (groups[classifyContentType(r)] ||= []).push(r);
    return groups;
  }, [resources]);

  const notes = [...(byType["Notes"] || []), ...(byType["Revision Guide"] || []), ...(byType["Course Outline"] || [])];
  const featured = notes[0];
  const recent = useMemo(
    () => [...resources].sort((a, b) =>
      new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime(),
    ).slice(0, 6),
    [resources],
  );

  const completedTopics = topicProgress.filter((t) => t.status === "completed").map((t) => t.topic_id);
  const progressPercent = topics.length
    ? Math.round((topics.filter((t) => completedTopics.includes(t.id)).length / topics.length) * 100)
    : 0;

  const toggleTopic = async (topic: SyllabusTopic) => {
    if (!user) return;
    const previous = topicProgress;
    const isDone = completedTopics.includes(topic.id);
    const next = isDone ? "not_started" : "completed";
    setTopicProgressState((prev) => {
      const rest = prev.filter((p) => p.topic_id !== topic.id);
      return [...rest, { topic_id: topic.id, status: next, confidence_level: isDone ? 0 : 3, correct_answers: 0, attempted_questions: 0 }];
    });
    try {
      await setTopicProgress(user.id, topic.id, { status: next, completed_at: isDone ? null : new Date().toISOString() });
    } catch {
      setTopicProgressState(previous);
      toast({ description: "Could not save your progress. Please try again.", variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl space-y-4 px-5 py-10">
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="h-10 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-16 text-center">
        <h1 className="font-serif text-2xl font-bold text-foreground">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  if (!unit) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-16 text-center">
        <Helmet><meta name="robots" content="noindex, follow" /></Helmet>
        <h1 className="font-serif text-2xl font-bold text-foreground">Unit not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">This unit is not published yet.</p>
        <Link to={`/year/${year || 1}`} className="mt-4 inline-block text-sm font-semibold text-primary hover:underline">
          Back to Year {year || 1}
        </Link>
      </div>
    );
  }

  const canonical = `${SITE_URL}/year/${year}/unit/${unit.slug}`;
  const title = `${unit.name} — Year ${year} Notes, Past Papers & MCQs | OmpathStudy`;
  const description =
    (unit.description || `Year ${year} ${unit.name} notes, CATs, past papers, MCQ banks and flashcards.`).slice(0, 155);

  const counts = [
    { label: "Notes", value: notes.length, icon: BookOpen },
    { label: "MCQ banks", value: (byType["MCQ Bank"] || []).length, icon: ListChecks },
    { label: "CATs", value: (byType["CAT"] || []).length, icon: ClipboardList },
    { label: "Past papers", value: (byType["Past Paper"] || []).length, icon: FileText },
    { label: "Flashcards", value: (byType["Flashcards"] || []).length, icon: GraduationCap },
  ];

  return (
    <div className="mx-auto max-w-5xl px-5 py-8 sm:py-10">
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={canonical} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={canonical} />
        <meta name="twitter:card" content="summary" />
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "OmpathStudy", item: SITE_URL },
              { "@type": "ListItem", position: 2, name: `Year ${year}`, item: `${SITE_URL}/year/${year}` },
              { "@type": "ListItem", position: 3, name: unit.name, item: canonical },
            ],
          })}
        </script>
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Course",
            name: unit.name,
            description,
            courseCode: unit.course_code || undefined,
            educationalLevel: `Year ${year}`,
            provider: { "@type": "Organization", name: "OmpathStudy", url: SITE_URL },
          })}
        </script>
      </Helmet>

      <nav aria-label="Breadcrumb" className="mb-5 flex items-center gap-1.5 overflow-x-auto text-xs text-muted-foreground">
        <Link to="/" className="hover:text-primary">Home</Link> ›{" "}
        <Link to={`/year/${year}`} className="hover:text-primary">Year {year}</Link> ›{" "}
        <span className="text-foreground">{unit.name}</span>
      </nav>

      <header className="study-surface border-x-0 border-t-0 bg-transparent px-0 pb-6 pt-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">
          Year {year}{unit.course_code ? ` · ${unit.course_code}` : ""}
        </p>
        <h1 className="mt-1 font-serif text-3xl font-bold text-foreground">{unit.name}</h1>
        {unit.description && <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{unit.description}</p>}

        <dl className="mt-6 grid grid-cols-2 gap-0 divide-x divide-y divide-border border-y border-border sm:grid-cols-5 sm:divide-y-0">
          {counts.map((c) => (
            <div key={c.label} className="bg-background p-3 sm:p-4">
              <dt className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                <c.icon className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                {c.label}
              </dt>
              <dd className="mt-1 text-lg font-bold text-foreground">{c.value}</dd>
            </div>
          ))}
        </dl>

        {topics.length > 0 && (
          <div className="mt-5">
            <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
              <span>Your syllabus progress</span>
              <span>{progressPercent}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={progressPercent} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progressPercent}%` }} />
            </div>
          </div>
        )}
      </header>

      <Tabs defaultValue="Overview" className="mt-6">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
          {TABS.map((t) => (
            <TabsTrigger key={t} value={t} className="min-h-[40px] text-xs sm:text-sm">{t}</TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="Overview" className="mt-4 space-y-5">
          {featured && (
            <section className="rounded-2xl border border-primary/30 bg-primary/5 p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">Start here</p>
              <h2 className="mt-1 font-serif text-lg font-bold text-foreground">{featured.title}</h2>
              <Button asChild size="sm" className="mt-3">
                <Link to={resourcePath(featured)}>Open comprehensive note</Link>
              </Button>
            </section>
          )}

          {unit.learning_objectives && (
            <section className="rounded-2xl border border-border bg-card p-5">
              <h2 className="flex items-center gap-2 font-serif text-lg font-bold text-foreground">
                <Target className="h-4 w-4 text-primary" /> Learning objectives
              </h2>
              <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{unit.learning_objectives}</p>
            </section>
          )}

          {unit.exam_information && (
            <section className="rounded-2xl border border-border bg-card p-5">
              <h2 className="flex items-center gap-2 font-serif text-lg font-bold text-foreground">
                <Info className="h-4 w-4 text-primary" /> Examination information
              </h2>
              <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{unit.exam_information}</p>
            </section>
          )}

          <section className="rounded-2xl border border-border bg-card p-5">
            <h2 className="font-serif text-lg font-bold text-foreground">Recommended study order</h2>
            <ol className="mt-3 space-y-2 text-sm text-muted-foreground">
              {[notes[0], (byType["Flashcards"] || [])[0], (byType["MCQ Bank"] || [])[0], (byType["CAT"] || [])[0], (byType["Past Paper"] || [])[0]]
                .filter(Boolean)
                .map((r, i) => (
                  <li key={(r as UnitResource).id} className="flex items-start gap-2">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
                      {i + 1}
                    </span>
                    <Link to={resourcePath(r as UnitResource)} className="hover:text-primary">
                      {classifyContentType(r as UnitResource)}: {(r as UnitResource).title}
                    </Link>
                  </li>
                ))}
              {resources.length === 0 && <li>Resources are being prepared for this unit.</li>}
            </ol>
          </section>

          <section className="rounded-2xl border border-border bg-card p-5">
            <h2 className="font-serif text-lg font-bold text-foreground">Recently added</h2>
            <div className="mt-3 space-y-2">
              {recent.length ? recent.map((r) => <ResourceRow key={`${r.kind}-${r.id}`} r={r} />) : <EmptyState label="Resources being prepared." />}
            </div>
          </section>
        </TabsContent>

        <TabsContent value="Syllabus" className="mt-4">
          {topics.length === 0 ? (
            <EmptyState label="The syllabus checklist for this unit is being prepared." />
          ) : (
            <ul className="space-y-2">
              {topics.map((t) => {
                const done = completedTopics.includes(t.id);
                return (
                  <li key={t.id} className="rounded-xl border border-border bg-card p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground">{t.title}</p>
                        <p className="mt-0.5 text-[11px] uppercase tracking-wide text-muted-foreground">{t.importance}</p>
                        {t.description && <p className="mt-1.5 text-sm text-muted-foreground">{t.description}</p>}
                      </div>
                      <Button
                        size="sm"
                        variant={done ? "default" : "outline"}
                        onClick={() => toggleTopic(t)}
                        disabled={!user}
                        aria-pressed={done}
                        className="min-h-[40px] shrink-0"
                      >
                        <Check className="mr-1.5 h-4 w-4" /> {done ? "Studied" : "Mark studied"}
                      </Button>
                    </div>
                    {!user && <p className="mt-2 text-[11px] text-muted-foreground">Sign in to save topic progress.</p>}
                  </li>
                );
              })}
            </ul>
          )}
        </TabsContent>

        {([
          ["Notes", notes],
          ["Questions", [...(byType["MCQ Bank"] || []), ...(byType["Timed Exam"] || [])]],
          ["CATs", byType["CAT"] || []],
          ["Past Papers", byType["Past Paper"] || []],
          ["Flashcards", byType["Flashcards"] || []],
          ["Exams", byType["Timed Exam"] || []],
        ] as [string, UnitResource[]][]).map(([tab, list]) => (
          <TabsContent key={tab} value={tab} className="mt-4 space-y-2">
            {list.length ? list.map((r) => <ResourceRow key={`${r.kind}-${r.id}`} r={r} />) : (
              <EmptyState label={`${tab} for ${unit.name} are being prepared.`} />
            )}
            {tab === "Exams" && (
              <Link to={`/exams?year=Year ${year}`} className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
                <Trophy className="h-4 w-4" /> Browse timed exams for Year {year}
              </Link>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
