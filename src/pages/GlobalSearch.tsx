import { FormEvent, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { BookOpen, Search } from "lucide-react";
import { groupHits, logSearch, SEARCH_GROUPS } from "@/lib/search";
import { useLiveSearch } from "@/hooks/useLiveSearch";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { CONTENT_TYPES } from "@/lib/academic";
import { Skeleton } from "@/components/ui/skeleton";

const YEARS = [1, 2, 3, 4, 5, 6];

export default function GlobalSearch() {
  const { isOffline } = useNetworkStatus();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get("q") || "");
  const [year, setYear] = useState(params.get("year") || "");
  const [contentType, setContentType] = useState(params.get("type") || "");

  const filters = { year: year || undefined, contentType: contentType || undefined };
  const { hits, related, loading, searched } = useLiveSearch(q, filters);

  // Keep the URL in sync (without spamming browser history) so a search is
  // shareable/bookmarkable, but don't drive the search itself off it.
  useEffect(() => {
    const trimmed = q.trim();
    const next: Record<string, string> = {};
    if (trimmed) next.q = trimmed;
    if (year) next.year = year;
    if (contentType) next.type = contentType;
    setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, year, contentType]);

  const onSubmit = (e?: FormEvent) => {
    e?.preventDefault();
  };

  const grouped = groupHits(hits);
  const hasFilters = year || contentType;

  return (
    <main className="mx-auto max-w-5xl px-5 py-8 sm:py-12">
      <Helmet>
        <title>Search Medical Study Resources | OmpathStudy</title>
        <meta name="robots" content="noindex,follow" />
      </Helmet>

      <nav aria-label="Breadcrumb" className="mb-5 flex items-center gap-1.5 overflow-x-auto text-xs text-muted-foreground">
        <Link to="/" className="hover:text-primary">Home</Link> ›{" "}
        <span className="text-foreground">Search</span>
      </nav>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><p className="study-kicker">Study library</p><h1 className="font-serif text-3xl font-bold text-foreground">Search the study library</h1></div>
        {isOffline && (
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
            ⚡ Instant Offline Search (551 Notes &amp; 197 MCQs)
          </span>
        )}
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Search notes, units, course codes, CATs, past papers, MCQs and flashcards.
      </p>

      <form onSubmit={onSubmit} className="mt-6 space-y-3">
        <div className="flex overflow-hidden border border-border bg-card shadow-sm">
          <label htmlFor="global-search-input" className="sr-only">Search the study library</label>
          <Search className="ml-4 mt-3.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <input
            id="global-search-input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="min-w-0 flex-1 bg-transparent px-3 py-3 text-sm outline-none sm:text-base"
            placeholder="Try TB, AGN, virology or MBMM3333"
          />
          <button
            type="submit"
            aria-label="Search"
            className="flex min-h-[44px] shrink-0 items-center gap-1.5 bg-primary px-5 text-sm font-bold text-primary-foreground"
          >
            {loading ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground" /> : "Search"}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="global-search-year" className="sr-only">Filter by year</label>
          <select
            id="global-search-year"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="min-h-[40px] border border-border bg-card px-3 text-sm text-foreground"
          >
            <option value="">All years</option>
            {YEARS.map((y) => <option key={y} value={String(y)}>Year {y}</option>)}
          </select>

          <label htmlFor="global-search-type" className="sr-only">Filter by content type</label>
          <select
            id="global-search-type"
            value={contentType}
            onChange={(e) => setContentType(e.target.value)}
            className="min-h-[40px] border border-border bg-card px-3 text-sm text-foreground"
          >
            <option value="">All content types</option>
            {CONTENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>

          {hasFilters && (
            <button
              type="button"
              onClick={() => { setYear(""); setContentType(""); }}
              className="min-h-[40px] rounded-md px-2 text-xs font-semibold text-muted-foreground hover:text-primary"
            >
              Clear filters
            </button>
          )}
        </div>
      </form>

      {related.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="text-xs text-muted-foreground">Related terms:</span>
          {related.map((x) => (
            <button
              key={x}
              type="button"
              onClick={() => setQ(x)}
              className="rounded-full bg-muted px-3 py-1 text-xs transition-colors hover:bg-primary/10 hover:text-primary"
            >
              {x}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="mt-8 space-y-8">
          {[1, 2].map((g) => (
            <div key={g}>
              <Skeleton className="mb-3 h-6 w-40" />
              <div className="grid gap-2 sm:grid-cols-2">
                <Skeleton className="h-20 rounded-md" />
                <Skeleton className="h-20 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      ) : searched && hits.length === 0 ? (
        <div className="mt-10 border border-dashed border-border p-8 text-center">
          <p className="text-muted-foreground">No results for "{q}"{hasFilters ? " with the current filters" : ""}.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Try a broader medical term, a course code, or{" "}
            {hasFilters ? (
              <button type="button" onClick={() => { setYear(""); setContentType(""); }} className="font-semibold text-primary hover:underline">
                clear your filters
              </button>
            ) : (
              "check the spelling"
            )}
            .
          </p>
        </div>
      ) : searched ? (
        <div className="mt-8 space-y-8">
          {SEARCH_GROUPS.map((group) => {
            const rows = grouped[group] || [];
            if (!rows.length) return null;
            return (
              <section key={group}>
                <div className="study-section-heading mb-3"><h2 className="font-serif text-xl font-bold text-foreground">{group}</h2><span className="study-type-badge">{group}</span></div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {rows.map((h) => (
                    <Link
                      key={`${h.kind}-${h.id}`}
                      to={h.href}
                      onClick={() => void logSearch(q, hits.length, { type: h.kind, id: h.id })}
                      className="study-resource-row rounded-none border-x-0 p-4"
                    >
                      <div className="flex gap-3">
                        <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                        <span className="min-w-0">
                          <strong className="line-clamp-2 block text-sm text-foreground">{h.title}</strong>
                          <span className="mt-1 block text-xs text-muted-foreground">{h.category || h.kind} · {h.reason}</span>
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <div className="mt-10 border border-dashed border-border p-8 text-center text-muted-foreground">
          Search across every unit, note, CAT, past paper, MCQ bank and flashcard deck at once.
        </div>
      )}
    </main>
  );
}
