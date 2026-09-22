import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Loader2, ChevronDown, ChevronUp, FileText, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { getArticleById, getCategoryDisplayName, buildBlogPath } from "@/lib/store";
import { motion, AnimatePresence } from "framer-motion";
import { updateMetaTags } from "@/lib/seo";

interface Essay {
  id: string;
  slug: string;
  title: string;
  category: string;
  short_answer_questions: { question: string; answer: string }[];
  long_answer_questions: { question: string; answer: string }[];
  article_id: string | null;
}

export default function EssayStudy() {
  const { slug } = useParams();
  const [essay, setEssay] = useState<Essay | null>(null);
  const [loading, setLoading] = useState(true);
  const [openSaq, setOpenSaq] = useState<Set<number>>(new Set());
  const [openLaq, setOpenLaq] = useState<Set<number>>(new Set());
  const [linkedArticlePath, setLinkedArticlePath] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;

    supabase
      .from("essays")
      .select("*")
      .eq("slug", slug)
      .maybeSingle()
      .then(({ data }) => {
        // fallback: if slug not found, try fetching by id (for old links)
        if (!data) {
          return supabase
            .from("essays")
            .select("*")
            .eq("id", slug)
            .maybeSingle()
            .then(({ data: fallbackData }) => {
              const e = fallbackData as unknown as Essay | null;
              setEssay(e);
              if (e) {
                updateMetaTags({
                  title: `${e.title} – Essay`,
                  description: `Practice structured medical answers for ${e.title} here.`,
                });
              }
              setLoading(false);
            });
        }
        const e = data as unknown as Essay | null;
        setEssay(e);
        if (e) {
          updateMetaTags({
            title: `${e.title} – Essay`,
            description: `Practice structured medical answers for ${e.title} here.`,
          });
        }
        setLoading(false);
      });
  }, [slug]);

  useEffect(() => {
    let mounted = true;

    if (!essay?.article_id) {
      setLinkedArticlePath(null);
      return () => {
        mounted = false;
      };
    }

    getArticleById(essay.article_id)
      .then((article) => {
        if (!mounted) return;
        setLinkedArticlePath(article ? buildBlogPath(article) : `/blog/${essay.article_id}`);
      })
      .catch(() => {
        if (!mounted) return;
        setLinkedArticlePath(`/blog/${essay.article_id}`);
      });

    return () => {
      mounted = false;
    };
  }, [essay?.article_id]);

  const toggleSaq = (i: number) => {
    setOpenSaq((prev) => {
      const n = new Set(prev);
      n.has(i) ? n.delete(i) : n.add(i);
      return n;
    });
  };

  const toggleLaq = (i: number) => {
    setOpenLaq((prev) => {
      const n = new Set(prev);
      n.has(i) ? n.delete(i) : n.add(i);
      return n;
    });
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  if (!essay) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-20 text-center">
        <h1 className="mb-4 font-serif text-3xl font-bold text-foreground">Essay not found</h1>
        <Button asChild variant="outline"><Link to="/essays"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Link></Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 pb-20 pt-8 sm:px-6 sm:py-12">
      <Button asChild variant="ghost" size="sm" className="-ml-1 mb-4 gap-2 text-muted-foreground">
        <Link to="/essays"><ArrowLeft className="h-4 w-4" /> Back to Essays</Link>
      </Button>

      <div className="mb-6">
        <h1 className="mb-2 font-serif text-2xl font-bold text-foreground sm:text-3xl">{essay.title}</h1>
        {essay.category !== "Uncategorized" && (
          <span className="inline-block rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            {getCategoryDisplayName(essay.category)}
          </span>
        )}
        {essay.article_id && (
          <Link to={linkedArticlePath || `/blog/${essay.article_id}`} className="ml-2 inline-flex items-center gap-1 text-xs text-primary hover:underline">
            <BookOpen className="h-3 w-3" /> View Article
          </Link>
        )}
      </div>

      {essay.short_answer_questions.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-3 flex items-center gap-2 font-serif text-lg font-bold text-foreground">
            <FileText className="h-5 w-5 text-primary" /> Short Answer Questions ({essay.short_answer_questions.length})
          </h2>
          <div className="space-y-2">
            {essay.short_answer_questions.map((q, i) => (
              <div key={i} className="overflow-hidden border border-border bg-card">
                <button onClick={() => toggleSaq(i)} className="flex w-full items-start justify-between gap-3 p-4 text-left">
                  <div className="flex min-w-0 flex-1 items-start gap-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{i + 1}</span>
                    <p className="break-words text-sm font-medium text-foreground">{q.question}</p>
                  </div>
                  {openSaq.has(i) ? <ChevronUp className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />}
                </button>
                <AnimatePresence>
                  {openSaq.has(i) && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <div className="px-4 pb-4 pl-12">
                        <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-3">
                          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{q.answer}</p>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </div>
      )}

      {essay.long_answer_questions.length > 0 && (
        <div>
          <h2 className="mb-3 flex items-center gap-2 font-serif text-lg font-bold text-foreground">
            <FileText className="h-5 w-5 text-accent" /> Long Answer Questions ({essay.long_answer_questions.length})
          </h2>
          <div className="space-y-2">
            {essay.long_answer_questions.map((q, i) => (
              <div key={i} className="overflow-hidden border border-border bg-card">
                <button onClick={() => toggleLaq(i)} className="flex w-full items-start justify-between gap-3 p-4 text-left">
                  <div className="flex min-w-0 flex-1 items-start gap-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/10 text-xs font-bold text-accent-foreground">{i + 1}</span>
                    <p className="break-words text-sm font-medium text-foreground">{q.question}</p>
                  </div>
                  {openLaq.has(i) ? <ChevronUp className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />}
                </button>
                <AnimatePresence>
                  {openLaq.has(i) && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <div className="px-4 pb-4 pl-12">
                        <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3">
                          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{q.answer}</p>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
