import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, useScroll, useTransform } from "framer-motion";
import {
  BookOpen, GraduationCap, Loader2,
  ArrowRight, Trophy, BookMarked, Phone, MessageCircle, Clock, Check, Search,
} from "lucide-react";
import { getAllCategories, getCategoryDisplayName, getYearFromCategory, YEAR_CATEGORIES, buildBlogPath, buildFlashcardPath } from "@/lib/store";
import { buildStoryPath, updateMetaTags } from "@/lib/seo";
import { supabase } from "@/integrations/supabase/client";
import { getRecentArticles, type RecentArticle } from "@/lib/progress-store";
import { getSubjectKey, subjectColor } from "@/components/subjectTheme";
import { useAuth } from "@/hooks/useAuth";

/* Resource tiles — the Geeky Medics "Explore our resources" block: a small number
   of large, colour-blocked entry points instead of a wall of small links. */
const RESOURCES = [
  { to: "/blog", label: "Study Notes & MCQs", desc: "Notes and quiz questions by year & unit", icon: BookOpen, subject: "pathology" },
  { to: "/exams", label: "Past Papers & CATs", desc: "Timed exam mode, real papers", icon: Trophy, subject: "exam" },
  { to: "/flashcards", label: "Flashcards", desc: "Rapid recall before the ward", icon: GraduationCap, subject: "anatomy" },
];

const YEAR3_PRIORITY = [
  { label: "Paper 1", detail: "Bacteriology + Parasitology II / Medical Entomology", to: "/blog?year=Year%203&track=paper-1" },
  { label: "Paper 2", detail: "Medical Mycology + Medical Virology", to: "/blog?year=Year%203&track=paper-2" },
  { label: "General & Systemic Pathology", detail: "General principles and organ-system pathology", to: "/blog?year=Year%203&unit=Year%203%3A%20General%20Pathology" },
  { label: "Haematology", detail: "Dr. Orata’s reviewed 108-question bank", to: "/exams/7fd6b778-ec52-4e41-ac34-ee69a7bbe68d/start" },
];

/* Proof points — TeachMeAnatomy / Lecturio hero pattern: the value of the library
   is stated as checkable facts right beside the headline. */
const PROOF = [
  "Notes mapped to the MBChB curriculum, Year 1 → Year 6",
  "Compiled from real past papers and CATs",
  "Every MCQ set, exam and paper is completely free",
  "Written for Kenyan medical schools — MKU, UoN, KU, JKUAT",
];

type RecentItem = { id: string; title: string; type: "article" | "flashcard" | "story"; category: string; created_at: string; slug?: string | null };

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

// Shared reveal easing
const REVEAL_EASE = [0.22, 1, 0.36, 1] as const;

const sectionReveal = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: REVEAL_EASE } },
};

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};

const tileReveal = {
  hidden: { opacity: 0, y: 20, scale: 0.98 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.5, ease: REVEAL_EASE } },
};

// Sync probe: repository edits should appear automatically in the Lovable editor.
export default function Index() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const heroRef = useRef<HTMLDivElement>(null);
  const [prefersReducedMotion] = useState(
    () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
  );
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  // Subtle parallax: hero content drifts up slightly while the band stays put.
  // Scroll-linked transforms aren't covered by MotionConfig's reducedMotion prop
  // (that only governs animate/transition props), so this is checked directly.
  const heroY = useTransform(scrollYProgress, [0, 1], prefersReducedMotion ? [0, 0] : [0, 70]);
  const heroFade = useTransform(scrollYProgress, [0, 0.75], prefersReducedMotion ? [1, 1] : [1, 0.4]);
  const [categories, setCategories] = useState<{ name: string; articles: number; flashcards: number; mcqs: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [recentlyUploaded, setRecentlyUploaded] = useState<RecentItem[]>([]);
  const [lastRead, setLastRead] = useState<RecentArticle[]>([]);
  const [activeTab, setActiveTab] = useState<"all" | "articles" | "flashcards" | "stories">("all");
  const [query, setQuery] = useState("");
  const [recentShown, setRecentShown] = useState(10);
  const [studyYear, setStudyYear] = useState<number | null>(null);

  useEffect(() => {
    if (!user) { setStudyYear(null); return; }
    (supabase as any).from("profiles").select("study_year").eq("user_id", user.id).maybeSingle()
      .then(({ data }: { data: any }) => setStudyYear(data?.study_year ? Number(data.study_year) : null));
  }, [user]);

  useEffect(() => {
    updateMetaTags({
      title: "Medical Notes, MCQs & Exams | OmpathStudy",
      description: "Free medical study notes, MCQs, flashcards and timed exams for MBChB and health students across Kenya and East Africa.",
    });

    // Load categories
    getAllCategories().then(setCategories).finally(() => setLoading(false));

    // Load last read
    setLastRead(getRecentArticles());

    // Recently updated: one aggregated request that returns metadata only. The
    // database already filters out empty shells (no body text / no questions),
    // so the browser never downloads article bodies just to render this list.
    supabase
      .rpc("home_recent", { limit_n: 40 })
      .then(({ data }) => {
        // "mcq" rows are leftover quiz-bank sets (weekly exam content only, now that
        // the rest have been migrated into articles) — they have no public page to
        // link to since the /mcqs bank was retired, so they're dropped here.
        const items: RecentItem[] = (data || [])
          .filter((r) => r.kind !== "mcq")
          .map((r) => ({
            id: r.id,
            title: r.title,
            category: r.category,
            created_at: r.created_at,
            slug: r.slug,
            type: r.kind as RecentItem["type"],
          }));
        setRecentlyUploaded(items);
      });
  }, []);

  const yearGroups = Object.keys(YEAR_CATEGORIES).map(year => {
    const yearCats = categories.filter(c => getYearFromCategory(c.name) === year);
    const total = yearCats.reduce((sum, c) => sum + c.articles + c.flashcards + c.mcqs, 0);
    return { year, categories: yearCats, total };
  }).filter(g => g.total > 0);

  const libraryTotals = categories.reduce(
    (acc, c) => ({
      notes: acc.notes + c.articles,
      mcqs: acc.mcqs + c.mcqs,
      units: acc.units + 1,
    }),
    { notes: 0, mcqs: 0, units: 0 },
  );

  const filteredRecent = recentlyUploaded.filter(item => activeTab === "all" || (activeTab === "articles" && item.type === "article") || (activeTab === "flashcards" && item.type === "flashcard") || (activeTab === "stories" && item.type === "story"));

  function getItemLink(item: RecentItem) {
    switch (item.type) {
      case "article": return buildBlogPath(item);
      case "flashcard": return buildFlashcardPath(item);
      case "story": return buildStoryPath(item);
    }
  }

  const typeMeta = {
    article: { label: "Article", short: "ART", icon: BookOpen, badge: "bg-purple-500/10 text-purple-700 dark:text-purple-300" },
    flashcard:{ label: "Flashcards", short: "FC", icon: GraduationCap, badge: "bg-blue-500/10 text-blue-700 dark:text-blue-300" },
    story:   { label: "Story",   short: "STY", icon: BookMarked, badge: "bg-amber-500/10 text-amber-700 dark:text-amber-300" },
  } as const;

  return (
    <div className="min-h-dvh bg-background">
      {/* ── Hero: split colour band (Osmosis/Lecturio) + checkable proof points
             (TeachMeAnatomy) + a search bar as the primary action (AMBOSS). ── */}
      <section ref={heroRef} className="band-ink relative overflow-hidden border-b border-white/10">
        <div className="pointer-events-none absolute -left-24 top-0 h-72 w-72 rounded-full bg-primary/20 blur-3xl" aria-hidden />
        <motion.div
          style={{ y: heroY, opacity: heroFade }}
          className="relative mx-auto grid max-w-6xl gap-8 px-5 py-9 sm:py-12 lg:grid-cols-[1.1fr,0.9fr] lg:items-center lg:py-14"
        >
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-white/80">
              YOUR MEDICAL STUDY WORKSPACE
            </span>
            <h1 className="mt-5 font-serif text-[2.15rem] font-bold leading-[1.06] tracking-tight sm:text-5xl lg:text-[3.4rem]">
              Your medical study workspace<br className="hidden sm:block" />
              <span style={{ color: "hsl(var(--highlight))" }}>Year → Unit → Topic → Exam.</span>
            </h1>
            <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-white/75 sm:text-base">
              Start with your year, open a unit, read the notes, practise questions, test yourself, then revise.
            </p>

            {/* Search-first entry */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                navigate(query.trim() ? `/blog?q=${encodeURIComponent(query.trim())}` : "/blog");
              }}
              className="mt-6 flex max-w-2xl overflow-hidden rounded-lg bg-white shadow-md shadow-black/15"
            >
              <span className="flex items-center pl-4 text-muted-foreground"><Search className="h-4 w-4" /></span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search a topic — e.g. atherosclerosis, TB drugs…"
                aria-label="Search study notes"
                className="min-w-0 flex-1 bg-transparent px-3 py-3.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
              <button type="submit" className="bg-primary px-5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90">
                Search
              </button>
            </form>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/blog" className="rounded-lg bg-white px-6 py-3 text-sm font-bold text-[hsl(var(--ink))] transition hover:bg-white/90">
                Browse by year
              </Link>
              <Link to="/exams" className="rounded-lg border border-white/25 px-6 py-3 text-sm font-bold text-white transition hover:bg-white/10">
                Practise timed exams
              </Link>
            </div>
          </div>

          {/* Proof card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.5, ease: REVEAL_EASE }}
            className="rounded-2xl border border-white/15 bg-white/[0.06] p-6 backdrop-blur-sm"
          >
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/60">Why students use it</p>
            <ul className="mt-4 space-y-3">
              {PROOF.map((p) => (
                <li key={p} className="flex gap-3 text-sm leading-relaxed text-white/85">
                  <Check className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "hsl(var(--highlight))" }} />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
            <div className="mt-6 grid grid-cols-3 gap-3 border-t border-white/10 pt-5 text-center">
              {[
                { v: libraryTotals.notes, l: "Notes" },
                { v: libraryTotals.mcqs, l: "MCQ sets" },
                { v: libraryTotals.units, l: "Units" },
              ].map((s) => (
                <div key={s.l}>
                  <p className="font-serif text-2xl font-bold text-white">{s.v || "—"}</p>
                  <p className="text-[11px] uppercase tracking-wide text-white/55">{s.l}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* ── Resource tiles ── */}
      <section className="mx-auto max-w-6xl px-5 py-10 sm:py-14">
        <motion.div
          variants={sectionReveal}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.4 }}
          className="rule-heading mb-5 font-serif text-xl font-bold text-foreground sm:text-2xl"
        >
          Explore the library
        </motion.div>
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4"
          >
          {(studyYear === 1 || studyYear === 2) && (
            <motion.div variants={tileReveal} className="col-span-2 h-full lg:col-span-4">
              <Link
                to={`/blog?year=Year%20${studyYear}&unit=${encodeURIComponent(`Year ${studyYear}: Aponeurosis - Anatomy`)}`}
                className="group flex min-h-32 items-center gap-4 rounded-2xl border-2 border-primary/35 bg-primary/10 p-5 transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-[var(--shadow-elevated)] sm:p-6"
              >
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground"><BookMarked className="h-7 w-7" /></span>
                <span className="min-w-0 flex-1">
                  <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">Your essential anatomy revision</span>
                  <span className="mt-1 block font-serif text-xl font-bold text-foreground sm:text-2xl">Aponeurosis Anatomy Image Spot Bank</span>
                  <span className="mt-1 block text-xs leading-relaxed text-muted-foreground sm:text-sm">Photographs and labelled structures with tap-to-reveal answers for Year 1 and Year 2.</span>
                </span>
                <ArrowRight className="h-5 w-5 shrink-0 text-primary transition-transform group-hover:translate-x-1" />
              </Link>
            </motion.div>
          )}
          {studyYear === 3 && (
            <motion.div variants={tileReveal} className="col-span-2 lg:col-span-4">
              <div className="rounded-2xl border-2 border-primary/35 bg-primary/10 p-5 sm:p-6">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">Your Year 3 priority revision</p>
                <h2 className="mt-1 font-serif text-xl font-bold text-foreground sm:text-2xl">Microbiology, Pathology &amp; Haematology</h2>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {YEAR3_PRIORITY.map((item) => <Link key={item.label} to={item.to} className="group rounded-xl border border-border bg-card p-3 transition-colors hover:border-primary/50 hover:bg-primary/5">
                    <span className="flex items-center justify-between gap-2 text-sm font-bold text-foreground">{item.label}<ArrowRight className="h-4 w-4 text-primary transition-transform group-hover:translate-x-0.5" /></span>
                    <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{item.detail}</span>
                  </Link>)}
                </div>
              </div>
            </motion.div>
          )}
          {RESOURCES.map((r) => {
            const key = getSubjectKey(r.subject);
            return (
              <motion.div key={r.to} variants={tileReveal} className="h-full">
              <Link
                to={r.to}
                className="group relative block h-full overflow-hidden rounded-2xl border border-border bg-card transition-all duration-300 hover:-translate-y-1.5 hover:border-primary/40 hover:shadow-[var(--shadow-elevated)]"
              >
                <div
                  className="flex h-24 items-end p-4 transition-transform duration-500 group-hover:scale-[1.06] sm:h-32"
                  style={{ background: `linear-gradient(140deg, ${subjectColor(key, 0.95)}, ${subjectColor(key, 0.55)})` }}
                >
                  <r.icon className="h-7 w-7 text-white/90 transition-transform duration-300 group-hover:scale-110 sm:h-8 sm:w-8" />
                </div>
                <div className="p-4">
                  <h3 className="text-sm font-bold text-foreground sm:text-base">{r.label}</h3>
                  <p className="mt-1 text-[11px] leading-snug text-muted-foreground sm:text-xs">{r.desc}</p>
                </div>
              </Link>
              </motion.div>
            );
          })}
        </motion.div>
      </section>

      <section className="band-surface">
      <div className="mx-auto max-w-6xl px-5 py-10 sm:py-14">
        {/* Last Read */}
        {lastRead.length > 0 && (
          <div className="mb-10">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="h-4 w-4 text-primary" />
              <h2 className="font-serif text-xl font-bold text-foreground">Continue Reading</h2>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {lastRead.slice(0, 3).map(ra => {
                const cleanTitle = (ra.title || "")
                  .replace(/^(?:[\p{Extended_Pictographic}\u2600-\u27BF]|\uFE0F)+/gu, "")
                  .trim();
                return (
                  <Link key={ra.id} to={buildBlogPath(ra)}
                    className="group flex items-start gap-3 rounded-xl border border-border bg-card px-4 py-3 transition-all hover:shadow-sm hover:border-primary/20">
                    <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground line-clamp-2 group-hover:text-primary transition-colors">{cleanTitle}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground truncate">{ra.category}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Browse by Year */}
        <motion.div
          variants={sectionReveal}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          className="mb-10"
        >
          <div className="mb-5 flex items-end justify-between gap-4">
            <div className="min-w-0">
              <h2 className="font-serif text-xl sm:text-2xl font-bold text-foreground">Browse by year</h2>
              <p className="mt-0.5 text-xs sm:text-sm text-muted-foreground">Pick your year, then a semester or unit</p>
            </div>
            <Link to="/blog" className="whitespace-nowrap text-xs font-semibold text-primary hover:underline sm:text-sm">View all</Link>
          </div>
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : yearGroups.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-10 text-center">
              <GraduationCap className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
              <p className="text-muted-foreground">No study materials yet. Content is being added regularly!</p>
            </div>
          ) : (
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.1 }}
              className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3"
            >
              {yearGroups.map((group) => (
                <motion.div key={group.year} variants={tileReveal} className="h-full">
                <Link
                  to={`/blog?year=${encodeURIComponent(group.year)}`}
                  className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-[var(--shadow-card-hover)]"
                >
                  <div className="flex items-baseline justify-between border-b border-border px-5 py-4">
                    <span className="font-serif text-xl font-bold text-foreground">{group.year}</span>
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {group.categories.length} units
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 p-4">
                    {group.categories.slice(0, 6).map(cat => {
                      return (
                        <span
                          key={cat.name}
                          className="max-w-full truncate rounded-md bg-muted px-2 py-1 text-[11px] font-semibold text-foreground/80"
                        >
                          {getCategoryDisplayName(cat.name)}
                        </span>
                      );
                    })}
                    {group.categories.length > 6 && (
                      <span className="rounded-md bg-muted px-2 py-1 text-[11px] font-semibold text-muted-foreground">
                        +{group.categories.length - 6}
                      </span>
                    )}
                  </div>
                  <span className="mt-auto flex items-center gap-1.5 px-5 pb-4 text-xs font-bold text-primary">
                    Open {group.year} <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </Link>
                </motion.div>
              ))}
            </motion.div>
          )}
        </motion.div>

        {/* Recently Updated */}
        <motion.div
          variants={sectionReveal}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.1 }}
        >
          <div className="mb-5">
            <h2 className="font-serif text-xl font-bold text-foreground sm:text-2xl">Recently updated</h2>
            <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">The latest edited notes, flashcards and clinical stories</p>
          </div>
          <div className="flex gap-2 mb-5 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
            {(["all", "articles", "flashcards", "stories"] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold transition-all capitalize ${activeTab === tab ? "bg-foreground text-background" : "border border-border bg-card text-muted-foreground hover:text-foreground"}`}>
                {tab}
              </button>
            ))}
          </div>
          {filteredRecent.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-8 text-center">
              <p className="text-sm text-muted-foreground">No content yet. Check back soon!</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-border bg-card">
              {filteredRecent.slice(0, recentShown).map(item => {
                const meta = typeMeta[item.type];
                const Icon = meta.icon;
                return (
                  <Link key={`${item.type}-${item.id}`} to={getItemLink(item)}
                    className="row-cv group relative flex items-center gap-3 border-b border-border px-3 py-3 transition-colors last:border-b-0 hover:bg-muted/50 sm:gap-4 sm:px-4">
                    <span className="absolute left-0 top-0 h-full w-[3px] bg-primary/60" aria-hidden />
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground/70">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${meta.badge}`}>{meta.label}</span>
                        <span className="text-[11px] text-muted-foreground">{timeAgo(item.created_at)}</span>
                      </div>
                      <h4 className="truncate text-sm sm:text-base font-semibold text-foreground group-hover:text-primary transition-colors">{item.title}</h4>
                      <p className="truncate text-xs text-muted-foreground">{getCategoryDisplayName(item.category)}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  </Link>
                );
              })}
            </div>
          )}
          {filteredRecent.length > recentShown && (
            <div className="mt-5 flex justify-center">
              <button
                onClick={() => setRecentShown((n) => n + 10)}
                className="rounded-lg border border-border bg-card px-6 py-2.5 text-sm font-bold text-foreground transition-colors hover:border-primary/40 hover:text-primary"
              >
                Show more
              </button>
            </div>
          )}
        </motion.div>
      </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-background">
        <div className="mx-auto max-w-6xl px-5 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">© {new Date().getFullYear()} Ompath Study</p>
          <div className="flex gap-2">
            <a href="tel:+254115475543" className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors">
              <Phone className="h-3.5 w-3.5" />
            </a>
            <a href="https://wa.me/254115475543" target="_blank" rel="noopener noreferrer" className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors">
              <MessageCircle className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
