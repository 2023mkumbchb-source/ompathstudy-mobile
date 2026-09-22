import { useState, useEffect, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Loader2, FileText, ChevronRight, ChevronDown } from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { getCategoryDisplayName, getYearFromCategory } from "@/lib/store";
import { updateMetaTags } from "@/lib/seo";

interface Essay {
  id: string;
  slug: string;
  title: string;
  category: string;
  created_at: string;
  article_id: string | null;
}

const INITIAL_VISIBLE = 20;
const LOAD_MORE_STEP = 20;

export default function Essays() {
  useEffect(() => {
    updateMetaTags({
      title: "Medical Essays",
      description: "Structured medical short answer questions (SAQs) and long answer questions (LAQs) for Kenyan health students.",
    });
  }, []);
  const [essays, setEssays] = useState<Essay[]>([]);
  const [loading, setLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);
  const [searchParams] = useSearchParams();
  const selectedYear = searchParams.get("year") || "All";

  useEffect(() => {
    supabase
      .from("essays")
      .select("id,slug,title,category,created_at,article_id")
      .eq("published", true)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .then(({ data }) => {
        setEssays((data || []) as unknown as Essay[]);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    setVisibleCount(INITIAL_VISIBLE);
  }, [selectedYear]);

  const filtered = useMemo(() => {
    if (selectedYear === "All") return essays;
    return essays.filter((e) => getYearFromCategory(e.category) === selectedYear);
  }, [essays, selectedYear]);

  return (
    <div className="min-h-screen bg-background">
      <section className="border-b border-border bg-background px-5 py-9 sm:py-12">
        <div className="mx-auto max-w-3xl text-center">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <div className="study-type-badge mb-4">
              <FileText className="h-3.5 w-3.5" /> SAQs & LAQs
            </div>
            <h1 className="mb-3 font-serif text-3xl font-bold text-foreground sm:text-4xl">
              Essays & Written Questions
            </h1>
            <p className="mx-auto max-w-lg text-sm text-muted-foreground leading-relaxed">
              Short answer and long answer questions generated from your articles. Practice writing structured medical answers.
            </p>
            {selectedYear !== "All" && (
              <p className="mt-2 text-sm font-medium text-primary">{selectedYear} · {filtered.length} essay sets</p>
            )}
          </motion.div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-5 py-8">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-muted-foreground py-16">
            No essays yet for this selection.
          </p>
        ) : (
          <>
            <div className="divide-y divide-border border-y border-border">
              {filtered.slice(0, visibleCount).map((e, i) => (
                <motion.div
                  key={e.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i, 8) * 0.04 }}
                >
                  <Link
                    to={`/essays/${e.slug || e.id}`}
                    className="flex items-center justify-between rounded-2xl border border-border bg-card p-4 sm:p-5 transition-shadow hover:shadow-md"
                  >
                    <div className="min-w-0 flex-1">
                      <h3 className="font-serif text-sm font-bold text-foreground truncate sm:text-base">{e.title}</h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        {e.category !== "Uncategorized" && (
                          <span className="text-primary">{getCategoryDisplayName(e.category)} · </span>
                        )}
                        SAQs & LAQs
                      </p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                  </Link>
                </motion.div>
              ))}
            </div>
            {filtered.length > visibleCount && (
              <button
                onClick={() => setVisibleCount(prev => prev + LOAD_MORE_STEP)}
                className="mx-auto mt-6 flex items-center gap-2 rounded-xl border border-border bg-card px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
              >
                Load more ({filtered.length - visibleCount} remaining)
                <ChevronDown className="h-4 w-4" />
              </button>
            )}
          </>
        )}
      </section>
    </div>
  );
}
