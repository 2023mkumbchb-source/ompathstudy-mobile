import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Sparkles, Loader2, Plus, Trash2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { getArticleCategories, saveArticleCategory, deleteArticleCategory, type ArticleCategory } from "@/lib/store";
import { supabase } from "@/integrations/supabase/client";
import { Helmet } from "react-helmet-async";
import { useAuth } from "@/hooks/useAuth";

export default function CategoryManager() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAdmin, loading: authLoading } = useAuth();
  const [categories, setCategories] = useState<ArticleCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [rawText, setRawText] = useState("");
  const [parsedCategories, setParsedCategories] = useState<string[]>([]);
  const [newCat, setNewCat] = useState("");

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      navigate("/login");
      return;
    }
    if (isAdmin) loadCategories();
  }, [navigate, isAdmin, authLoading]);

  const loadCategories = async () => {
    setLoading(true);
    try {
      const cats = await getArticleCategories();
      setCategories(cats);
    } catch {} finally { setLoading(false); }
  };

  const handleAiParse = async () => {
    if (!rawText.trim()) return;
    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-content", {
        body: {
          notes: rawText,
          type: "categorize-timetable",
        },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      if (Array.isArray(data?.categories)) {
        setParsedCategories(data.categories);
        toast({ title: `AI found ${data.categories.length} categories` });
      } else {
        const lines = rawText.split("\n").map(l => l.trim()).filter(Boolean);
        const cats = lines.map(l => {
          const cleaned = l.replace(/^[-•*\d.)\]]+\s*/, "").trim();
          return cleaned;
        }).filter(c => c.length > 2 && c.length < 100);
        setParsedCategories(cats);
        toast({ title: `Parsed ${cats.length} categories from text` });
      }
    } catch (err: any) {
      const lines = rawText.split("\n").map(l => l.trim()).filter(Boolean);
      const cats = lines
        .map(l => l.replace(/^[-•*\d.)\]]+\s*/, "").trim())
        .filter(c => c.length > 2 && c.length < 100);
      setParsedCategories(cats);
      toast({ title: `Parsed ${cats.length} categories (offline mode)` });
    } finally { setAiLoading(false); }
  };

  const handleAddParsed = async () => {
    const existing = new Set(categories.map(c => c.name.toLowerCase()));
    const toAdd = parsedCategories.filter(c => !existing.has(c.toLowerCase()));
    let added = 0;
    for (const name of toAdd) {
      try {
        await saveArticleCategory({ name } as any);
        added++;
      } catch { }
    }
    toast({ title: `Added ${added} new categories` });
    setParsedCategories([]);
    setRawText("");
    await loadCategories();
  };

  const handleAddSingle = async () => {
    if (!newCat.trim()) return;
    try {
      await saveArticleCategory({ name: newCat.trim() } as any);
      toast({ title: "Category added!" });
      setNewCat("");
      await loadCategories();
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteArticleCategory(id);
      setCategories(prev => prev.filter(c => c.id !== id));
      toast({ title: "Deleted" });
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    }
  };

  const grouped = categories.reduce<Record<string, ArticleCategory[]>>((acc, cat) => {
    const match = cat.name.match(/^(Year \d+):/);
    const key = match ? match[1] : "Other";
    (acc[key] = acc[key] || []).push(cat);
    return acc;
  }, {});

  return (
    <>
      <Helmet>
        <title>Category Manager | OmpathStudy Admin</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <div className="min-h-screen bg-background">
        <div className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
          <div className="mx-auto flex max-w-3xl items-center gap-2 px-3 py-2">
            <Button variant="ghost" size="sm" onClick={() => navigate("/admin")} className="gap-1 text-xs px-2">
              <ArrowLeft className="h-3.5 w-3.5" /> Admin
            </Button>
            <h1 className="text-sm font-bold">Category Manager</h1>
          </div>
        </div>

        <div className="mx-auto max-w-3xl px-3 py-4 space-y-6">
          <div className="border border-border bg-card p-4 space-y-3">
            <h2 className="text-sm font-bold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> AI Category Sorter
            </h2>
            <p className="text-xs text-muted-foreground">
              Paste your timetable, unit list, or curriculum text below. AI will extract and organize categories in "Year X: Unit Name" format.
            </p>
            <Textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder={`Example:\nYear 2 Semester 1\n- Anatomy\n- Physiology\n- Biochemistry\n\nYear 3\n- General Pathology\n- Clinical Pathology\n- Pharmacology`}
              className="min-h-[120px] text-sm"
            />
            <Button onClick={handleAiParse} disabled={aiLoading || !rawText.trim()} className="gap-1 w-full">
              {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Parse with AI
            </Button>

            {parsedCategories.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium">Parsed {parsedCategories.length} categories:</p>
                <div className="flex flex-wrap gap-1.5">
                  {parsedCategories.map((c, i) => (
                    <span key={i} className="rounded-full bg-primary/10 text-primary px-2.5 py-1 text-xs font-medium flex items-center gap-1">
                      {c}
                      <button onClick={() => setParsedCategories(prev => prev.filter((_, j) => j !== i))} className="hover:text-destructive">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <Button onClick={handleAddParsed} className="gap-1 w-full" variant="default">
                  <Check className="h-4 w-4" /> Add All to Categories
                </Button>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <Input value={newCat} onChange={(e) => setNewCat(e.target.value)}
              placeholder="e.g. Year 3: Hematopathology" className="text-sm flex-1" />
            <Button onClick={handleAddSingle} className="gap-1 shrink-0">
              <Plus className="h-4 w-4" /> Add
            </Button>
          </div>

          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="space-y-4">
              {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([year, cats]) => (
                <div key={year} className="space-y-1">
                  <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{year}</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {cats.sort((a, b) => a.name.localeCompare(b.name)).map(cat => (
                      <span key={cat.id} className="border border-border bg-muted/50 px-2.5 py-1 text-xs flex items-center gap-1.5">
                        {cat.name.replace(/^Year \d+:\s*/, "")}
                        <button onClick={() => handleDelete(cat.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
              {categories.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No custom categories yet. Use AI to parse your timetable above.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
