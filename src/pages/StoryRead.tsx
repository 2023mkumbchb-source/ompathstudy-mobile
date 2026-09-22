import "@/styles/workspace.css";
import { useState, useEffect } from "react";
import { useParams, Link, useLocation, useNavigate } from "react-router-dom";
import { Loader2, ArrowLeft, Clock, BookOpen, Share2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { buildStoryPath, extractStoryIdFromParam, SITE_URL, stripRichText, updateMetaTags } from "@/lib/seo";
import ShareButtons from "@/components/ShareButtons";
import { Helmet } from "react-helmet-async";
import { KeywordLinkProvider, linkifyText, useKeywordLinks } from "@/lib/keyword-link";
import { slugify, useHashFlash } from "@/lib/deep-link";
import { getStoryOffline, saveStoryOffline } from "@/lib/offlineStore";

export default function StoryRead() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  useHashFlash();
  const [story, setStory] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [scrollProgress, setScrollProgress] = useState(0);

  const ogUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}${location.pathname}${location.search}`
      : location.pathname;
  const title = story?.title
    ? `${story.title} | Story | OmpathStudy Kenya`
    : "Story | OmpathStudy Kenya";
  const description =
    story?.content
      ? stripRichText(story.content || "", 160) ||
        "Read a medical story on OmpathStudy—built for Kenyan medical and health students to learn, reflect, and grow."
      : "Read a medical story on OmpathStudy—built for Kenyan medical and health students to learn, reflect, and grow.";
  const keywords =
    "OmpathStudy, story, medical narrative, reflective practice, medical students Kenya, nursing students Kenya, health education Kenya";

  useEffect(() => {
    const handleScroll = () => {
      const el = document.documentElement;
      const scrolled = el.scrollTop;
      const total = el.scrollHeight - el.clientHeight;
      setScrollProgress(total > 0 ? (scrolled / total) * 100 : 0);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const storyId = extractStoryIdFromParam(id);
    if (!storyId) {
      setStory(null);
      setLoading(false);
      return;
    }

    void getStoryOffline(storyId).then((cached) => {
      if (cached) { setStory(cached); setLoading(false); }
    });
    supabase
      .from("stories")
      .select("*")
      .eq("id", storyId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!error && data) {
          setStory(data);
          void saveStoryOffline(data as import("@/lib/store").Story);
        }
        setLoading(false);
        if (data) {
          const canonicalPath = buildStoryPath({ id: data.id, title: data.title });
          if (location.pathname !== canonicalPath) {
            navigate(canonicalPath, { replace: true });
          }
          const url = `${SITE_URL}${canonicalPath}`;
          const fallbackDesc = stripRichText(data.content || "", 160);
          const metaTitle = (data as any).meta_title || `${data.title} Stories`;
          const metaDesc = (data as any).meta_description || fallbackDesc;
          const image = (data as any).og_image_url || data.cover_image_url || `${SITE_URL}/og-default.png`;
          updateMetaTags({ title: metaTitle, description: metaDesc, image, url, type: "article" });
        }
      });
  }, [id, location.pathname, navigate]);

  const storyUrl = story ? `${SITE_URL}${buildStoryPath({ id: story.id, title: story.title })}` : "";

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading story…</p>
        </div>
      </div>
    );
  }

  if (!story) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-24 text-center">
        <p className="text-lg font-semibold text-foreground">Story not found</p>
        <p className="mt-2 text-sm text-muted-foreground">This story may have been removed or the link is broken.</p>
        <Link to="/stories" className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90">
          <ArrowLeft className="h-4 w-4" /> Back to stories
        </Link>
      </div>
    );
  }

  const storyContent = story.content || "";
  const isHtml = /<[a-z][\s\S]*>/i.test(storyContent);
  const plainForCount = stripRichText(storyContent);
  const wordCount = plainForCount.split(/\s+/).filter(Boolean).length || 0;
  const readTime = Math.max(1, Math.ceil(wordCount / 200));

  const renderInline = (text: string, linkCtx: ReturnType<typeof useKeywordLinks>) => {
    const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
    return parts.map((part, j) => {
      if (part.startsWith("**") && part.endsWith("**"))
        return <strong key={j} className="font-bold text-foreground">{linkifyText(part.slice(2, -2), linkCtx, `ss${j}`)}</strong>;
      if (part.startsWith("*") && part.endsWith("*") && part.length > 2)
        return <em key={j} className="italic text-foreground/80">{linkifyText(part.slice(1, -1), linkCtx, `se${j}`)}</em>;
      return <span key={j}>{linkifyText(part, linkCtx, `st${j}`)}</span>;
    });
  };

  const renderMarkdown = (content: string, linkCtx: ReturnType<typeof useKeywordLinks>) => {
    const cleaned = content.replace(/^(\s*---\s*\n)+/, "");
    const lines = cleaned.split("\n");
    const elements: React.ReactNode[] = [];
    let listBuffer: React.ReactNode[] = [];

    const flushList = (i: number) => {
      if (listBuffer.length > 0) {
        elements.push(
          <ul key={`list-${i}`} className="my-4 space-y-1.5 pl-6">
            {listBuffer}
          </ul>
        );
        listBuffer = [];
      }
    };

    lines.forEach((line: string, i: number) => {
      const trimmed = line.trim();

      if (trimmed.startsWith("# ")) {
        flushList(i);
        elements.push(
          <h1 key={i} id={slugify(trimmed.slice(2))} className="mb-4 mt-10 scroll-mt-20 font-serif text-2xl font-bold leading-tight text-foreground sm:text-3xl">
            {renderInline(trimmed.slice(2), linkCtx)}
          </h1>
        );
        return;
      }
      if (trimmed.startsWith("## ")) {
        flushList(i);
        elements.push(
          <h2 key={i} id={slugify(trimmed.slice(3))} className="mb-3 mt-8 scroll-mt-20 border-l-4 border-primary pl-3 font-serif text-xl font-bold text-foreground sm:text-2xl">
            {renderInline(trimmed.slice(3), linkCtx)}
          </h2>
        );
        return;
      }
      if (trimmed.startsWith("### ")) {
        flushList(i);
        elements.push(
          <h3 key={i} id={slugify(trimmed.slice(4))} className="mb-2 mt-6 scroll-mt-20 font-serif text-lg font-semibold text-foreground">
            {renderInline(trimmed.slice(4), linkCtx)}
          </h3>
        );
        return;
      }
      if (/^[-*_]{3,}$/.test(trimmed)) {
        flushList(i);
        elements.push(
          <div key={i} className="my-8 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <div className="h-1.5 w-1.5 rounded-full bg-primary/40" />
            <div className="h-px flex-1 bg-border" />
          </div>
        );
        return;
      }
      if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
        listBuffer.push(
          <li key={i} className="flex items-start gap-2 text-[15px] leading-relaxed text-foreground/85">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
            <span>{renderInline(trimmed.slice(2), linkCtx)}</span>
          </li>
        );
        return;
      }
      if (trimmed.startsWith("> ")) {
        flushList(i);
        elements.push(
          <blockquote key={i} className="my-5 rounded-r-lg border-l-4 border-primary bg-primary/5 px-5 py-4 italic text-foreground/80">
            <p className="text-[15px] leading-relaxed">{renderInline(trimmed.slice(2), linkCtx)}</p>
          </blockquote>
        );
        return;
      }

      const imgMatch = trimmed.match(/^!\[(.*?)\]\((.*?)\)$/);
      if (imgMatch) {
        flushList(i);
        elements.push(
          <figure key={i} className="my-6 overflow-hidden rounded-md border border-border">
            <img src={imgMatch[2]} alt={imgMatch[1] || "Story image"} loading="lazy" className="w-full object-cover" />
            {imgMatch[1] && <figcaption className="px-4 py-2 text-center text-xs text-muted-foreground">{imgMatch[1]}</figcaption>}
          </figure>
        );
        return;
      }

      if (!trimmed) {
        flushList(i);
        elements.push(<div key={i} className="h-2" />);
        return;
      }

      flushList(i);
      elements.push(
        <p key={i} className="mb-4 text-[15.5px] leading-[1.85] text-foreground/85 sm:text-base">
          {renderInline(line, linkCtx)}
        </p>
      );
    });

    flushList(lines.length);
    return elements;
  };

  return (
    <>
      {/* Reading progress bar */}
      <div
        className="fixed left-0 top-0 z-50 h-0.5 bg-primary transition-colors duration-150"
        style={{ width: `${scrollProgress}%` }}
      />

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

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="mx-auto max-w-2xl px-5 pb-16 pt-6 sm:px-6 sm:pt-10"
      >
        {/* Back link */}
        <Link
          to="/stories"
          className="mb-8 inline-flex items-center gap-1.5 rounded-full border border-border px-3.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to stories
        </Link>

        {/* Header */}
        <header className="mb-8">
          {story.category && story.category !== "Uncategorized" && (
            <span className="mb-4 inline-block rounded-full bg-primary/10 px-3.5 py-1 text-[11px] font-bold uppercase tracking-widest text-primary">
              {story.category}
            </span>
          )}

          <h1 className="font-serif text-[1.75rem] font-bold leading-[1.25] text-foreground sm:text-[2.25rem]">
            {(story as any).meta_title || story.title}
          </h1>

          {((story as any).meta_description || "") && (
            <p className="mt-3 font-serif text-[1.05rem] leading-relaxed text-muted-foreground">
              {(story as any).meta_description}
            </p>
          )}

          {/* Meta row */}
          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-y border-border py-3 text-xs text-muted-foreground">
            <span className="font-medium text-foreground/70">
              {new Date(story.created_at).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              {readTime} min read
            </span>
            <span className="flex items-center gap-1.5">
              <BookOpen className="h-3.5 w-3.5" />
              {wordCount.toLocaleString()} words
            </span>
          </div>

          {/* Reviewed badge + share */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 text-sm">
              <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm">
                <svg viewBox="0 0 20 20" className="h-3 w-3" fill="currentColor">
                  <path d="M16.7 5.3a1 1 0 010 1.4l-7.5 7.5a1 1 0 01-1.4 0L3.3 9.7a1 1 0 011.4-1.4l3.8 3.8 6.8-6.8a1 1 0 011.4 0z" />
                </svg>
              </span>
              <div className="leading-tight">
                <p className="text-xs font-semibold text-foreground">Editorially Reviewed</p>
                <p className="text-[11px] text-muted-foreground">Curated for OmpathStudy readers</p>
              </div>
            </div>
            <div className="shrink-0">
              <ShareButtons url={storyUrl} title={story.title} variant="full" />
            </div>
          </div>
        </header>

        {/* Cover image */}
        {story.cover_image_url && (
          <figure className="mb-8 overflow-hidden rounded-md border border-border shadow-sm">
            <img
              src={story.cover_image_url}
              alt={story.title}
              loading="lazy"
              className="max-h-[420px] w-full object-cover"
            />
          </figure>
        )}

        {/* Article body */}
        <article className="prose-custom">
          <KeywordLinkProvider currentPath={buildStoryPath({ id: story.id, title: story.title })}>
            <StoryContentBody storyContent={storyContent} isHtml={isHtml} renderMarkdown={renderMarkdown} />
          </KeywordLinkProvider>
        </article>

        {/* Footer share */}
        <div className="mt-12 flex flex-col items-center gap-4 border-t border-border pt-8 text-center">
          <p className="text-sm font-medium text-muted-foreground">Found this helpful? Share it.</p>
          <ShareButtons url={storyUrl} title={story.title} variant="full" />
          <Link
            to="/stories"
            className="mt-2 inline-flex items-center gap-2 text-sm text-primary hover:underline"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> More stories
          </Link>
        </div>
      </motion.div>
    </>
  );
}

function StoryContentBody({ storyContent, isHtml, renderMarkdown }: { storyContent: string; isHtml: boolean; renderMarkdown: (content: string, linkCtx: ReturnType<typeof useKeywordLinks>) => React.ReactNode[] }) {
  const linkCtx = useKeywordLinks();
  if (isHtml) {
    return (
      <div
        className="prose prose-sm max-w-none prose-headings:font-serif prose-p:leading-[1.85] prose-p:text-foreground/85 prose-strong:text-foreground prose-blockquote:border-primary/40 prose-blockquote:bg-primary/5 dark:prose-invert"
        dangerouslySetInnerHTML={{ __html: storyContent }}
      />
    );
  }
  return <>{renderMarkdown(storyContent, linkCtx)}</>;
}
