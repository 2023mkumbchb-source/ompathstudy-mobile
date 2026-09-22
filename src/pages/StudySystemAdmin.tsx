import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { AlertTriangle, BookOpen, Database, Loader2, Search, ShieldCheck } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

type Metric = { label: string; value: number; icon: typeof BookOpen };
type Report = { id: string; report_type: string; status: string; resource_type: string; created_at: string };
type SearchQuery = { query: string; results_count: number; created_at: string };

export default function StudySystemAdmin() {
  const { isAdmin, loading: authLoading } = useAuth();
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [queries, setQueries] = useState<SearchQuery[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAdmin) { setLoading(false); return; }
    let alive = true;
    setLoading(true);
    (async () => {
      const db = supabase as any;
      const [u, t, r, s, c] = await Promise.all([
        db.from("units").select("*", { count: "exact", head: true }),
        db.from("syllabus_topics").select("*", { count: "exact", head: true }),
        db.from("content_reports").select("id,report_type,status,resource_type,created_at").order("created_at", { ascending: false }).limit(12),
        db.from("search_queries").select("query,results_count,created_at").order("created_at", { ascending: false }).limit(20),
        db.from("medical_concepts").select("*", { count: "exact", head: true }),
      ]);
      if (!alive) return;
      setMetrics([
        { label: "Canonical units", value: u.count || 0, icon: BookOpen },
        { label: "Syllabus topics", value: t.count || 0, icon: Database },
        { label: "Open reports", value: (r.data || []).filter((x: Report) => x.status === "open").length, icon: AlertTriangle },
        { label: "Medical concepts", value: c.count || 0, icon: ShieldCheck },
      ]);
      setReports(r.data || []);
      setQueries(s.data || []);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [isAdmin]);

  if (authLoading || (isAdmin && loading)) {
    return (
      <div className="flex min-h-[55vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <main className="mx-auto max-w-2xl px-5 py-16 text-center">
        <h1 className="font-serif text-2xl font-bold">Administrator access required</h1>
        <Link to="/login" className="mt-4 inline-block text-primary hover:underline">Sign in</Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-5 py-10">
      <Helmet>
        <title>Study System Admin | OmpathStudy</title>
        <meta name="robots" content="noindex" />
      </Helmet>

      <nav aria-label="Breadcrumb" className="mb-4 text-xs text-muted-foreground">
        <Link to="/admin" className="hover:text-primary">Admin</Link> ›{" "}
        <span className="text-foreground">Study System</span>
      </nav>

      <p className="text-xs font-bold uppercase tracking-widest text-primary">Administration</p>
      <h1 className="mt-1 font-serif text-3xl font-bold">Study System</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Academic structure, student feedback, search demand and relationship quality.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {metrics.map((m) => (
          <div key={m.label} className="border-y border-border bg-card p-4">
            <m.icon className="h-5 w-5 text-primary" aria-hidden="true" />
            <p className="mt-3 text-2xl font-bold">{m.value}</p>
            <p className="text-xs text-muted-foreground">{m.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 font-serif text-xl font-bold">Recent content reports</h2>
          <div className="border-y border-border bg-card p-2">
            {reports.length ? (
              reports.map((r) => (
                <div key={r.id} className="flex items-center justify-between border-b border-border p-3 last:border-0">
                  <span>
                    <strong className="block text-sm">{r.report_type.split("_").join(" ")}</strong>
                    <span className="text-xs text-muted-foreground">{r.resource_type}</span>
                  </span>
                  <span className="text-xs font-bold uppercase text-muted-foreground">{r.status}</span>
                </div>
              ))
            ) : (
              <p className="p-6 text-center text-sm text-muted-foreground">No reports submitted.</p>
            )}
          </div>
        </section>

        <section>
          <h2 className="mb-3 font-serif text-xl font-bold">Recent searches</h2>
          <div className="border-y border-border bg-card p-2">
            {queries.length ? (
              queries.map((q, i) => (
                <div key={`${q.created_at}-${i}`} className="flex items-center gap-3 border-b border-border p-3 last:border-0">
                  <Search className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                  <span className="flex-1 truncate text-sm">{q.query}</span>
                  <span className={`shrink-0 text-xs ${q.results_count === 0 ? "font-bold text-destructive" : "text-muted-foreground"}`}>
                    {q.results_count} results
                  </span>
                </div>
              ))
            ) : (
              <p className="p-6 text-center text-sm text-muted-foreground">Search activity will appear here.</p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
