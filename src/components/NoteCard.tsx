import { Link, useLocation } from "react-router-dom";
import type { Article } from "@/lib/store";
import { buildBlogPath, getCategoryTrail } from "@/lib/store";

/**
 * Compact grid card for the "grid" view of the notes library. Text-first and
 * colour-free — the aim is scannability, not decoration.
 */
/** Strip markdown/HTML entity noise from list titles (e.g. "CAT 1&amp;2"). */
function cleanTitle(t: string): string {
  return (t || "")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&(?:#39|apos|rsquo|lsquo);/g, "\u2019")
    .replace(/&(?:quot|ldquo|rdquo);/g, '"')
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/^#+\s*/, "")
    .replace(/\*\*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export default function NoteCard({ article }: { article: Article }) {
  const location = useLocation();
  const trail = getCategoryTrail(article.category, article.title, article.content_kind || "");
  const kind = trail[trail.length - 1];
  const date = new Date(article.updated_at || article.created_at).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const preview = (article.meta_description || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 130);

  return (
    <Link
      to={buildBlogPath(article)}
      state={{ from: `${location.pathname}${location.search}` }}
      className="group flex h-full flex-col border border-border bg-card p-4 transition-colors hover:border-primary/50 hover:bg-muted/30"
    >
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
        {trail.slice(0, -1).map((part, i) => (
          <span key={`${part}-${i}`} className="flex items-center gap-1.5">
            {i > 0 && <span className="text-muted-foreground/40">·</span>}
            <span className="truncate">{part}</span>
          </span>
        ))}
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[9.5px] font-bold tracking-wide text-primary">
          {kind}
        </span>
      </div>
      <h3 className="mt-1.5 line-clamp-3 font-serif text-[16px] font-bold leading-snug text-foreground transition-colors group-hover:text-primary">
        {cleanTitle(article.title)}
      </h3>
      {preview && (
        <p className="mt-2 line-clamp-2 text-[12.5px] leading-relaxed text-muted-foreground">{preview}…</p>
      )}
      <p className="mt-auto pt-3 text-[11px] text-muted-foreground/80">
        {date}
      </p>
    </Link>
  );
}
