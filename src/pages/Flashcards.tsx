import { useState, useEffect, useMemo, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { GraduationCap, Calendar, Layers, ChevronDown, RotateCcw } from "lucide-react";
import { getPublishedFlashcardSetSummaries, getCategoryDisplayName, getYearFromCategory, buildFlashcardPath, type FlashcardSet } from "@/lib/store";
import { getVisitedFlashcardIds } from "@/lib/progress-store";
import { updateMetaTags } from "@/lib/seo";
import CategoryTabs from "@/components/CategoryTabs";

const INITIAL_VISIBLE = 12;
const LOAD_MORE_STEP = 12;

export default function Flashcards() {
  useEffect(() => {
    updateMetaTags({
      title: "Flashcard Sets",
      description: "Interactive medical flashcards generated from Kenyan medical notes. Study smarter with unit-based flashcard sets.",
    });
  }, []);
  const [sets, setSets] = useState<FlashcardSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [visitedIds, setVisitedIds] = useState<Set<string>>(new Set());
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);
  const [searchParams] = useSearchParams();
  const selectedYear = searchParams.get("year") || "All";

  useEffect(() => {
    getPublishedFlashcardSetSummaries().then(setSets as any).finally(() => setLoading(false));
    setVisitedIds(getVisitedFlashcardIds());
  }, []);

  useEffect(() => {
    setSelectedCategory(null);
    setVisibleCount(INITIAL_VISIBLE);
  }, [selectedYear]);

  // Scroll results into view when the category filter changes, instead of
  // leaving the user wherever they were scrolled with a different grid underneath.
  const resultsAnchorRef = useRef<HTMLDivElement>(null);
  const isFirstFilterRender = useRef(true);
  useEffect(() => {
    if (isFirstFilterRender.current) {
      isFirstFilterRender.current = false;
      return;
    }
    const id = window.setTimeout(() => {
      resultsAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
    return () => window.clearTimeout(id);
  }, [selectedCategory]);

  const yearScopedSets = useMemo(() => {
    if (selectedYear === "All") return sets;
    return sets.filter((s) => getYearFromCategory(s.category) === selectedYear);
  }, [sets, selectedYear]);

  const categories = useMemo(
    () => [...new Set(yearScopedSets.map((s) => s.category).filter((c) => c && c !== "Uncategorized"))],
    [yearScopedSets],
  );

  const categoryCounts = useMemo(
    () => Object.fromEntries(categories.map((c) => [c, yearScopedSets.filter((s) => s.category === c).length])),
    [categories, yearScopedSets],
  );

  const filtered = selectedCategory ? yearScopedSets.filter((s) => s.category === selectedCategory) : yearScopedSets;

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-5 py-10 sm:px-6 sm:py-12">
        <div className="mb-7 border-b border-border pb-6">
          <div className="h-9 w-36 animate-pulse rounded-lg bg-muted" />
          <div className="mt-2 h-4 w-60 animate-pulse rounded bg-muted" />
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="border border-border bg-card p-6 space-y-3">
              <div className="h-10 w-10 animate-pulse rounded-lg bg-muted" />
              <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-5 py-10 sm:px-6 sm:py-12">
      <div className="mb-7">
        <p className="study-kicker">Practice · Rapid recall</p>\n        <h1 className="mt-1 mb-1 font-serif text-3xl font-bold text-foreground sm:text-4xl">Flashcards</h1>
        <p className="text-sm text-muted-foreground sm:text-base">
          {selectedYear === "All" ? "Interactive study sets generated from notes" : `${selectedYear} flashcard sets`}
        </p>
      </div>

      <div ref={resultsAnchorRef}>
        <CategoryTabs
          categories={categories}
          counts={categoryCounts}
          totalCount={yearScopedSets.length}
          selected={selectedCategory}
          onChange={(c) => { setSelectedCategory(c); setVisibleCount(INITIAL_VISIBLE); }}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="border border-border bg-card p-12 text-center">
          <GraduationCap className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
          <p className="text-muted-foreground">No flashcard sets found for this selection.</p>
        </div>
      ) : (
        <>
          <div className="divide-y divide-border border-y border-border">
            {filtered.slice(0, visibleCount).map((s) => (
              <div key={s.id}>
                <Link
                  to={buildFlashcardPath(s)}
                  className="study-resource-row group relative block h-full border-0 p-4 sm:p-5"
                  style={{ boxShadow: "var(--shadow-card)" }}
                >
                  {visitedIds.has(s.id) && (
                    <div className="absolute right-3 top-3">
                      <span className="inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                        <RotateCcw className="h-2.5 w-2.5" />
                        Continue
                      </span>
                    </div>
                  )}
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center border border-primary/15 bg-primary/5 text-primary">
                    <Layers className="h-4 w-4 sm:h-5 sm:w-5" />
                  </div>
                  {s.category && s.category !== "Uncategorized" && (
                    <span className="mb-2 inline-block rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                      {getCategoryDisplayName(s.category)}
                    </span>
                  )}
                  <h3 className="mb-2 line-clamp-2 font-serif text-sm font-bold text-foreground transition-colors group-hover:text-primary sm:text-base">
                    {s.title}
                  </h3>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Layers className="h-3 w-3" /> Interactive set</span>
                    <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{new Date(s.created_at).toLocaleDateString()}</span>
                  </div>
                </Link>
              </div>
            ))}
          </div>
          {filtered.length > visibleCount && (
            <button
              onClick={() => setVisibleCount(prev => prev + LOAD_MORE_STEP)}
              className="mx-auto mt-6 flex items-center gap-2 border border-border bg-card px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
            >
              Load more ({filtered.length - visibleCount} remaining)
              <ChevronDown className="h-4 w-4" />
            </button>
          )}
        </>
      )}
    </div>
  );
}
