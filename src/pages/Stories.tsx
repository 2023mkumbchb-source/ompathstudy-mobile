import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Loader2, BookOpen, Search, X, PenLine, Clock, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { buildStoryPath, updateMetaTags, SITE_URL } from "@/lib/seo";
import { getStoriesOffline } from "@/lib/offlineStore";

interface Story {
  id: string;
  title: string;
  meta_description?: string | null;
  category: string;
  published: boolean;
  created_at: string;
  cover_image_url?: string | null;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
}

/* ─── Featured (first) story card ─── */
function FeaturedCard({ story }: { story: Story }) {
  const thumb = story.cover_image_url || null;
  const preview = story.meta_description || "A medical story from the OmpathStudy community.";

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <Link
        to={buildStoryPath(story)}
        className="group relative flex flex-col overflow-hidden border-y border-border bg-background transition-colors hover:bg-primary/5 sm:flex-row"
      >
        {/* Image */}
        <div className="relative h-52 shrink-0 overflow-hidden bg-muted sm:h-auto sm:w-72">
          {thumb ? (
            <img
              src={thumb}
              alt={story.title}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full min-h-[200px] w-full items-center justify-center bg-gradient-to-br from-primary/15 via-primary/5 to-background">
              <BookOpen className="h-14 w-14 text-primary/25" />
            </div>
          )}
          {/* Featured badge */}
          <span className="absolute left-3 top-3 rounded-sm bg-primary px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-foreground shadow">
            Featured
          </span>
        </div>

        {/* Content */}
        <div className="flex flex-1 flex-col justify-between p-6">
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-3">
              {story.category && story.category !== "Uncategorized" && (
                <span className="rounded-full bg-primary/10 px-3 py-0.5 text-xs font-semibold text-primary">
                  {story.category}
                </span>
              )}
              <span className="text-xs text-muted-foreground">{formatDate(story.created_at)}</span>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" /> Medical story
              </span>
            </div>
            <h2 className="mb-3 font-serif text-2xl font-bold leading-snug text-foreground transition-colors group-hover:text-primary sm:text-3xl">
              {story.title}
            </h2>
            <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">{preview}…</p>
          </div>
          <div className="mt-5 flex items-center gap-1.5 text-sm font-semibold text-primary">
            Read story <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

/* ─── Regular story card ─── */
function StoryCard({ story, index }: { story: Story; index: number }) {
  const thumb = story.cover_image_url || null;
  const preview = stripRichText(story.content || "").replace(/^\d+\.?\s*/g, "").slice(0, 120);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.05 }}
    >
      <Link
        to={buildStoryPath(story)}
        className="group flex h-full flex-col overflow-hidden border-y border-border bg-background transition-colors hover:bg-primary/5"
      >
        {/* Thumbnail */}
        <div className="relative h-44 overflow-hidden bg-muted">
          {thumb ? (
            <img
              src={thumb}
              alt={story.title}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/10 via-accent/5 to-background">
              <BookOpen className="h-10 w-10 text-primary/20" />
            </div>
          )}
        </div>

        {/* Body */}
        <div className="flex flex-1 flex-col p-4">
          <div className="mb-2.5 flex flex-wrap items-center gap-2">
            {story.category && story.category !== "Uncategorized" && (
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
                {story.category}
              </span>
            )}
            <span className="text-[11px] text-muted-foreground">{formatDate(story.created_at)}</span>
          </div>
          <h3 className="mb-2 line-clamp-2 font-serif text-base font-bold leading-snug text-foreground transition-colors group-hover:text-primary">
            {story.title}
          </h3>
          <p className="line-clamp-3 flex-1 text-xs leading-relaxed text-muted-foreground">{preview}…</p>
          <div className="mt-3 flex items-center gap-1 text-[11px] text-muted-foreground">
            <Clock className="h-3 w-3" /> {readTime(story.content)}
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

/* ─── Main page ─── */
export default function Stories() {
  useEffect(() => {
    updateMetaTags({
      title: "Medical Stories | Ompath Study",
      description: "Medical stories, narratives and experiences from Kenyan medical students and professionals.",
      url: `${SITE_URL}/stories`,
      type: "website",
    });
  }, []);

  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);

  useEffect(() => {
    void getStoriesOffline().then((cached) => {
      if (cached.length) setStories((cached as unknown as Story[]));
    });
    supabase
      .from("stories")
      .select("id,title,category,published,created_at,cover_image_url,meta_title,meta_description,og_image_url,slug")
      .eq("published", true)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (!error && data) {
          setStories((data as unknown as Story[]));
        }
        setLoading(false);
      });
  }, []);

  const filtered = stories.filter((s) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return s.title.toLowerCase().includes(term) || s.category.toLowerCase().includes(term);
  });

  const [featured, ...rest] = filtered;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-5 py-9 sm:px-6 sm:py-12">

      {/* Header */}
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-primary">Ompath Study</p>
          <h1 className="font-serif text-4xl font-bold text-foreground sm:text-5xl">Stories</h1>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">
            Real experiences from medical students &amp; professionals
          </p>
        </div>
        <Link
          to="/submit-story"
          className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
        >
          <PenLine className="h-4 w-4" /> Write
        </Link>
      </div>

      {/* Search */}
      <div className="mb-8">
        <div
          className={`relative flex items-center rounded-xl border bg-background transition-all ${
            searchFocused ? "border-primary ring-2 ring-primary/20" : "border-border"
          }`}
        >
          <Search className="ml-3.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            placeholder="Search stories…"
            className="w-full bg-transparent px-3 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          <AnimatePresence>
            {search && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                onClick={() => setSearch("")}
                className="mr-3 rounded-full p-0.5 text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Empty state */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-16 text-center">
          <BookOpen className="mx-auto mb-4 h-10 w-10 text-muted-foreground opacity-20" />
          <p className="font-semibold text-foreground">
            {stories.length === 0 ? "No stories yet" : "No stories match your search"}
          </p>
          {stories.length === 0 && (
            <p className="mt-1 text-sm text-muted-foreground">Be the first to share your experience.</p>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          {/* Featured story */}
          {featured && !search && <FeaturedCard story={featured} />}

          {/* Story count */}
          {rest.length > 0 && (
            <div className="flex items-center gap-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {search ? `${filtered.length} result${filtered.length !== 1 ? "s" : ""}` : "More Stories"}
              </p>
              <div className="h-px flex-1 bg-border" />
            </div>
          )}

          {/* Grid */}
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {(search ? filtered : rest).map((story, i) => (
              <StoryCard key={story.id} story={story} index={i} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
