import { useState, useEffect, useMemo, useRef } from "react";
import { useSearchParams, Link, useNavigate, useLocation } from "react-router-dom";
import { Search, X, BookOpen, Clock, ArrowLeft, ChevronDown, LayoutGrid, List, ArrowRight, SlidersHorizontal, Sparkles, TrendingUp, Star, Zap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  getCategoryDisplayName,
  getYearFromCategory,
  getPublishedArticleSummaries,
  searchPublishedArticles,
  buildBlogPath,
  getResourceSection,
  type Article,
} from "@/lib/store";
import NoteRow from "@/components/NoteRow";
import NoteCard from "@/components/NoteCard";
import UnitTile from "@/components/UnitTile";
import { getRecentArticles, type RecentArticle } from "@/lib/progress-store";
import { updateMetaTags } from "@/lib/seo";
import { getAllCategories } from "@/lib/store";
import { getYear3Semester, OTHER_UNITS_LABEL, semesterGroupSortKey } from "@/lib/year3Semesters";

const YEARS = ["All", "Year 1", "Year 2", "Year 3", "Year 4", "Year 5", "Year 6"];
const INITIAL_PER_GROUP = 6;
const LOAD_MORE_STEP = 12;

// Subject-themed gradient colors for year cards
const YEAR_THEMES: Record<string, { gradient: string; icon: string; accent: string }> = {
  "Year 1": { gradient: "from-emerald-500/90 via-teal-500/80 to-cyan-500/70", icon: "🫀", accent: "emerald" },
  "Year 2": { gradient: "from-blue-500/90 via-indigo-500/80 to-violet-500/70", icon: "🧬", accent: "blue" },
  "Year 3": { gradient: "from-purple-500/90 via-fuchsia-500/80 to-pink-500/70", icon: "🔬", accent: "purple" },
  "Year 4": { gradient: "from-orange-500/90 via-amber-500/80 to-yellow-500/70", icon: "💊", accent: "orange" },
  "Year 5": { gradient: "from-rose-500/90 via-red-500/80 to-pink-500/70", icon: "🏥", accent: "rose" },
  "Year 6": { gradient: "from-slate-600/90 via-gray-600/80 to-zinc-600/70", icon: "⚕️", accent: "slate" },
};

function normalizeYear(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (trimmed === "All") return "All";
  const match = trimmed.match(/year\s*([1-6])/i);
  return match ? `Year ${match[1]}` : null;
}

function isSharedAponeurosis(article: Pick<Article, "title" | "category">): boolean {
  return /aponeurosis/i.test(`${article.title} ${article.category}`);
}

function belongsToSelectedYear(article: Pick<Article, "title" | "category">, year: string): boolean {
  if (year === "All") return true;
  const articleYear = normalizeYear(getYearFromCategory(article.category));
  return articleYear === year || (year === "Year 2" && isSharedAponeurosis(article));
}

function selectedUnitMatches(article: Pick<Article, "title" | "category">, selectedUnit: string | null): boolean {
  if (!selectedUnit) return true;
  if (article.category === selectedUnit) return true;
  return isSharedAponeurosis(article)
    && /aponeurosis/i.test(selectedUnit)
    && getCategoryDisplayName(article.category) === getCategoryDisplayName(selectedUnit);
}

function timeAgo(ms: number): string {
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function getCoreUnitGroup(category: string): string {
  const unit = getCategoryDisplayName(category || "").toLowerCase();
  if (/pathology|hematopath|histopath|cytopath|oncopath|neuropath|breast|bone|respiratory system|cardiovascular system|gastrointestinal|endocrine|reproductive|urinary|genetic disorders|head & neck/.test(unit)) return "Pathology";
  if (/microbiology|bacteriology|virology|mycology|parasitology|immunology|blood transfusion/.test(unit)) return "Microbiology & Immunology";
  if (/pharmacology|drug|therapeutic/.test(unit)) return "Pharmacology";
  if (/physiology|git physiology|neurophysiology|communication skills/.test(unit)) return "Physiology";
  if (/biochemistry|chemistry|metabolism|molecular|genetics|cytogenetics/.test(unit)) return "Biochemistry & Genetics";
  if (/anatomy|histology|embryology|pelvis|perineum|dissection/.test(unit)) return "Anatomy & Embryology";
  if (/epidemiology|statistics|community|public health/.test(unit)) return "Community Health";
  if (/exam|paper|timetable|crash course|revision|spot|practical|tuesday|sunday|final/.test(unit)) return "Exam Papers & Revision";
  return getCategoryDisplayName(category || "Uncategorized") || "Other";
}

function getGroupLabel(year: string, category: string): string {
  if (year === "Year 3") {
    const subunit = getCategoryDisplayName(category || "");
    const sem = getYear3Semester(subunit);
    return sem ? `Semester ${sem}` : OTHER_UNITS_LABEL;
  }
  return getCoreUnitGroup(category);
}

const YEAR3_SEMESTER_OPTIONS = [
  { value: "1", label: "Semester 1" },
  { value: "2", label: "Semester 2" },
  { value: "3", label: "Semester 3" },
];

function unitMatchesSemester(unitName: string, semester: string | null): boolean {
  if (!semester) return true;
  const sem = getYear3Semester(unitName);
  return semester === "other" ? !sem : String(sem) === semester;
}

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.1 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as const } }
};

const cardHover = {
  scale: 1.02,
  y: -4,
  transition: { duration: 0.2, ease: "easeOut" as const }
};

export default function Blog() {
  useEffect(() => {
    updateMetaTags({
      title: "Medical Study Notes",
      description: "Comprehensive medical study notes and articles for Kenyan health students. Organized by unit and year.",
    });
  }, []);

  const navigate = useNavigate();
  const location = useLocation();
  const fromPath = `${location.pathname}${location.search}`;
  const [searchParams, setSearchParams] = useSearchParams();
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(() => searchParams.get("q") || "");
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchMatches, setSearchMatches] = useState<Article[] | null>(null);
  const [recentArticles, setRecentArticles] = useState<RecentArticle[]>([]);
  const [visibleCount, setVisibleCount] = useState(20);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [view, setView] = useState<"list" | "grid">(() =>
    (localStorage.getItem("ompath_notes_view") as "list" | "grid") || "list",
  );
  const setViewMode = (v: "list" | "grid") => {
    setView(v);
    try { localStorage.setItem("ompath_notes_view", v); } catch { /* ignore */ }
  };
  const [sidebarCats, setSidebarCats] = useState<{ name: string; articles: number; flashcards: number; mcqs: number }[]>([]);
  const [sortBy, setSortBy] = useState<"updated" | "az" | "read">(
    () => (localStorage.getItem("ompath_notes_sort") as "updated" | "az" | "read") || "updated",
  );
  const [kindFilter, setKindFilter] = useState<"all" | "mcq" | "essay" | "notes">("all");
  const setSort = (s: "updated" | "az" | "read") => {
    setSortBy(s);
    try { localStorage.setItem("ompath_notes_sort", s); } catch { /* ignore */ }
  };

  useEffect(() => {
    getAllCategories().then(setSidebarCats).catch(() => {});
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;
      if (event.key === "/" && !isTyping) {
        event.preventDefault();
        document.getElementById("note-search")?.focus();
      }
      if (event.key === "Escape" && search) setSearch("");
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [search]);

  const sidebarGroups = useMemo(() => {
    const groups: Record<string, { group: string; units: { category: string; name: string; count: number }[]; count: number }[]> = {};
    sidebarCats.forEach(c => {
      const y = getYearFromCategory(c.name) || "Other";
      if (!groups[y]) groups[y] = [];
      const core = getGroupLabel(y, c.name);
      let bucket = groups[y].find((g) => g.group === core);
      if (!bucket) {
        bucket = { group: core, units: [], count: 0 };
        groups[y].push(bucket);
      }
      const count = c.articles + c.mcqs + c.flashcards;
      bucket.units.push({ category: c.name, name: getCategoryDisplayName(c.name), count });
      bucket.count += count;
    });
    Object.entries(groups).forEach(([y, list]) => {
      if (y === "Year 3") {
        list.sort((a, b) => semesterGroupSortKey(a.group) - semesterGroupSortKey(b.group));
      } else {
        list.sort((a, b) => b.count - a.count || a.group.localeCompare(b.group));
      }
      list.forEach((g) => g.units.sort((a, b) => a.name.localeCompare(b.name)));
    });
    return groups;
  }, [sidebarCats]);

  const selectedYear =
    normalizeYear(searchParams.get("year")) ||
    normalizeYear(sessionStorage.getItem("nav_year_filter")) ||
    "All";

  const selectedUnit = searchParams.get("unit");
  const selectedSemester = selectedYear === "Year 3" ? searchParams.get("sem") : null;
  const selectedTrack = selectedYear === "Year 3" ? searchParams.get("track") : null;
  const selectedResource = selectedYear === "Year 3" ? searchParams.get("resource") : null;

  const resultsAnchorRef = useRef<HTMLDivElement>(null);
  const isFirstFilterRender = useRef(true);
  useEffect(() => {
    if (isFirstFilterRender.current) {
      isFirstFilterRender.current = false;
      return;
    }
    const id = window.setTimeout(() => {
      resultsAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 260);
    return () => window.clearTimeout(id);
  }, [selectedYear, selectedUnit, selectedSemester, selectedTrack]);

  useEffect(() => {
    const qpYear = normalizeYear(searchParams.get("year"));
    const savedYear = normalizeYear(sessionStorage.getItem("nav_year_filter"));
    if (!qpYear && savedYear && savedYear !== "All") {
      setSearchParams({ year: savedYear }, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    getPublishedArticleSummaries(selectedYear === "All" ? undefined : selectedYear)
      .then((data) => {
        if (mounted) setArticles(data);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    setRecentArticles(getRecentArticles());
    setVisibleCount(20);
    setExpandedGroups(new Set());
    return () => { mounted = false; };
  }, [selectedYear]);

  useEffect(() => {
    const normalizedSearch = search.trim();
    if (!normalizedSearch) {
      setSearchMatches(null);
      return;
    }
    const t = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const results = await searchPublishedArticles(
          normalizedSearch,
          selectedYear === "All" ? undefined : selectedYear,
          undefined,
        );
        setSearchMatches(results.filter((a) => a.category !== "Stories"));
      } finally {
        setSearchLoading(false);
      }
    }, 220);
    return () => clearTimeout(t);
  }, [search, selectedYear]);

  const setYear = (year: string) => {
    sessionStorage.setItem("nav_year_filter", year);
    if (year === "All") setSearchParams({});
    else setSearchParams({ year });
  };

  const setUnit = (unit: string | null) => {
    const params: Record<string, string> = {};
    if (selectedYear !== "All") params.year = selectedYear;
    if (selectedYear === "Year 3") {
      if (unit) {
        const sem = getYear3Semester(getCategoryDisplayName(unit));
        params.sem = sem ? String(sem) : "other";
      } else if (selectedSemester) {
        params.sem = selectedSemester;
      }
    }
    if (unit) params.unit = unit;
    setSearchParams(unit || selectedYear !== "All" ? params : {});
    setVisibleCount(20);
  };

  const setSemester = (sem: string | null) => {
    const params: Record<string, string> = { year: selectedYear };
    if (sem) params.sem = sem;
    setSearchParams(params);
    setVisibleCount(20);
  };

  function latestDate(arts: Article[]): number {
    return Math.max(
      ...arts.map(a => new Date(a.updated_at || a.created_at).getTime())
    );
  }

  const filtered = useMemo(() => {
    const isSearching = search.trim().length > 0;
    const base = isSearching
      ? searchMatches || []
      : articles.filter(a => {
          if (a.category === "Stories") return false;
          const matchesYear = belongsToSelectedYear(a, selectedYear);
          const matchesUnit = selectedUnitMatches(a, selectedUnit);
          const articleSemester = [1, 2, 3].includes(Number(a.semester_number))
            ? String(a.semester_number)
            : getYear3Semester(getCategoryDisplayName(a.category || ""))?.toString() || "other";
          const matchesSemester =
            !selectedSemester ||
            articleSemester === selectedSemester;
          const unitName = getCategoryDisplayName(a.category || "");
          const matchesTrack = !selectedTrack ||
            (selectedTrack === "paper-1" && /bacteriology|parasitology/i.test(unitName)) ||
            (selectedTrack === "paper-2" && /mycology|virology/i.test(unitName));
          const section = getResourceSection(a);
          // Library is notes-only by default. Explicit CAT/exam links from a
          // year hub still work, but MCQ banks belong on /mcqs.
          const matchesResource = selectedResource
            ? section === selectedResource
            : section === "notes";
          return matchesYear && matchesUnit && matchesSemester && matchesTrack && matchesResource;
        });

    const kindOf = (a: any) => {
      const k = (a.content_kind || "").toLowerCase();
      if (k.includes("mcq") && k.includes("essay")) return "both";
      if (k.includes("mcq")) return "mcq";
      if (k.includes("essay")) return "essay";
      return "notes";
    };
    const kindFiltered = kindFilter === "all"
      ? base
      : base.filter((a) => {
          const k = kindOf(a);
          return k === kindFilter || (k === "both" && kindFilter !== "notes");
        });

    const lastReadAt = (id: string) => {
      const hit = recentArticles.find((r: any) => r.id === id) as any;
      return hit?.visitedAt || 0;
    };

    const sorted = [...kindFiltered].sort((a, b) => {
      if (sortBy === "az") return (a.title || "").localeCompare(b.title || "");
      if (sortBy === "read") return lastReadAt(b.id) - lastReadAt(a.id);
      return (
        new Date(b.updated_at || b.created_at).getTime() -
        new Date(a.updated_at || a.created_at).getTime()
      );
    });

    const seen = new Set<string>();
    return sorted.filter(a => {
      if (seen.has(a.id)) return false;
      seen.add(a.id);
      return true;
    });
  }, [articles, search, searchMatches, selectedYear, selectedUnit, selectedSemester, selectedTrack, selectedResource, sortBy, kindFilter, recentArticles]);

  const yearTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    if (selectedYear !== "All") return totals;
    articles.forEach(a => {
      if (a.category === "Stories") return;
      const y = normalizeYear(getYearFromCategory(a.category));
      if (y && y !== "All") totals[y] = (totals[y] || 0) + 1;
    });
    return totals;
  }, [articles, selectedYear]);

  const showYearPicker = selectedYear === "All" && !search.trim();

  const catalogueStats = useMemo(() => {
    const notes = articles.filter(a => a.category !== "Stories");
    return { notes: notes.length, units: new Set(notes.map(a => a.category)).size };
  }, [articles]);

  const filteredRecentArticles = useMemo(() => {
    if (selectedYear === "All") return recentArticles;
    const byId = new Map(articles.map(a => [a.id, a]));
    return recentArticles.filter(r => {
      const a = byId.get(r.id);
      return a && belongsToSelectedYear(a, selectedYear);
    });
  }, [articles, recentArticles, selectedYear]);

  const unitsForYear = useMemo(() => {
    if (selectedYear === "All") return [];
    const units = new Map<string, Article[]>();
    articles.forEach(a => {
      if (belongsToSelectedYear(a, selectedYear)) {
        const category = selectedYear === "Year 2" && isSharedAponeurosis(a)
          ? a.category.replace(/^Year 1:/i, "Year 2:")
          : a.category;
        if (!units.has(category)) units.set(category, []);
        units.get(category)!.push(a);
      }
    });
    return Array.from(units.entries())
      .map(([cat, arts]) => ({
        category: cat,
        name: getCategoryDisplayName(cat),
        count: arts.length,
        latest: latestDate(arts),
      }))
      .sort((a, b) => {
        const aPriority = /aponeurosis/i.test(a.name) ? 0 : 1;
        const bPriority = /aponeurosis/i.test(b.name) ? 0 : 1;
        return aPriority - bPriority || b.latest - a.latest;
      });
  }, [articles, selectedYear]);

  const unitsForSelection = useMemo(() => {
    if (selectedYear !== "Year 3" || !selectedSemester) return unitsForYear;
    return unitsForYear.filter(u => unitMatchesSemester(u.name, selectedSemester));
  }, [unitsForYear, selectedYear, selectedSemester]);

  const year3SemesterCounts = useMemo(() => {
    const counts: Record<string, number> = { "1": 0, "2": 0, "3": 0, other: 0 };
    if (selectedYear !== "Year 3") return counts;
    unitsForYear.forEach(u => {
      const sem = getYear3Semester(u.name);
      counts[sem ? String(sem) : "other"] += u.count;
    });
    return counts;
  }, [unitsForYear, selectedYear]);

  const groupedArticles = useMemo(() => {
    if (selectedUnit || search.trim()) return null;
    const groupBySpecificUnit = selectedYear === "Year 3" && Boolean(selectedSemester);
    const groups = new Map<string, Article[]>();
    filtered.forEach(a => {
      if (!belongsToSelectedYear(a, selectedYear)) return;
      const key = groupBySpecificUnit
        ? getCategoryDisplayName(a.category || "Uncategorized") || "Other"
        : getGroupLabel(selectedYear, a.category || "Uncategorized");
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(a);
    });
    const entries = Array.from(groups.entries())
      .filter(([, arts]) => arts.length > 0)
      .map(([cat, arts]) => ({ category: cat, name: cat, articles: arts }));
    if (groupBySpecificUnit) {
      return entries.sort((a, b) => b.articles.length - a.articles.length || a.name.localeCompare(b.name));
    }
    if (selectedYear === "Year 3") {
      return entries.sort((a, b) => semesterGroupSortKey(a.category) - semesterGroupSortKey(b.category));
    }
    return entries.sort((a, b) => latestDate(b.articles) - latestDate(a.articles));
  }, [filtered, selectedUnit, search, selectedYear, selectedSemester]);

  const toggleGroup = (category: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  };

  const yearRoute = selectedYear.match(/^Year\s([1-5])$/)?.[1];

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="mb-7">
          <div className="h-9 w-48 animate-pulse rounded-lg bg-muted" />
          <div className="mt-2 h-4 w-72 animate-pulse rounded bg-muted" />
        </div>
        <div className="mb-5 h-12 animate-pulse rounded-xl bg-muted" />
        <div className="mb-5 flex gap-1">
          {[1,2,3,4,5].map(i => <div key={i} className="h-8 w-16 animate-pulse rounded-lg bg-muted" />)}
        </div>
        <div className="space-y-3">
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="flex gap-4 border border-border bg-card p-4">
              <div className="h-5 w-5 animate-pulse rounded bg-muted shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-5 py-8 sm:px-6 sm:py-10">
      <div className="grid gap-8 lg:grid-cols-[240px_minmax(0,1fr)] xl:grid-cols-[260px_minmax(0,1fr)]">
        {/* Desktop-only sidebar */}
        <aside className="hidden lg:block">
          <div className="sticky top-20 max-h-[calc(100dvh-6rem)] overflow-y-auto border-y border-border bg-background p-4">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Browse</p>
            <button
              onClick={() => { setYear("All"); setUnit(null); }}
              className={`mb-3 block w-full rounded-lg px-3 py-2 text-left text-sm font-semibold transition-all duration-200 ${selectedYear === "All" ? "bg-primary/10 text-primary shadow-sm" : "text-foreground hover:bg-muted hover:shadow-sm"}`}
            >
              All Years
            </button>
            {["Year 1", "Year 2", "Year 3", "Year 4", "Year 5", "Year 6"].map(y => {
              const coreGroups = sidebarGroups[y] || [];
              if (coreGroups.length === 0) return null;
              const isOpen = selectedYear === y;
              const theme = YEAR_THEMES[y];
              return (
                <div key={y} className="mb-2">
                  <button
                    onClick={() => setYear(isOpen ? "All" : y)}
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-semibold transition-all duration-200 ${isOpen ? "bg-primary/10 text-primary shadow-sm" : "text-foreground hover:bg-muted hover:shadow-sm"}`}
                  >
                    <span className="flex items-center gap-2">
                      <span className="text-base">{theme?.icon}</span>
                      {y}
                    </span>
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
                  </button>
                  <AnimatePresence>
                    {isOpen && (
                      <motion.ul
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="mt-1 space-y-0.5 border-l border-border pl-3 overflow-hidden"
                      >
                        {coreGroups.map(group => (
                          <li key={group.group} className="py-1">
                            <div className="mb-1 flex items-center justify-between px-2 text-[10px] font-bold uppercase tracking-wider text-foreground/70">
                              <span className="truncate">{group.group}</span>
                              <span>{group.count}</span>
                            </div>
                            <div className="space-y-0.5 pl-2">
                              {group.units.map(u => (
                                <button
                                  key={u.category}
                                  onClick={() => setUnit(selectedUnit === u.category ? null : u.category)}
                                  className={`flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-left text-xs transition-colors duration-150 ${selectedUnit === u.category ? "bg-primary/10 text-primary font-semibold" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
                                >
                                  <span className="truncate">{u.name}</span>
                                  <span className="ml-2 shrink-0 text-[10px] text-muted-foreground">{u.count}</span>
                                </button>
                              ))}
                            </div>
                          </li>
                        ))}
                      </motion.ul>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </aside>

        <div className="min-w-0">
      {/* Hero header with gradient */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="mb-7 overflow-hidden border-y border-border bg-background"
      >
        <div className="relative px-5 py-6 sm:px-7 sm:py-7">
          <div className="pointer-events-none absolute -right-10 -top-16 h-44 w-44 rounded-full bg-primary/[0.07] blur-2xl" />
          <div className="pointer-events-none absolute -left-10 -bottom-16 h-32 w-32 rounded-full bg-primary/[0.05] blur-2xl" />
        {yearRoute && (
          <button
            onClick={() => navigate(`/year/${yearRoute}`)}
            className="mb-3 inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Year {yearRoute}
          </button>
        )}
        <div className="relative flex flex-wrap items-end justify-between gap-5">
          <div>
            <motion.p
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.05, duration: 0.3 }}
              className="study-kicker"
            >
              {selectedYear === "All" ? "MBChB study library" : selectedYear}
            </motion.p>
            <motion.h1
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1, duration: 0.3 }}
              className="mt-1 font-serif text-3xl font-bold leading-tight text-foreground sm:text-[2.35rem]"
            >
              Study Notes
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15, duration: 0.3 }}
              className="mt-1.5 max-w-xl text-sm text-muted-foreground"
            >
              High-yield notes, CATs and past papers, organised by year, semester and unit.
            </motion.p>
          </div>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.3 }}
            className="flex shrink-0 gap-5 border-l border-border pl-5 text-right"
          >
            <div>
              <p className="font-serif text-xl font-bold text-foreground">{selectedYear === "All" ? catalogueStats.notes : filtered.length}</p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{selectedYear === "All" ? "notes" : "in view"}</p>
            </div>
            {selectedYear === "All" && <div>
              <p className="font-serif text-xl font-bold text-foreground">{catalogueStats.units}</p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">units</p>
            </div>}
          </motion.div>
        </div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.3 }}
          className={`relative mt-5 flex max-w-2xl items-center overflow-hidden border bg-background shadow-sm transition-all duration-300 ${searchFocused ? "border-primary ring-2 ring-primary/15 shadow-md" : "border-border"}`}
        >
          <Search className="ml-3 h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            id="note-search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            placeholder="Search notes by title or content…"
            className="w-full bg-transparent px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          {search && (
            <button onClick={() => setSearch("")} className="mr-3 text-muted-foreground hover:text-foreground transition-colors" aria-label="Clear search">
              <X className="h-4 w-4" />
            </button>
          )}
        </motion.div>
        {search.trim() && (
          <p className="mt-2 text-xs text-muted-foreground">
            {searchLoading ? "Searching…" : filtered.length === 0 ? `No results for "${search}"` : `${filtered.length} matching articles`}
          </p>
        )}
        {!search.trim() && <p className="mt-2 text-xs text-muted-foreground">Press <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-sans text-[10px]">/</kbd> to search the library.</p>}
        </div>
      </motion.div>

      {showYearPicker ? (
        /* Year picker with enhanced cards */
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.15 }}
        >
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Start here</p>
            <h2 className="mt-0.5 font-serif text-xl font-bold text-foreground">Choose your year</h2>
          </div>
          <span className="hidden text-xs text-muted-foreground sm:block">Select a year to explore its units</span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {["Year 1", "Year 2", "Year 3", "Year 4", "Year 5", "Year 6"].map(y => {
            const theme = YEAR_THEMES[y];
            return (
              <motion.button
                key={y}
                variants={itemVariants}
                whileHover={cardHover}
                whileTap={{ scale: 0.98 }}
                onClick={() => setYear(y)}
                className="group relative overflow-hidden border border-border bg-card text-left transition-all duration-300 hover:border-primary/50 hover:shadow-[var(--shadow-card-hover)]"
              >
                {/* Gradient overlay */}
                <div className={`absolute inset-0 bg-gradient-to-br ${theme.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
                <div className="relative p-5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-3xl">{theme.icon}</span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground transition-all duration-300 group-hover:translate-x-0.5 group-hover:text-primary group-hover:opacity-0" />
                  </div>
                  <span className="mt-3 block font-serif text-xl font-bold text-foreground sm:text-2xl group-hover:text-foreground">{y}</span>
                  <p className="mt-1 text-xs text-muted-foreground group-hover:text-foreground/80">{yearTotals[y] ?? 0} notes ready to review</p>
                  {/* Subtle shimmer effect on hover */}
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>
        </motion.div>
      ) : (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.25 }}
      >
      {/* Continue reading */}
      {!search.trim() && selectedYear !== "All" && !selectedUnit && filteredRecentArticles.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mb-7 border-y border-border bg-card p-4 shadow-sm"
        >
          <div className="mb-3 flex items-center gap-2">
            <Clock className="h-3.5 w-3.5 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Continue Reading</h2>
          </div>
          <div className="space-y-1">
            {filteredRecentArticles.slice(0, 3).map((ra, i) => (
              <motion.div
                key={ra.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1, duration: 0.3 }}
              >
                <Link
                  to={buildBlogPath(ra)}
                  state={{ from: fromPath }}
                  className="group flex items-center gap-3 rounded-lg px-2 py-2 transition-all duration-200 hover:bg-muted/40"
                >
                  <BookOpen className="h-3.5 w-3.5 shrink-0 text-primary" />
                  <span className="truncate text-sm font-medium text-foreground transition-colors group-hover:text-primary">{ra.title}</span>
                  <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">{timeAgo(ra.visitedAt)}</span>
                </Link>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Year tabs */}
      <div ref={resultsAnchorRef} className="mb-5 flex gap-1 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0" style={{ scrollbarWidth: "none" }}>
        {YEARS.map((year, i) => (
          <motion.button
            key={year}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, duration: 0.3 }}
            onClick={() => setYear(year)}
            className={`shrink-0 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-all duration-200 ${
              selectedYear === year
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {year}
          </motion.button>
        ))}
      </div>

      {/* Semester step — Year 3 only */}
      {selectedYear === "Year 3" && !search.trim() && !selectedSemester && !selectedUnit && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mb-6"
        >
          <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Step 2 — Choose a semester</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {YEAR3_SEMESTER_OPTIONS.map((opt, i) => (
              <motion.button
                key={opt.value}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ delay: i * 0.1, duration: 0.3 }}
                whileHover={cardHover}
                whileTap={{ scale: 0.98 }}
                onClick={() => setSemester(opt.value)}
                className="border-y border-border bg-card p-5 text-left transition-all duration-300 hover:border-primary/40 hover:shadow-[var(--shadow-card-hover)]"
              >
                <span className="font-serif text-lg font-bold text-foreground sm:text-xl">{opt.label}</span>
                <p className="mt-1 text-xs text-muted-foreground">{year3SemesterCounts[opt.value] ?? 0} notes</p>
              </motion.button>
            ))}
          </div>
          <button
            onClick={() => setSemester(null)}
            className="mt-3 text-xs font-medium text-muted-foreground hover:text-foreground hover:underline"
          >
            Or browse all of Year 3 mixed together →
          </button>
        </motion.div>
      )}

      {/* Compact semester switcher */}
      {selectedYear === "Year 3" && !search.trim() && (selectedSemester || selectedUnit) && (
        <div className="mb-4">
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Semester</p>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setSemester(null)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-200 ${
                !selectedSemester
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              All Semesters
            </button>
            {YEAR3_SEMESTER_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setSemester(selectedSemester === opt.value ? null : opt.value)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-200 ${
                  selectedSemester === opt.value
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {opt.label} ({year3SemesterCounts[opt.value] ?? 0})
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Breadcrumb */}
      {selectedYear === "Year 3" && (selectedSemester || selectedUnit) && !search.trim() && (
        <div className="mb-4 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
          <button onClick={() => setSemester(null)} className="hover:text-foreground hover:underline">Year 3</button>
          {selectedSemester && (
            <>
              <span>›</span>
              <button
                onClick={() => setUnit(null)}
                className={selectedUnit ? "hover:text-foreground hover:underline" : "font-semibold text-foreground"}
              >
                {YEAR3_SEMESTER_OPTIONS.find(o => o.value === selectedSemester)?.label ?? selectedSemester}
              </button>
            </>
          )}
          {selectedUnit && (
            <>
              <span>›</span>
              <span className="font-semibold text-foreground">{getCategoryDisplayName(selectedUnit)}</span>
            </>
          )}
        </div>
      )}

      {/* Units */}
      {selectedYear !== "All" && unitsForSelection.length > 0 && (selectedYear !== "Year 3" || selectedSemester || selectedUnit) && (
        selectedUnit ? (
          <div className="mb-6 flex flex-wrap gap-1.5">
            <button
              onClick={() => setUnit(null)}
              className="border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-all duration-200 hover:bg-muted hover:text-foreground"
            >
              ← All units
            </button>
            {unitsForSelection.map(u => {
              const active = selectedUnit === u.category;
              return (
                <button
                  key={u.category}
                  onClick={() => setUnit(active ? null : u.category)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-200 ${
                    active
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {u.name} ({u.count})
                </button>
              );
            })}
          </div>
        ) : (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.1 }}
            className="mb-8"
          >
            <p className="mb-2.5 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              Choose a unit · {unitsForSelection.length} available
            </p>
            <div className="grid auto-rows-fr grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {unitsForSelection.map(u => (
                <motion.div key={u.category} variants={itemVariants} className="min-w-0 h-full">
                  <UnitTile title={u.name} count={u.count} onClick={() => setUnit(u.category)} />
                </motion.div>
              ))}
            </div>
          </motion.div>
        )
      )}

      {/* View switcher */}
      {filtered.length > 0 && (
        <div className="mb-3 flex flex-col gap-2 border-b border-border pb-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            {filtered.length} {filtered.length === 1 ? "note" : "notes"}
          </p>
          <div className="flex flex-wrap items-center gap-1 border border-border p-0.5">
            <select
              value={kindFilter}
              onChange={(e) => setKindFilter(e.target.value as any)}
              aria-label="Filter by content type"
              className="mr-1 rounded-md bg-transparent px-2 py-1 text-xs font-semibold text-muted-foreground focus:outline-none"
            >
              <option value="all">All types</option>
              <option value="essay">Essays</option>
              <option value="notes">Notes</option>
            </select>
            <select
              value={sortBy}
              onChange={(e) => setSort(e.target.value as any)}
              aria-label="Sort notes"
              className="mr-1 rounded-md bg-transparent px-2 py-1 text-xs font-semibold text-muted-foreground focus:outline-none"
            >
              <option value="updated">Last updated</option>
              <option value="read">Last read</option>
              <option value="az">A–Z</option>
            </select>
            <button
              onClick={() => setViewMode("list")}
              aria-label="List view"
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-all duration-200 ${view === "list" ? "bg-muted text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              <List className="h-3.5 w-3.5" /> List
            </button>
            <button
              onClick={() => setViewMode("grid")}
              aria-label="Grid view"
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-all duration-200 ${view === "grid" ? "bg-muted text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              <LayoutGrid className="h-3.5 w-3.5" /> Grid
            </button>
          </div>
        </div>
      )}

      {/* Articles */}
      {filtered.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="py-16 text-center"
        >
          <SlidersHorizontal className="mx-auto mb-3 h-5 w-5 text-muted-foreground" />
          <p className="font-medium text-foreground">No notes found</p>
          <p className="mt-1 text-sm text-muted-foreground">Try a different search or clear your filters.</p>
          {(search || selectedUnit || kindFilter !== "all") && (
            <button
              onClick={() => { setSearch(""); setUnit(null); setKindFilter("all"); }}
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition-all duration-200 hover:opacity-90 hover:bg-muted/40"
            >
              Reset filters <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
        </motion.div>
      ) : groupedArticles && !search.trim() ? (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.02, margin: "0px 0px -60px 0px" }}
          className="space-y-9"
        >
          {groupedArticles.map(group => {
            const isExpanded = expandedGroups.has(group.category);
            const showCount = isExpanded ? group.articles.length : INITIAL_PER_GROUP;
            const hasMore = group.articles.length > INITIAL_PER_GROUP;
            return (
              <motion.div key={group.category} variants={itemVariants}>
                <div className="mb-3 flex items-baseline gap-3">
                  <h2 className="font-serif text-lg font-bold text-foreground sm:text-xl">{group.name}</h2>
                  <span className="shrink-0 text-xs text-muted-foreground">{group.articles.length}</span>
                  <div className="h-px flex-1 bg-border" />
                </div>
                {view === "grid" ? (
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
                    {group.articles.slice(0, showCount).map(a => (
                      <NoteCard key={a.id} article={a} />
                    ))}
                  </div>
                ) : (
                  <div className="overflow-hidden border border-border bg-card shadow-sm">
                    {group.articles.slice(0, showCount).map((a, i) => (
                      <NoteRow key={a.id} article={a} index={i} />
                    ))}
                  </div>
                )}
                {hasMore && (
                  <button
                    onClick={() => toggleGroup(group.category)}
                    className="mt-2.5 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
                  >
                    {isExpanded ? (
                      <>Show less</>
                    ) : (
                      <>
                        Show all {group.articles.length} in {group.name}
                        <ChevronDown className="h-3.5 w-3.5" />
                      </>
                    )}
                  </button>
                )}
              </motion.div>
            );
          })}
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
        {view === "grid" ? (
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.slice(0, visibleCount).map(a => (
              <NoteCard key={a.id} article={a} />
            ))}
          </div>
        ) : (
          <div className="overflow-hidden border border-border bg-card shadow-sm">
            {filtered.slice(0, visibleCount).map((a, i) => (
              <NoteRow key={a.id} article={a} index={i} />
            ))}
          </div>
        )}
        {filtered.length > visibleCount && (
            <button
              onClick={() => setVisibleCount(prev => prev + LOAD_MORE_STEP)}
              className="mx-auto mt-4 flex items-center gap-2 border border-border bg-card px-6 py-2.5 text-sm font-semibold text-foreground transition-all duration-200 hover:bg-muted hover:shadow-sm"
            >
              Load more ({filtered.length - visibleCount} remaining)
              <ChevronDown className="h-4 w-4" />
            </button>
          )}
        </motion.div>
      )}
      </motion.div>
      )}
        </div>
      </div>
    </div>
  );
}
