import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import JSZip from "jszip";
import { jsPDF } from "jspdf";
import { ArrowLeft, Check, Clipboard, Download, ExternalLink, FileText, Image, Loader2, RefreshCw, Save, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { buildBlogPath, type Article } from "@/lib/store";

type QueueArticle = Article & { deleted_at?: string | null };

const imageUrls = (article: QueueArticle): string[] => {
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const source of [article.original_notes || "", article.content || ""]) {
    const decoded = source.replace(/\\\//g, "/").replace(/&amp;/g, "&");
    for (const match of decoded.matchAll(/https?:\/\/[^\s)"'<>]+/gi)) {
      const candidate = match[0].replace(/[\],.;:!?]+$/, "");
      if (!/(?:\/uploads\/|\.(?:jpe?g|png|webp|gif|avif)(?:\?|$))/i.test(candidate)) continue;
      const url = candidate.replace(/^https:\/\/(?:www\.)?ompathstudy\.com\/uploads\//i, "https://cdn.ompathstudy.com/uploads/");
      if (!seen.has(url)) { seen.add(url); urls.push(url); }
    }
  }
  return urls;
};

const safeName = (value: string) => value.toLowerCase().replace(/\.pdf$/i, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "paper";
const fetchScan = (url: string) => fetch(`/api/image-proxy?url=${encodeURIComponent(url)}`);

const claudePrompt = (article: QueueArticle, pages: number) => `You are editing a medical-school past paper for OmpathStudy.

Paper title: ${article.title}
Source pages attached: ${pages}

Return ONLY clean GitHub-flavoured Markdown. Do not add a preamble or code fence.

REQUIREMENTS
1. Transcribe every visible question accurately and in source order. Do not omit questions.
2. Correct obvious OCR spelling errors, but do not change the medical meaning.
3. Use ## for paper sections and ### for each numbered question.
4. For every MCQ, include all visible choices on separate lines as A. through D. or A. through E. Every MCQ must have 4 or 5 complete choices.
5. After each MCQ write:
Answer: [letter and answer text]
Explanation: [one concise, medically accurate explanation]
6. For true/false sets, give the status of every A-E statement in the Answer line and briefly explain incorrect statements.
7. For SAQs and essays, write a concise model answer using bullet points immediately after "Answer:".
8. Preserve tables as Markdown tables. Describe important diagrams when necessary.
9. Never write [unreadable], placeholders, page-dump headings, or invented questions. Flag genuine uncertainty as "Source check:" with the exact issue.
10. Do not include the source images in the Markdown; OmpathStudy stores them separately.

Begin with:
# ${article.title.replace(/\s*[—-]\s*Past Paper Questions.*$/i, "")}
`;

export function normalizeClaudeMarkdown(input: string): string {
  let text = String(input || "").trim();
  text = text.replace(/^```(?:markdown|md)?\s*/i, "").replace(/\s*```$/i, "");
  text = text.replace(/\r\n?/g, "\n").replace(/\u00a0/g, " ");
  text = text
    .replace(/^\s*([A-Ea-e])\s*[)]\s*/gm, (_, letter) => `${String(letter).toUpperCase()}. `)
    .replace(/^\s*([A-Ea-e])\s*[.:]\s*(?=\S)/gm, (_, letter) => `${String(letter).toUpperCase()}. `)
    .replace(/^\s*(?:✅\s*)?(?:correct\s+answer|model\s+answer)\s*[:：]\s*/gim, "Answer: ")
    .replace(/^\s*(?:rationale)\s*[:：]\s*/gim, "Explanation: ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+$/gm, "")
    .trim();
  if (text && !/^#\s+/m.test(text)) text = `# Clean Past Paper\n\n${text}`;
  return `${text}\n`;
}

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export default function UneditedUploads() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [articles, setArticles] = useState<QueueArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<QueueArticle | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("articles").select("*").eq("is_raw", true).is("deleted_at", null).order("created_at", { ascending: false });
    if (error) toast({ title: "Could not load review queue", description: error.message, variant: "destructive" });
    setArticles((data || []) as QueueArticle[]);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const withImages = articles.filter(article => imageUrls(article).length > 0);
    return q ? withImages.filter(article => `${article.title} ${article.category}`.toLowerCase().includes(q)) : withImages;
  }, [articles, search]);

  const withoutImages = useMemo(() => articles.filter(article => imageUrls(article).length === 0).length, [articles]);

  const openEditor = (article: QueueArticle) => { setSelected(article); setDraft(article.content || ""); window.scrollTo({ top: 0, behavior: "smooth" }); };

  const copyPrompt = async (article: QueueArticle) => {
    await navigator.clipboard.writeText(claudePrompt(article, imageUrls(article).length));
    toast({ title: "Claude instructions copied" });
  };

  const copyImages = async (article: QueueArticle) => {
    const urls = imageUrls(article);
    if (!urls.length) return toast({ title: "No source images found", variant: "destructive" });
    setBusy("copy");
    try {
      const blobs = await Promise.all(urls.map(async url => {
        const response = await fetchScan(url);
        if (!response.ok) throw new Error(`Could not fetch ${url}`);
        const original = await response.blob();
        if (original.type === "image/png") return original;
        const bitmap = await createImageBitmap(original);
        const canvas = document.createElement("canvas"); canvas.width = bitmap.width; canvas.height = bitmap.height;
        canvas.getContext("2d")!.drawImage(bitmap, 0, 0);
        return await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error("Image conversion failed")), "image/png"));
      }));
      await navigator.clipboard.write(blobs.map(blob => new ClipboardItem({ "image/png": blob })));
      toast({ title: `${blobs.length} images copied`, description: "Paste directly into Claude. If your browser accepts only one image, use Download ZIP." });
    } catch (error) {
      toast({ title: "Browser could not copy all images", description: error instanceof Error ? `${error.message}. Use Download ZIP.` : "Use Download ZIP.", variant: "destructive" });
    } finally { setBusy(null); }
  };

  const copyOneImage = async (url: string, page: number) => {
    setBusy(`copy-${page}`);
    try {
      const response = await fetchScan(url);
      if (!response.ok) throw new Error(`Image request failed (${response.status})`);
      const original = await response.blob();
      const bitmap = await createImageBitmap(original);
      const canvas = document.createElement("canvas"); canvas.width = bitmap.width; canvas.height = bitmap.height;
      canvas.getContext("2d")!.drawImage(bitmap, 0, 0);
      const png = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error("Image conversion failed")), "image/png"));
      await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);
      toast({ title: `Page ${page} copied`, description: "Paste it directly into Claude." });
    } catch (error) {
      toast({ title: `Could not copy page ${page}`, description: error instanceof Error ? `${error.message}. Click the image to open it, then copy it from the browser.` : "Open the image and copy it from the browser.", variant: "destructive" });
    } finally { setBusy(null); }
  };

  const downloadZip = async (article: QueueArticle) => {
    const urls = imageUrls(article);
    if (!urls.length) return toast({ title: "No source images found", variant: "destructive" });
    setBusy("zip");
    try {
      const zip = new JSZip();
      zip.file("CLAUDE-INSTRUCTIONS.txt", claudePrompt(article, urls.length));
      zip.file("README.txt", "Upload every page image to Claude, then paste CLAUDE-INSTRUCTIONS.txt. Paste Claude's Markdown response into the OmpathStudy admin review page.\n");
      await Promise.all(urls.map(async (url, index) => {
        const response = await fetchScan(url);
        if (!response.ok) throw new Error(`Page ${index + 1} download failed`);
        const blob = await response.blob();
        const extension = blob.type.includes("png") ? "png" : blob.type.includes("webp") ? "webp" : "jpg";
        zip.file(`page-${String(index + 1).padStart(3, "0")}.${extension}`, blob);
      }));
      downloadBlob(await zip.generateAsync({ type: "blob" }), `${safeName(article.title)}-claude-bundle.zip`);
      toast({ title: `Downloaded ${urls.length} images and Claude instructions` });
    } catch (error) {
      toast({ title: "ZIP download failed", description: error instanceof Error ? error.message : "Try again", variant: "destructive" });
    } finally { setBusy(null); }
  };

  const downloadPdf = async (article: QueueArticle) => {
    const urls = imageUrls(article);
    if (!urls.length) return toast({ title: "No source images found", variant: "destructive" });
    setBusy("pdf");
    try {
      let pdf: jsPDF | null = null;
      for (let index = 0; index < urls.length; index += 1) {
        const response = await fetchScan(urls[index]);
        if (!response.ok) throw new Error(`Page ${index + 1} download failed`);
        const bitmap = await createImageBitmap(await response.blob());
        const canvas = document.createElement("canvas");
        const scale = Math.min(1, 1800 / bitmap.width);
        canvas.width = Math.round(bitmap.width * scale);
        canvas.height = Math.round(bitmap.height * scale);
        canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        const image = canvas.toDataURL("image/jpeg", 0.88);
        const orientation = canvas.width > canvas.height ? "landscape" : "portrait";
        if (!pdf) pdf = new jsPDF({ orientation, unit: "pt", format: "a4", compress: true });
        else pdf.addPage("a4", orientation);
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const ratio = Math.min(pageWidth / canvas.width, pageHeight / canvas.height);
        const width = canvas.width * ratio;
        const height = canvas.height * ratio;
        pdf.addImage(image, "JPEG", (pageWidth - width) / 2, (pageHeight - height) / 2, width, height, undefined, "FAST");
        bitmap.close();
      }
      pdf!.addPage("a4", "portrait");
      const finalWidth = pdf!.internal.pageSize.getWidth();
      const finalHeight = pdf!.internal.pageSize.getHeight();
      pdf!.setFont("helvetica", "bold");
      pdf!.setFontSize(22);
      pdf!.text("Continue revising with Ompath Study", finalWidth / 2, finalHeight / 2 - 20, { align: "center" });
      pdf!.setFont("helvetica", "normal");
      pdf!.setFontSize(13);
      pdf!.text("For more study files, kindly visit www.ompathstudy.com", finalWidth / 2, finalHeight / 2 + 12, { align: "center" });
      pdf!.save(`${safeName(article.title)}-source-pages.pdf`);
      toast({ title: `Downloaded ${urls.length} pages as one PDF` });
    } catch (error) {
      toast({ title: "PDF download failed", description: error instanceof Error ? error.message : "Try again", variant: "destructive" });
    } finally { setBusy(null); }
  };

  const save = async (markEdited: boolean) => {
    if (!selected) return;
    const content = normalizeClaudeMarkdown(draft);
    if (content.length < 80) return toast({ title: "Content is too short", description: "Paste Claude's complete Markdown response first.", variant: "destructive" });
    const incompleteMcq = content.split(/(?=^###\s+\d+[.)]\s+)/gm).some(block => {
      const options = block.match(/^[A-E]\.\s+\S.+$/gm) || [];
      return options.length > 0 && (options.length < 4 || options.length > 5);
    });
    if (incompleteMcq && !confirm("At least one MCQ has fewer than 4 or more than 5 options. Save anyway?")) return;
    setBusy("save");
    const { error } = await supabase.from("articles").update({ content, is_raw: !markEdited, published: true, updated_at: new Date().toISOString() }).eq("id", selected.id);
    setBusy(null);
    if (error) return toast({ title: "Save failed", description: error.message, variant: "destructive" });
    toast({ title: markEdited ? "Saved and removed from review queue" : "Review draft saved" });
    if (markEdited) { setSelected(null); setDraft(""); }
    await load();
  };

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  if (selected) {
    const urls = imageUrls(selected);
    return (
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <Button variant="ghost" onClick={() => setSelected(null)}><ArrowLeft className="mr-2 h-4 w-4" />Queue</Button>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void copyPrompt(selected)}><FileText className="mr-2 h-4 w-4" />Copy Claude prompt</Button>
            <Button variant="outline" disabled={!!busy} onClick={() => void downloadPdf(selected)}>{busy === "pdf" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}Download pages PDF</Button>
            <Button variant="outline" asChild><a href={buildBlogPath(selected)} target="_blank" rel="noreferrer"><ExternalLink className="mr-2 h-4 w-4" />Open blog</a></Button>
          </div>
        </div>
        <div className="mb-5 border border-amber-500/30 bg-amber-500/10 p-4">
          <h1 className="font-serif text-xl font-bold text-foreground">{selected.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{urls.length} source images · {selected.category} · Temporary editing workspace</p>
        </div>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <section>
            <div className="mb-3 flex items-center justify-between"><h2 className="font-bold">Original pages</h2><span className="text-xs text-muted-foreground">All selected automatically</span></div>
            <div className="max-h-[75vh] space-y-3 overflow-y-auto border border-border bg-muted/20 p-3">
              {urls.map((url, index) => <figure key={url} className="overflow-hidden border border-border bg-card"><a href={url} target="_blank" rel="noreferrer" title="Open full-size image"><img src={url} alt={`Page ${index + 1}`} loading="lazy" className="w-full cursor-zoom-in" /></a><figcaption className="px-3 py-2 text-xs font-semibold text-muted-foreground">Page {index + 1} of {urls.length}</figcaption></figure>)}
              {!urls.length && <div className="p-8 text-center text-sm text-muted-foreground"><p>No source images were detected in this article.</p><p className="mt-2">Refresh once; if this remains empty, that paper still needs its scans attached.</p></div>}
            </div>
          </section>
          <section>
            <h2 className="mb-3 font-bold">Paste Claude's Markdown response</h2>
            <Textarea value={draft} onChange={event => setDraft(event.target.value)} className="min-h-[65vh] font-mono text-sm leading-relaxed" placeholder="Paste Claude's complete Markdown here. Formatting is normalized automatically when saved." />
            <div className="mt-3 flex flex-wrap justify-end gap-2">
              <Button variant="outline" disabled={busy === "save"} onClick={() => void save(false)}><Save className="mr-2 h-4 w-4" />Save and keep in queue</Button>
              <Button disabled={busy === "save"} onClick={() => void save(true)}>{busy === "save" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}Save & mark edited</Button>
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="font-serif text-2xl font-bold text-foreground sm:text-3xl">Unedited Uploads</h1><p className="mt-1 text-sm text-muted-foreground">Temporary editing workspace for image-first papers awaiting manual text and answers.</p></div>
        <div className="flex gap-2"><Button variant="outline" onClick={() => navigate("/admin")}><ArrowLeft className="mr-2 h-4 w-4" />Dashboard</Button><Button variant="outline" onClick={() => void load()}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button></div>
      </div>
      <div className="mb-5 grid gap-3 sm:grid-cols-[1fr_auto]">
        <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search title or category" className="pl-9" /></div>
        <div className="border border-border bg-card px-4 py-2 text-sm font-semibold">{filtered.length} with scans{withoutImages ? ` · ${withoutImages} without scans hidden` : ""}</div>
      </div>
      <div className="space-y-3">
        {filtered.map(article => {
          const pages = imageUrls(article).length;
          return <article key={article.id} className="border border-border bg-card p-4 transition-colors hover:border-primary/40"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div className="min-w-0"><h2 className="font-semibold text-foreground">{article.title}</h2><p className="mt-1 text-xs text-muted-foreground">{article.category} · {pages} page image{pages === 1 ? "" : "s"} · {article.published ? "Public" : "Draft"}</p></div><div className="flex shrink-0 flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => void copyPrompt(article)}><FileText className="mr-1.5 h-3.5 w-3.5" />Prompt</Button><Button size="sm" variant="outline" disabled={!!busy} onClick={() => void downloadPdf(article)}><Download className="mr-1.5 h-3.5 w-3.5" />Pages PDF</Button><Button size="sm" onClick={() => openEditor(article)}><Image className="mr-1.5 h-3.5 w-3.5" />Open & edit</Button></div></div></article>;
        })}
        {!filtered.length && <div className="border border-dashed border-border p-12 text-center text-muted-foreground">No unedited uploads match this search.</div>}
      </div>
    </main>
  );
}
