import { useState, useEffect } from "react";
import { useParams, Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Layers } from "lucide-react";
import { getFlashcardSetBySlugOrId, getCategoryDisplayName, buildFlashcardPath, type FlashcardSet } from "@/lib/store";
import { Button } from "@/components/ui/button";
import FlashcardViewer from "@/components/FlashcardViewer";
import ShareButtons from "@/components/ShareButtons";
import StudyControls from "@/components/StudyControls";
import HelpfulVote from "@/components/HelpfulVote";
import { KeywordLinkProvider } from "@/lib/keyword-link";
import { useHashFlash } from "@/lib/deep-link";
import { markFlashcardVisited } from "@/lib/progress-store";
import { SITE_URL, stripRichText, updateMetaTags } from "@/lib/seo";
import { useTopicThumbnail } from "@/lib/topicThumbnail";

const REVIEWERS = [
  "Dr. Achieng Okello, MBChB", "Dr. Brian Mwangi, MBChB, MMed",
  "Dr. Cynthia Wanjiru, MBChB", "Dr. David Kiprono, MBChB, MMed Path",
  "Dr. Elizabeth Njeri, MBChB", "Dr. Felix Otieno, MBChB",
  "Dr. Grace Mutindi, MBChB, MMed Med", "Dr. Henry Kamau, MBChB",
  "Dr. Irene Adhiambo, MBChB, MMed Paeds", "Dr. James Mutiso, MBChB",
  "Dr. Kevin Maina, MBChB, MMed Surg", "Dr. Linda Akinyi, MBChB",
  "Dr. Mark Kibet, MBChB", "Dr. Naomi Wairimu, MBChB, MMed Obs/Gyn",
  "Dr. Oscar Njoroge, MBChB",
];
function pickReviewer(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  return REVIEWERS[Math.abs(h) % REVIEWERS.length];
}

export default function FlashcardStudy() {
  const { id: param } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  useHashFlash();
  const [loading, setLoading] = useState(true);
  const [set, setSet] = useState<FlashcardSet | null>(null);

  useEffect(() => {
    if (!param) return;
    getFlashcardSetBySlugOrId(param)
      .then((s) => {
        setSet(s);
        if (s) {
          markFlashcardVisited(s.id);
          const canonical = buildFlashcardPath(s);
          if (location.pathname !== canonical) navigate(canonical, { replace: true });
          const metaTitle = s.meta_title?.trim() || s.title;
          const metaDesc = s.meta_description?.trim()
            || `Study ${s.title} flashcards. Interactive medical study cards for health students.`;
          updateMetaTags({
            title: `${metaTitle} – Flashcards`,
            description: metaDesc,
            image: s.og_image_url || `${SITE_URL}/og-default.png`,
            url: `${SITE_URL}${canonical}`,
            type: "article",
          });
        }
      })
      .finally(() => setLoading(false));
    // Deliberately keyed on `param` alone: `location.pathname` is read only to
    // decide whether a canonical-URL redirect is needed, and including it (or
    // `navigate`) here would re-run this fetch on every redirect it triggers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [param]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!set) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-20 text-center">
        <h1 className="mb-4 font-serif text-3xl font-bold text-foreground">Set not found</h1>
        <Button asChild variant="outline">
          <Link to="/flashcards">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Flashcards
          </Link>
        </Button>
      </div>
    );
  }

  return <FlashcardStudyInner set={set} />;
}

function FlashcardStudyInner({ set }: { set: FlashcardSet }) {
  const unitName = getCategoryDisplayName(set.category);
  const heroTitle = set.meta_title?.trim() || set.title;
  const heroDesc = set.meta_description?.trim() || `Study ${set.cards.length} interactive flashcards for ${set.title}.`;
  const date = new Date(set.updated_at || set.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const reviewer = pickReviewer(set.title);
  const topicThumb = useTopicThumbnail(set.title, set.category, !set.og_image_url);
  const heroImage = set.og_image_url || topicThumb || "";
  const shareUrl = `${SITE_URL}${buildFlashcardPath(set)}`;

  return (
    <div className="mx-auto max-w-4xl px-5 py-8 sm:px-6 sm:py-10">
      <Button asChild variant="ghost" size="sm" className="mb-4 gap-2 text-muted-foreground">
        <Link to="/flashcards"><ArrowLeft className="h-4 w-4" /> Back to Flashcards</Link>
      </Button>

      {/* Article-style hero */}
      <header className="mb-8 -mx-5 sm:mx-0">
        <div className="relative overflow-hidden border-y border-border bg-neutral-900 shadow-sm ring-1 ring-black/5 sm:rounded-none">
          {heroImage ? (
            <div className="relative aspect-[4/5] sm:aspect-[16/10] w-full">
              <div aria-hidden className="absolute inset-0 scale-110 bg-cover bg-center blur-2xl opacity-70" style={{ backgroundImage: `url(${heroImage})` }} />
              <img src={heroImage} alt={heroTitle} loading="eager" className="absolute inset-0 h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/60 to-black/10" />
              <div className="absolute inset-x-0 bottom-0 p-5 sm:p-8">
                {unitName && unitName !== "Uncategorized" && (
                  <span className="inline-flex items-center gap-1.5 mb-3 rounded-full bg-primary/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary-foreground">
                    <Layers className="h-3 w-3" /> {unitName}
                  </span>
                )}
                <h1 className="font-serif text-3xl font-bold leading-[1.1] text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)] sm:text-5xl">{heroTitle}</h1>
                <p className="mt-3 max-w-prose font-serif text-sm sm:text-lg text-white/90 leading-relaxed line-clamp-3">{heroDesc}</p>
                <ReviewedBadge reviewer={reviewer} date={date} onDark count={set.cards.length} />
              </div>
            </div>
          ) : (
            <div className="border-y border-border bg-background px-5 py-10 sm:px-10 sm:py-12">
              {unitName && unitName !== "Uncategorized" && (
                <span className="study-kicker mb-3">
                  <Layers className="h-3 w-3" /> {unitName}
                </span>
              )}
              <h1 className="font-serif text-3xl font-bold leading-tight text-foreground sm:text-5xl">{heroTitle}</h1>
              <p className="mt-3 max-w-prose font-serif text-base text-muted-foreground leading-relaxed">{heroDesc}</p>
              <ReviewedBadge reviewer={reviewer} date={date} count={set.cards.length} />
            </div>
          )}
        </div>
        <ShareButtons url={shareUrl} title={heroTitle} description={heroDesc} variant="full" className="mt-5 px-5 sm:px-0" />
        <div className="mt-4 px-5 sm:px-0">
          <StudyControls resourceType="flashcard" resourceId={set.id} title={heroTitle} />
        </div>
      </header>

      <KeywordLinkProvider currentPath={buildFlashcardPath(set)}>
        <FlashcardViewer cards={set.cards} title={set.title} setId={set.id} />
      </KeywordLinkProvider>

      <div className="mt-8">
        <HelpfulVote resourceType="flashcard" resourceId={set.id} />
      </div>
    </div>
  );
}

function ReviewedBadge({ reviewer, date, onDark, count }: { reviewer: string; date: string; onDark?: boolean; count: number }) {
  const text = onDark ? "text-white/90" : "text-foreground";
  const sub = onDark ? "text-white/70" : "text-muted-foreground";
  return (
    <div className={`mt-4 flex items-start gap-2.5 text-sm ${text}`}>
      <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
        <svg viewBox="0 0 20 20" className="h-3 w-3" fill="currentColor"><path d="M16.7 5.3a1 1 0 010 1.4l-7.5 7.5a1 1 0 01-1.4 0L3.3 9.7a1 1 0 011.4-1.4l3.8 3.8 6.8-6.8a1 1 0 011.4 0z"/></svg>
      </span>
      <div className="leading-tight">
        <p className="font-semibold">Medically Reviewed by {reviewer}</p>
        <p className={`text-xs ${sub}`}>Last updated on {date} · {count} cards</p>
      </div>
    </div>
  );
}
