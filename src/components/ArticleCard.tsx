import { Link, useLocation } from "react-router-dom";
import { ArrowRight, Clock3 } from "lucide-react";
import type { Article } from "@/lib/store";
import { buildBlogPath, getCategoryDisplayName, getContentKind, getYearFromCategory } from "@/lib/store";
import { isGenericThumbnail, useTopicThumbnailInfo } from "@/lib/topicThumbnail";
import anatomyThumb from "@/assets/thumb-anatomy.jpg";
import physiologyThumb from "@/assets/thumb-physiology.jpg";
import pharmacologyThumb from "@/assets/thumb-pharmacology.jpg";
import pathologyThumb from "@/assets/thumb-pathology.jpg";

function getCategoryFallback(text: string): string {
  if (text.includes("anatom") || text.includes("histology") || text.includes("embryology")) return anatomyThumb;
  if (text.includes("physiology") || text.includes("cardio") || text.includes("respirat")) return physiologyThumb;
  if (text.includes("pharmac") || text.includes("drug") || text.includes("oncopath") || text.includes("chemotherapy")) return pharmacologyThumb;
  if (text.includes("biochem") || text.includes("genetic") || text.includes("metabolism") || text.includes("molecular")) return anatomyThumb;
  return pathologyThumb;
}

function getArticleStaticThumb(article: Article): string | null {
  const og = (article.og_image_url || "").trim();
  if (og && !isGenericThumbnail(og) && og.length < 2000) return og;
  const contentImage = (article.content || "").match(/!\[[^\]]*\]\((.*?)\)/)?.[1]?.trim();
  if (contentImage && !isGenericThumbnail(contentImage)) return contentImage;
  return null;
}

export default function ArticleCard({ article }: { article: Article }) {
  const preview = (article.meta_description || article.content || "")
    .replace(/!\[[^\]]*\]\((.*?)\)/g, "")
    .replace(/^#+\s.+$/gm, "")
    .replace(/[#*_`|>-]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);

  const unit = getCategoryDisplayName(article.category);
  const year = getYearFromCategory(article.category);
  // Legacy uploaded thumbnails were frequently unrelated to their medical
  // topic. Cards now use a licensed, topic-matched Commons result instead.
  const staticCover = null;
  // Prefer the clean subunit name (e.g. "Bone and Soft Tissue Pathology") as the
  // Wikipedia lookup key — far more reliable than parsing noisy exam-question titles,
  // and it means every subunit gets one consistent, correct, non-generic thumbnail.
  const topicImage = useTopicThumbnailInfo(article.title, article.category, !staticCover);
  const cover = staticCover || topicImage?.url || getCategoryFallback(`${article.category} ${article.title}`.toLowerCase());
  const displayDate = new Date(article.updated_at || article.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const location = useLocation();
  const fromPath = `${location.pathname}${location.search}`;
  const contentKind = getContentKind(article.title, article.category, article.content_kind || "");

  return (
    <Link
      to={buildBlogPath(article)}
      state={{ from: fromPath }}
      className="group block overflow-hidden border border-border bg-card transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[var(--shadow-card-hover)] sm:border-y"
    >
      {/* Mobile: compact row layout. Desktop: side-by-side */}
      <article className="flex gap-3 p-3 sm:grid sm:min-h-[180px] sm:gap-0 sm:p-0 md:grid-cols-[200px_1fr]">
        {/* Thumbnail */}
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-muted sm:h-full sm:w-full sm:rounded-none sm:border-b sm:border-border md:border-b-0 md:border-r">
          <img
            src={cover}
            alt={`${unit || "Medical"} study illustration`}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03] sm:h-48 md:h-full"
          />
          {contentKind !== "Notes" && (
            <span className="absolute left-1.5 top-1.5 rounded bg-black/75 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
              {contentKind}
            </span>
          )}
          {!staticCover && topicImage?.pageUrl && (
            <span className="absolute bottom-1 right-1 rounded bg-black/65 px-1 text-[8px] text-white/90" title={`${topicImage.credit} · ${topicImage.license}`}>Commons</span>
          )}
        </div>

        {/* Content */}
        <div className="flex min-w-0 flex-1 flex-col justify-center sm:p-5 md:p-6">
          <div className="mb-1 flex flex-wrap items-center gap-1.5 text-[10px] font-medium text-muted-foreground sm:mb-3 sm:gap-2 sm:text-xs">
            {year && <span className="rounded-full border border-border bg-muted px-1.5 py-0.5 sm:px-2.5 sm:py-1">{year}</span>}
            {unit && unit !== "Uncategorized" && <span className="hidden rounded-full border border-border bg-muted px-2.5 py-1 sm:inline">{unit}</span>}
            <span className="inline-flex items-center gap-1"><Clock3 className="h-3 w-3" /> {displayDate}</span>
          </div>

          <h3 className="line-clamp-2 text-sm font-bold leading-tight text-foreground transition-colors group-hover:text-primary sm:font-serif sm:text-xl md:text-2xl md:leading-tight">
            {article.title}
          </h3>

          {preview && (
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-foreground/70 sm:mt-3 sm:line-clamp-3 sm:text-sm sm:leading-7">
              {preview}…
            </p>
          )}

          <span className="mt-2 hidden items-center gap-1 text-sm font-semibold text-primary sm:inline-flex">
            Read article <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      </article>
    </Link>
  );
}
