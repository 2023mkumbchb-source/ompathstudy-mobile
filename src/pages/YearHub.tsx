import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { ArrowRight, BookMarked, BookOpen, ClipboardCheck, Clock, FileQuestion, GraduationCap, Images, Trophy } from "lucide-react";
import {
  YEAR_CATEGORIES,
  getPublishedArticleSummaries,
  getCategoryDisplayName,
  buildBlogPath,
  type Article,
} from "@/lib/store";
import { Helmet } from "react-helmet-async";
import { getUnitsForYear, unitPath, type Unit } from "@/lib/academic";
import { Skeleton } from "@/components/ui/skeleton";
import { getYear3Semester } from "@/lib/year3Semesters";
import ExamCountdownWidget from "@/components/ExamCountdownWidget";

function year3SemesterFor(article: Article): 1 | 2 | 3 {
  if ([1, 2, 3].includes(Number(article.semester_number))) return Number(article.semester_number) as 1 | 2 | 3;
  const unit = getCategoryDisplayName(article.category);
  const mapped = getYear3Semester(unit);
  if (mapped) return mapped;
  if (/virology|mycology|dermatopath|neuropath|breast|bone|reproductive|urinary|blood transfusion/i.test(`${article.title} ${unit}`)) return 3;
  if (/bacteriology|parasitology|entomology|general path|immunopath|genetic/i.test(`${article.title} ${unit}`)) return 1;
  if (/hematopathology|haematology|cardiovascular|respiratory|gastrointestinal|endocrine|pharmacology/i.test(`${article.title} ${unit}`)) return 2;
  return 1;
}

function year3ResourceKind(article: Article): "cat" | "exam" | "notes" {
  const text = `${article.content_type || ""} ${article.title}`;
  if (/\bCAT\b|continuous assessment/i.test(text)) return "cat";
  if (/past paper|supplementary|end[- ]of[- ]year|\bexam(?:ination)?\b/i.test(text)) return "exam";
  return "notes";
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${Math.max(mins, 1)}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

const YEAR_NUMBERS = [1, 2, 3, 4, 5, 6] as const;
const YEAR3_PRIORITY = [
  { title: "Paper 1", description: "Bacteriology and Parasitology II / Medical Entomology", to: "/blog?year=Year%203&track=paper-1" },
  { title: "Paper 2", description: "Medical Mycology and Medical Virology", to: "/blog?year=Year%203&track=paper-2" },
  { title: "General & Systemic Pathology", description: "General principles and organ-system pathology", to: "/blog?year=Year%203&unit=Year%203%3A%20General%20Pathology" },
  { title: "Haematology", description: "Dr. Orata’s reviewed 108-question MCQ bank", to: "/exams/7fd6b778-ec52-4e41-ac34-ee69a7bbe68d/start" },
];

export default function YearHub() {
  const { yearNumber } = useParams();
  const location = useLocation();
  const parsedYear = Number(yearNumber);
  const isValidYear = YEAR_NUMBERS.includes(parsedYear as (typeof YEAR_NUMBERS)[number]);

  // Hooks must run unconditionally on every render (Rules of Hooks) — the
  // "invalid year" early return happens further down, after all of them,
  // and each effect guards itself with isValidYear instead.
  const location2 = location;
  const [recent, setRecent] = useState<Article[]>([]);
  const [yearArticles, setYearArticles] = useState<Article[]>([]);
  const [recentLoading, setRecentLoading] = useState(true);
  const [canonicalUnits, setCanonicalUnits] = useState<Unit[]>([]);
  const [unitsLoading, setUnitsLoading] = useState(true);

  const yearLabel = isValidYear ? `Year ${parsedYear}` : "";
  const units = isValidYear ? (YEAR_CATEGORIES[yearLabel] || []) : [];
  const hasAponeurosis = parsedYear === 1 || parsedYear === 2;

  useEffect(() => {
    if (!isValidYear) { setRecentLoading(false); return; }
    let alive = true;
    setRecentLoading(true);
    getPublishedArticleSummaries(yearLabel)
      .then(list => {
        if (!alive) return;
        const sorted = [...list].sort((a, b) =>
          new Date(b.updated_at || b.created_at).getTime() -
          new Date(a.updated_at || a.created_at).getTime()
        );
        setRecent(sorted.slice(0, 6));
        setYearArticles(sorted);
      })
      .catch((err) => {
        console.warn("Could not load year articles:", err);
      })
      .finally(() => {
        if (alive) setRecentLoading(false);
      });
    return () => { alive = false; };
  }, [isValidYear, yearLabel]);

  useEffect(() => {
    if (!isValidYear) { setUnitsLoading(false); return; }
    let alive = true;
    setUnitsLoading(true);
    getUnitsForYear(parsedYear)
      .then((list) => {
        if (!alive) return;
        setCanonicalUnits(list);
      })
      .catch((err) => {
        console.warn("Could not load units for year:", err);
      })
      .finally(() => {
        if (alive) setUnitsLoading(false);
      });
    return () => { alive = false; };
  }, [isValidYear, parsedYear]);

  if (!isValidYear) {
    return (
      <div className="mx-auto max-w-5xl px-5 py-16 text-center">
        <h1 className="font-serif text-2xl font-bold text-foreground">Invalid year</h1>
        <p className="mt-2 text-sm text-muted-foreground">Please choose a valid year from the menu.</p>
      </div>
    );
  }

  const ogUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}${location.pathname}${location.search}`
      : location.pathname;

  const title = `${yearLabel} Study Materials | OmpathStudy Kenya`;
  const description =
    `Browse ${yearLabel} medical study notes, flashcards, MCQs, and exams on OmpathStudy for Kenyan health students.`;
  const keywords =
    `OmpathStudy, ${yearLabel}, medical students Kenya, nursing students Kenya, study notes, MCQs, flashcards, exams, medical education Kenya`;

  const sections = [
    {
      title: "Blog",
      description: "All study notes organized by unit",
      to: `/blog?year=${encodeURIComponent(yearLabel)}`,
      icon: BookOpen,
    },
    {
      title: "Flashcards",
      description: "Quick review cards for this year",
      to: `/flashcards?year=${encodeURIComponent(yearLabel)}`,
      icon: GraduationCap,
    },
    {
      title: "Exams",
      description: "Timed tests filtered to this year",
      to: `/exams?year=${encodeURIComponent(yearLabel)}`,
      icon: Trophy,
    },
  ];
  const year3Groups = [1, 2, 3].map((semester) => {
    const articles = yearArticles.filter((article) => year3SemesterFor(article) === semester);
    const units = [...new Set(articles.map((article) => getCategoryDisplayName(article.category)).filter((unit) => unit !== "Reference"))].sort();
    return { semester, articles, units, cats: articles.filter((article) => year3ResourceKind(article) === "cat"), exams: articles.filter((article) => year3ResourceKind(article) === "exam"), notes: articles.filter((article) => year3ResourceKind(article) === "notes") };
  });

  return (
    <div className="mx-auto max-w-5xl px-5 py-10 sm:py-12">
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={description} />
        <meta name="keywords" content={keywords} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={ogUrl} />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
      </Helmet>

      <nav aria-label="Breadcrumb" className="mb-4 text-xs text-muted-foreground">
        <Link to="/" className="hover:text-primary">Home</Link> ›{" "}
        <span className="text-foreground">{yearLabel}</span>
      </nav>

      <div className="rounded-2xl border border-border bg-card p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">Study navigation</p>
        <h1 className="mt-1 font-serif text-3xl font-bold text-foreground">{yearLabel}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Choose a section below to continue with {yearLabel} content only.</p>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {sections.map((section) => (
          <Link
            key={section.title}
            to={section.to}
            className="group rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/40 hover:bg-primary/5"
          >
            <div className="mb-3 flex items-center gap-2">
              <section.icon className="h-4 w-4 text-primary" />
              <h2 className="font-serif text-lg font-bold text-foreground">{section.title}</h2>
            </div>
            <p className="text-sm text-muted-foreground">{section.description}</p>
            <p className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary">
              Open {section.title}
              <ArrowRight className="h-3 w-3" />
            </p>
          </Link>
        ))}
      </div>

      <ExamCountdownWidget yearNumber={parsedYear} className="mt-6" />

      {parsedYear === 3 && (
        <section className="mt-6 rounded-2xl border-2 border-primary/30 bg-primary/5 p-5 sm:p-6">
          <p className="text-[11px] font-bold uppercase tracking-widest text-primary">Pinned for Year 3</p>
          <h2 className="mt-1 font-serif text-xl font-bold text-foreground">Priority revision units</h2>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {YEAR3_PRIORITY.map((item) => <Link key={item.title} to={item.to} className="group rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/50 hover:bg-primary/5">
              <span className="flex items-center justify-between gap-2 font-bold text-foreground">{item.title}<ArrowRight className="h-4 w-4 text-primary transition-transform group-hover:translate-x-0.5" /></span>
              <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{item.description}</span>
            </Link>)}
          </div>
        </section>
      )}

      {parsedYear === 3 && !recentLoading && (
        <section className="mt-6 space-y-5">
          <div><p className="text-xs font-bold uppercase tracking-widest text-primary">Simple Year 3 catalogue</p><h2 className="mt-1 font-serif text-2xl font-bold">Choose your semester</h2><p className="mt-1 text-sm text-muted-foreground">Each semester is separated into study notes, CATs and past papers. Nothing is mixed together.</p></div>
          {year3Groups.map((group) => <article key={group.semester} className="rounded-2xl border bg-card p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-primary">Semester {group.semester}</p><h3 className="mt-1 font-serif text-xl font-bold">{group.units.length} units · {group.articles.length} resources</h3></div><Link to={`/blog?year=Year%203&sem=${group.semester}`} className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">Open semester</Link></div>
            <div className="mt-4 flex flex-wrap gap-2">{group.units.map((unit) => <Link key={unit} to={`/blog?year=Year%203&sem=${group.semester}&unit=${encodeURIComponent(`Year 3: ${unit}`)}`} className="rounded-lg border bg-background px-2.5 py-1.5 text-xs text-muted-foreground hover:border-primary/40 hover:text-primary">{unit}</Link>)}</div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3"><Link to={`/blog?year=Year%203&sem=${group.semester}&resource=notes`} className="rounded-xl border bg-background p-4"><BookOpen className="h-4 w-4 text-primary" /><p className="mt-2 font-bold">Study notes</p><p className="text-xs text-muted-foreground">{group.notes.length} available</p></Link><Link to={`/blog?year=Year%203&sem=${group.semester}&resource=cat`} className="rounded-xl border bg-background p-4"><ClipboardCheck className="h-4 w-4 text-primary" /><p className="mt-2 font-bold">CATs</p><p className="text-xs text-muted-foreground">{group.cats.length} available</p></Link><Link to={`/blog?year=Year%203&sem=${group.semester}&resource=exam`} className="rounded-xl border bg-background p-4"><FileQuestion className="h-4 w-4 text-primary" /><p className="mt-2 font-bold">Past papers</p><p className="text-xs text-muted-foreground">{group.exams.length} available</p></Link></div>
            {group.cats.length > 0 && <div className="mt-5 border-t pt-4"><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">CATs already available</p><div className="mt-2 grid gap-1 sm:grid-cols-2">{group.cats.map((article) => <Link key={article.id} to={buildBlogPath(article)} className="truncate rounded-lg px-2 py-1.5 text-sm hover:bg-muted hover:text-primary">• {article.title.replace(/\s+—\s+CAT$/i, "")}</Link>)}</div></div>}
          </article>)}
          <Link to="/exams?year=Year%203" className="flex items-center justify-between gap-4 rounded-2xl border-2 border-primary/30 bg-primary/5 p-5"><div><p className="text-xs font-bold uppercase tracking-wider text-primary">After the semesters</p><h3 className="mt-1 font-serif text-xl font-bold">Year 3 Exam Centre</h3><p className="mt-1 text-sm text-muted-foreground">Timed MCQs and complete examination practice.</p></div><Trophy className="h-7 w-7 text-primary" /></Link>
        </section>
      )}

      {hasAponeurosis && (
        <Link
          to={`/blog?year=${encodeURIComponent(yearLabel)}&unit=${encodeURIComponent(`${yearLabel}: Aponeurosis - Anatomy`)}`}
          className="group mt-6 block rounded-2xl border border-primary/25 bg-primary/5 p-5 transition-colors hover:border-primary/50 hover:bg-primary/10"
        >
          <div className="flex items-start gap-3">
            <span className="rounded-xl bg-primary/10 p-2.5 text-primary"><Images className="h-5 w-5" /></span>
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-widest text-primary">Shared Year 1 &amp; Year 2 resource</p>
              <h2 className="mt-1 font-serif text-xl font-bold text-foreground">Aponeurosis Anatomy Image Spot Bank</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">Practise labelled photographs and diagrams, then reveal each answer. This is a visual spot-question bank, not an MCQ quiz.</p>
              <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary">Open image spot bank <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" /></span>
            </div>
          </div>
        </Link>
      )}

      {parsedYear !== 3 && <div className="mt-6 rounded-2xl border border-border bg-card p-5">
        <div className="mb-3 flex items-center gap-2">
          <BookMarked className="h-4 w-4 text-primary" />
          <h2 className="font-serif text-lg font-bold text-foreground">Units in {yearLabel}</h2>
        </div>
        {unitsLoading ? (
          <div className="flex flex-wrap gap-2" aria-hidden="true">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-7 w-24 rounded-lg" />)}
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {(canonicalUnits.length ? canonicalUnits : units.map(name => ({ id:name, name, slug:"", legacy_category:`${yearLabel}: ${name}` } as Unit))).map((unit) => (
              <Link key={unit.id} to={unit.slug ? unitPath(parsedYear, unit.slug) : `/blog?year=${encodeURIComponent(yearLabel)}&unit=${encodeURIComponent(unit.legacy_category || "")}`} className="rounded-lg border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary">
                {unit.name}
              </Link>
            ))}
          </div>
        )}
      </div>}

      {recentLoading && (
        <div className="mt-6 rounded-2xl border border-border bg-card p-5" aria-hidden="true">
          <Skeleton className="mb-3 h-5 w-48" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        </div>
      )}

      {!recentLoading && recent.length > 0 && (
        <div className="mt-6 rounded-2xl border border-border bg-card p-5">
          <div className="mb-3 flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            <h2 className="font-serif text-lg font-bold text-foreground">Recently Added in {yearLabel}</h2>
          </div>
          <div className="space-y-1">
            {recent.map(a => (
              <Link
                key={a.id}
                to={buildBlogPath(a)}
                state={{ from: `${location2.pathname}${location2.search}` }}
                className="group flex items-start gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted/40"
              >
                <BookOpen className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground transition-colors group-hover:text-primary">{a.title}</p>
                  <p className="text-[11px] text-muted-foreground">{getCategoryDisplayName(a.category)} · {timeAgo(a.updated_at || a.created_at)}</p>
                </div>
              </Link>
            ))}
          </div>
          <Link
            to={`/blog?year=${encodeURIComponent(yearLabel)}`}
            className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
          >
            View all {yearLabel} articles
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      )}
    </div>
  );
}
