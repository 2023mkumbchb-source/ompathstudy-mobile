import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Loader2, FileText, Layers, Settings, Trash2, Pencil, ListChecks, Save, Key, Zap, RefreshCw, Bolt, AlertTriangle, Building2, Check, X, Sparkles, Eye, Upload, Wrench, Globe, Search, Copy, ExternalLink, BookOpen, ChevronDown, Edit3, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  getArticles, saveArticle, deleteArticle,
  getFlashcardSets, saveFlashcardSet, deleteFlashcardSet,
  getMcqSets, saveMcqSet, deleteMcqSet,
  getSetting, saveSetting,
  UNIT_CATEGORIES, getCategoryDisplayName, buildBlogPath,
  getArticleCategories, saveArticleCategory, deleteArticleCategory,
  type Article, type FlashcardSet, type McqSet, type ArticleCategory,
} from "@/lib/store";
import { supabase } from "@/integrations/supabase/client";
import { SlideCorrectionsAdmin } from "@/components/SlideCorrectionsAdmin";
import PaymentSettingsAdmin from "@/components/PaymentSettingsAdmin";
import NotificationAdmin from "@/components/NotificationAdmin";
import { autoIndexUrls, SITE_URL, slugifyText } from "@/lib/seo";
import { Helmet } from "react-helmet-async";
import { useAuth } from "@/hooks/useAuth";

type Tab = "create" | "unedited" | "articles" | "flashcards" | "mcqs" | "stories" | "raw" | "exams" | "settings" | "institutions" | "upgrade" | "import" | "cleanup" | "seo" | "categories" | "editor" | "meta-manager" | "corrections" | "payments" | "notifications";
type DirectType = "article" | "mcqs" | "flashcards";

export default function Admin() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { isAdmin, loading: authLoading } = useAuth();
  const ogUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}${location.pathname}${location.search}`
      : location.pathname;
  const title = "Admin Dashboard | OmpathStudy Kenya";
  const description =
    "Manage OmpathStudy content, categories, settings, and indexing for the Kenyan medical education platform. Restricted admin access.";
  const keywords =
    "OmpathStudy, admin dashboard, medical education Kenya, content management, Supabase, SEO, categories";
  const [geminiKey, setGeminiKey] = useState("");
  const [geminiKeysAll, setGeminiKeysAll] = useState<string[]>([]);
  const [articleEditId, setArticleEditId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      navigate("/login");
    }
    Promise.all([getSetting("gemini_api_key"), getSetting("gemini_api_keys")]).then(([key, multiRaw]) => {
      setGeminiKey(key || "");
      try {
        const parsed = JSON.parse(multiRaw || "[]");
        if (Array.isArray(parsed)) setGeminiKeysAll(parsed.filter(Boolean));
      } catch { /* ignore */ }
    });
  }, [navigate, isAdmin, authLoading]);

  // Persist tab in URL hash for refresh resilience
  const hashTab = location.hash.replace("#", "") as Tab;
  const [tab, setTab] = useState<Tab>(hashTab && ["create","articles","flashcards","mcqs","stories","raw","exams","recycle","settings","institutions","upgrade","import","cleanup","seo","categories","editor","meta-manager","corrections","payments","notifications"].includes(hashTab) ? hashTab : "create");
  
  const setTabAndHash = (t: Tab) => {
    setTab(t);
    window.history.replaceState(null, "", `#${t}`);
  };

  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingType, setLoadingType] = useState<string | null>(null);
  const [category, setCategory] = useState("");
  const [cardCount, setCardCount] = useState(20);
  const [mcqCount, setMcqCount] = useState(15);
  const [customCategories, setCustomCategories] = useState<ArticleCategory[]>([]);

  useEffect(() => {
    getArticleCategories().then(setCustomCategories).catch(() => {});
  }, [tab]);

  const [genArticle, setGenArticle] = useState(true);
  const [genFlashcards, setGenFlashcards] = useState(true);
  const [genMcqs, setGenMcqs] = useState(true);

  const [directType, setDirectType] = useState<DirectType>("article");
  const [directTitle, setDirectTitle] = useState("");
  const [directContent, setDirectContent] = useState("");
  const [directCategory, setDirectCategory] = useState("");
  const [directTargetCount, setDirectTargetCount] = useState(20);
  const [directPreviewArticle, setDirectPreviewArticle] = useState<{ title: string; content: string } | null>(null);
  const [directPreviewCards, setDirectPreviewCards] = useState<{ question: string; answer: string }[] | null>(null);
  const [directPreviewMcqs, setDirectPreviewMcqs] = useState<{ question: string; options: string[]; correct_answer: number; explanation?: string }[] | null>(null);

  const [batchArticle, setBatchArticle] = useState<{ title: string; content: string } | null>(null);
  const [batchCards, setBatchCards] = useState<{ question: string; answer: string }[] | null>(null);
  const [batchMcqs, setBatchMcqs] = useState<{ question: string; options: string[]; correct_answer: number; explanation?: string }[] | null>(null);
  const [batchCategory, setBatchCategory] = useState("");
  const [batchTitle, setBatchTitle] = useState("");

  const [previewArticle, setPreviewArticle] = useState<{ title: string; content: string } | null>(null);
  const [previewCards, setPreviewCards] = useState<{ question: string; answer: string }[] | null>(null);
  const [previewMcqs, setPreviewMcqs] = useState<{ question: string; options: string[]; correct_answer: number; explanation?: string }[] | null>(null);
  const [previewTitle, setPreviewTitle] = useState("");
  const [previewContent, setPreviewContent] = useState("");

  const generateArticle = async (notesInput: string): Promise<{ title: string; content: string }> => {
    const { data, error } = await supabase.functions.invoke('generate-content', {
      body: { notes: notesInput, type: 'article', geminiKey, geminiKeys: geminiKeysAll },
    });
    if (error) throw new Error(error.message || "Failed to generate article");
    if (data?.error) throw new Error(data.error);
    return data;
  };

  const generateFlashcards = async (notesInput: string, count: number = 20): Promise<{ question: string; answer: string }[]> => {
    const { data, error } = await supabase.functions.invoke('generate-content', {
      body: { notes: notesInput, type: 'flashcards', count, geminiKey, geminiKeys: geminiKeysAll },
    });
    if (error) throw new Error(error.message || "Failed to generate flashcards");
    if (data?.error) throw new Error(data.error);
    return data;
  };

  const generateMcqs = async (notesInput: string, count: number = 15): Promise<{ question: string; options: string[]; correct_answer: number; explanation?: string }[]> => {
    const { data, error } = await supabase.functions.invoke('generate-content', {
      body: { notes: notesInput, type: 'mcqs', count, geminiKey, geminiKeys: geminiKeysAll },
    });
    if (error) throw new Error(error.message || "Failed to generate MCQs");
    if (data?.error) throw new Error(data.error);
    return data;
  };

  const autoCategorizе = async (notesInput: string): Promise<string> => {
    const { data, error } = await supabase.functions.invoke('generate-content', {
      body: { notes: notesInput, type: 'categorize', geminiKey, geminiKeys: geminiKeysAll },
    });
    if (error) return "Uncategorized";
    return data?.category || "Uncategorized";
  };

  const clampRequestedCount = (n: number) => Math.min(Math.max(Math.floor(n || 0), 5), 100);

  const inferContentTitle = (raw: string, fallback: string) => {
    const first = raw.split("\n").map((line) => line.trim()).find((line) => line.length > 0);
    const cleaned = (first || fallback).replace(/^#+\s*/, "").replace(/^(Q\d+[:.)-]?|\d+[.)-]?|Question\s*\d*[:.)-]?)\s*/i, "").replace(/\s+/g, " ").trim();
    return cleaned.slice(0, 90) || fallback;
  };

  const buildSetTitle = (prefix: "MCQ" | "Flashcards", raw: string, selectedCategory?: string) => {
    const cat = selectedCategory && selectedCategory !== "Uncategorized"
      ? getCategoryDisplayName(selectedCategory)
      : inferContentTitle(raw, "Core Concepts");
    return `${prefix}: ${cat}`;
  };

  const parseDirectMcqs = (raw: string) => {
    const trimmed = raw.trim();
    const normalizeQuestion = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const toMcq = (item: any) => {
      if (!item?.question) return null;
      const question = String(item.question).replace(/^(Q\d+[:.)-]?|\d+[.)-]?|Question\s*\d*[:.)-]?)\s*/i, "").trim();
      const options = Array.isArray(item.options) ? item.options.slice(0, 4).map((o: any) => String(o).replace(/^[A-D][\).:\-]?\s*/i, "").trim()) : [];
      if (!question || options.length < 4) return null;
      let correct_answer = 0;
      if (Number.isInteger(item.correct_answer)) correct_answer = Math.min(Math.max(item.correct_answer, 0), 3);
      else if (Number.isInteger(item.correctIndex)) correct_answer = Math.min(Math.max(item.correctIndex, 0), 3);
      else if (typeof item.answer === "string") {
        const answerText = item.answer.trim().toUpperCase();
        if (/^[A-D]$/.test(answerText)) correct_answer = answerText.charCodeAt(0) - 65;
        if (/^[1-4]$/.test(answerText)) correct_answer = Number(answerText) - 1;
      }
      return { question, options, correct_answer, explanation: item.explanation ? String(item.explanation).trim() : undefined };
    };
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        const cleaned = parsed.map(toMcq).filter(Boolean) as any[];
        const uniq = new Map<string, any>();
        cleaned.forEach((q) => { const key = normalizeQuestion(q.question); if (!uniq.has(key)) uniq.set(key, q); });
        return Array.from(uniq.values());
      }
    } catch {}
    const blocks = trimmed.split(/\n\s*\n(?=\s*(?:Q?\d+[\).:-]|Question\s*\d*[:.)-]?))/i).map((b) => b.trim()).filter(Boolean);
    const parsed = blocks.map((block) => {
      const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
      if (!lines.length) return null;
      const questionLine = lines.find((l) => !/^[A-D][\).:\-]?\s+/i.test(l) && !/^(Answer|Correct|Explanation|Rationale)\s*[:\-]/i.test(l));
      if (!questionLine) return null;
      const question = questionLine.replace(/^(Q\d+[:.)-]?|\d+[.)-]?|Question\s*\d*[:.)-]?)\s*/i, "").trim();
      const options = lines.filter((l) => /^[A-D][\).:\-]?\s+/i.test(l)).map((l) => l.replace(/^[A-D][\).:\-]?\s+/i, "").trim()).slice(0, 4);
      if (!question || options.length < 4) return null;
      const answerLine = lines.find((l) => /^(Answer|Correct)\s*[:\-]/i.test(l));
      let correct_answer = 0;
      if (answerLine) {
        const answer = answerLine.replace(/^(Answer|Correct)\s*[:\-]\s*/i, "").trim();
        const upper = answer.toUpperCase();
        if (/^[A-D]$/.test(upper)) correct_answer = upper.charCodeAt(0) - 65;
        else if (/^[1-4]$/.test(answer)) correct_answer = Number(answer) - 1;
        else { const optIndex = options.findIndex((opt) => opt.toLowerCase() === answer.toLowerCase()); if (optIndex >= 0) correct_answer = optIndex; }
      }
      const explanationStart = lines.findIndex((l) => /^(Explanation|Rationale)\s*[:\-]/i.test(l));
      const explanation = explanationStart >= 0 ? lines.slice(explanationStart).join(" ").replace(/^(Explanation|Rationale)\s*[:\-]\s*/i, "").trim() : undefined;
      return { question, options, correct_answer, explanation };
    }).filter(Boolean) as any[];
    const uniq = new Map<string, any>();
    parsed.forEach((q) => { const key = normalizeQuestion(q.question); if (!uniq.has(key)) uniq.set(key, q); });
    return Array.from(uniq.values());
  };

  const parseDirectFlashcards = (raw: string) => {
    const trimmed = raw.trim();
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        const uniq = new Map<string, { question: string; answer: string }>();
        parsed.forEach((c) => {
          if (!c?.question || !c?.answer) return;
          const question = String(c.question).trim();
          const answer = String(c.answer).trim();
          if (!question || !answer) return;
          const key = question.toLowerCase().replace(/\s+/g, " ");
          if (!uniq.has(key)) uniq.set(key, { question, answer });
        });
        return Array.from(uniq.values());
      }
    } catch {}
    const pairs = trimmed.split(/\n\s*\n/).map((block) => block.trim()).filter(Boolean).map((block) => {
      const qMatch = block.match(/Q(?:uestion)?\s*[:\-]\s*([\s\S]*?)\nA(?:nswer)?\s*[:\-]\s*([\s\S]*)/i);
      if (qMatch) return { question: qMatch[1].trim(), answer: qMatch[2].trim() };
      const linePair = block.split(/\n|\t|\s+-\s+/).map((s) => s.trim()).filter(Boolean);
      if (linePair.length >= 2) return { question: linePair[0], answer: linePair.slice(1).join(" ") };
      return null;
    }).filter(Boolean) as { question: string; answer: string }[];
    const uniq = new Map<string, { question: string; answer: string }>();
    pairs.forEach((item) => { const key = item.question.toLowerCase().replace(/\s+/g, " "); if (!uniq.has(key)) uniq.set(key, item); });
    return Array.from(uniq.values());
  };

  const handleDirectPublishRaw = async () => {
    if (!directContent.trim()) { toast({ title: "Paste content first", variant: "destructive" }); return; }
    setLoading(true); setLoadingType("direct-raw");
    try {
      let finalCategory = directCategory;
      if (!finalCategory) { try { finalCategory = await autoCategorizе(directContent); } catch { finalCategory = "Uncategorized"; } }
      if (directType === "article") {
        const lines = directContent.trim().split("\n");
        const title = directTitle.trim() || lines[0]?.replace(/^#+\s*/, "").trim() || "Untitled";
        await saveArticle({ title, content: directContent, created_at: new Date().toISOString(), published: true, original_notes: directContent, category: finalCategory, is_raw: true } as any);
      } else if (directType === "mcqs") {
        const parsed = parseDirectMcqs(directContent);
        const limited = parsed.slice(0, clampRequestedCount(directTargetCount));
        if (!limited.length) throw new Error("Could not parse MCQs. Check format.");
        await saveMcqSet({ title: directTitle.trim() || `MCQ Set – ${new Date().toLocaleDateString()}`, questions: limited, created_at: new Date().toISOString(), published: true, original_notes: directContent, category: finalCategory, access_password: "", is_raw: true } as any);
      } else {
        const parsed = parseDirectFlashcards(directContent);
        const limited = parsed.slice(0, clampRequestedCount(directTargetCount));
        if (!limited.length) throw new Error("Could not parse flashcards. Check format.");
        await saveFlashcardSet({ title: directTitle.trim() || `Flashcards – ${new Date().toLocaleDateString()}`, cards: limited, created_at: new Date().toISOString(), published: true, original_notes: directContent, category: finalCategory, is_raw: true } as any);
      }
      toast({ title: "Published instantly! Go to the Raw tab to format with Gemini later." });
      setDirectContent(""); setDirectTitle(""); setDirectCategory("");
    } catch (err: any) {
      toast({ title: "Publish failed", description: err.message, variant: "destructive" });
    } finally { setLoading(false); setLoadingType(null); }
  };

  const handleFormatDirect = async () => {
    if (!directContent.trim()) { toast({ title: "Paste content first", variant: "destructive" }); return; }
    setLoading(true); setLoadingType("direct");
    try {
      if (directType === "article") {
        const { data, error } = await supabase.functions.invoke('generate-content', { body: { notes: directContent, type: 'direct-article', geminiKey, title: directTitle.trim() } });
        if (error) throw new Error(error.message);
        if (data?.error) throw new Error(data.error);
        setDirectPreviewArticle({ title: data.title, content: data.content });
        setDirectPreviewCards(null); setDirectPreviewMcqs(null);
        toast({ title: "Article formatted by Gemini" });
      } else if (directType === "mcqs") {
        const { data, error } = await supabase.functions.invoke('generate-content', { body: { notes: directContent, type: 'direct-mcqs', geminiKey, count: clampRequestedCount(directTargetCount) } });
        if (error) throw new Error(error.message);
        if (data?.error) throw new Error(data.error);
        if (!Array.isArray(data) || data.length === 0) {
          const parsed = parseDirectMcqs(directContent);
          const limited = parsed.slice(0, clampRequestedCount(directTargetCount));
          if (!limited.length) throw new Error("Could not parse MCQs.");
          setDirectPreviewMcqs(limited);
        } else { setDirectPreviewMcqs(data); }
        setDirectPreviewArticle(null); setDirectPreviewCards(null);
        toast({ title: "Formatted MCQs via Gemini" });
      } else {
        const { data, error } = await supabase.functions.invoke('generate-content', { body: { notes: directContent, type: 'direct-flashcards', geminiKey, count: clampRequestedCount(directTargetCount) } });
        if (error) throw new Error(error.message);
        if (data?.error) throw new Error(data.error);
        if (!Array.isArray(data) || data.length === 0) {
          const parsed = parseDirectFlashcards(directContent);
          const limited = parsed.slice(0, clampRequestedCount(directTargetCount));
          if (!limited.length) throw new Error("Could not parse flashcards.");
          setDirectPreviewCards(limited);
        } else { setDirectPreviewCards(data); }
        setDirectPreviewArticle(null); setDirectPreviewMcqs(null);
        toast({ title: "Formatted flashcards via Gemini" });
      }
    } catch (err: any) {
      toast({ title: "Gemini format failed", description: err.message, variant: "destructive" });
    } finally { setLoading(false); setLoadingType(null); }
  };

  const handleDirectSave = async (publish: boolean) => {
    try {
      const finalCategory = directCategory || "Uncategorized";
      if (directPreviewArticle) {
        await saveArticle({ title: directPreviewArticle.title, content: directPreviewArticle.content, created_at: new Date().toISOString(), published: publish, original_notes: directContent, category: finalCategory });
      } else if (directPreviewMcqs) {
        await saveMcqSet({ title: directTitle.trim() || buildSetTitle("MCQ", directContent, finalCategory), questions: directPreviewMcqs, created_at: new Date().toISOString(), published: publish, original_notes: directContent, category: finalCategory, access_password: "" });
      } else if (directPreviewCards) {
        await saveFlashcardSet({ title: directTitle.trim() || buildSetTitle("Flashcards", directContent, finalCategory), cards: directPreviewCards, created_at: new Date().toISOString(), published: publish, original_notes: directContent, category: finalCategory });
      } else {
        toast({ title: "No preview yet", description: "Click Format with Gemini first, or use Direct Publish.", variant: "destructive" });
        return;
      }
      toast({ title: publish ? "Published!" : "Draft saved!" });
      setDirectContent(""); setDirectTitle(""); setDirectPreviewArticle(null); setDirectPreviewCards(null); setDirectPreviewMcqs(null);
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    }
  };

  const handleGenerate = async (type: "article" | "flashcards" | "mcqs") => {
    if (!notes.trim()) { toast({ title: "Please enter some notes", variant: "destructive" }); return; }
    setLoading(true); setLoadingType(type);
    try {
      let cat = category;
      if (!cat) { cat = await autoCategorizе(notes); setCategory(cat); }
      if (type === "article") {
        const result = await generateArticle(notes);
        setPreviewArticle(result); setPreviewTitle(result.title); setPreviewContent(result.content); setPreviewCards(null); setPreviewMcqs(null);
      } else if (type === "mcqs") {
        const questions = await generateMcqs(notes, mcqCount);
        setPreviewMcqs(questions); setPreviewTitle(buildSetTitle("MCQ", notes, cat)); setPreviewArticle(null); setPreviewCards(null);
      } else {
        const cards = await generateFlashcards(notes, cardCount);
        setPreviewCards(cards); setPreviewTitle(buildSetTitle("Flashcards", notes, cat)); setPreviewArticle(null); setPreviewMcqs(null);
      }
      toast({ title: "Content generated!" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setLoading(false); setLoadingType(null); }
  };

  const handleGenerateAll = async () => {
    if (!notes.trim()) { toast({ title: "Please enter some notes", variant: "destructive" }); return; }
    const types = [genArticle && "article", genFlashcards && "flashcards", genMcqs && "mcqs"].filter(Boolean);
    if (!types.length) { toast({ title: "Select at least one content type", variant: "destructive" }); return; }
    setLoading(true); setLoadingType("all");
    try {
      let cat = category;
      if (!cat) { cat = await autoCategorizе(notes); setCategory(cat); }
      setBatchCategory(cat);
      const [articleResult, flashcardResult, mcqResult] = await Promise.all([
        genArticle ? generateArticle(notes) : Promise.resolve(null),
        genFlashcards ? generateFlashcards(notes, cardCount) : Promise.resolve(null),
        genMcqs ? generateMcqs(notes, mcqCount) : Promise.resolve(null),
      ]);
      setBatchArticle(articleResult); setBatchCards(flashcardResult); setBatchMcqs(mcqResult);
      setBatchTitle((articleResult as any)?.title || inferContentTitle(notes, "Study Notes"));
      toast({ title: "Content generated! Review and publish below." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setLoading(false); setLoadingType(null); }
  };

  const handleRegenerateBatch = async (type: "article" | "flashcards" | "mcqs") => {
    setLoading(true); setLoadingType(type);
    try {
      if (type === "article") { const r = await generateArticle(notes); setBatchArticle(r); setBatchTitle(r.title); }
      else if (type === "flashcards") { setBatchCards(await generateFlashcards(notes, cardCount)); }
      else { setBatchMcqs(await generateMcqs(notes, mcqCount)); }
      toast({ title: `${type} regenerated!` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setLoading(false); setLoadingType(null); }
  };

  const handlePublishAll = async () => {
    setLoading(true);
    try {
      const cat = batchCategory || category || "Uncategorized";
      const saves: Promise<any>[] = [];
      if (batchArticle) saves.push(saveArticle({ title: batchArticle.title, content: batchArticle.content, created_at: new Date().toISOString(), published: true, original_notes: notes, category: cat }));
      if (batchCards) saves.push(saveFlashcardSet({ title: buildSetTitle("Flashcards", batchTitle || notes, cat), cards: batchCards, created_at: new Date().toISOString(), published: true, original_notes: notes, category: cat }));
      if (batchMcqs) saves.push(saveMcqSet({ title: buildSetTitle("MCQ", batchTitle || notes, cat), questions: batchMcqs, created_at: new Date().toISOString(), published: true, original_notes: notes, category: cat, access_password: "" }));
      await Promise.all(saves);
      toast({ title: "All content published!" });
      setBatchArticle(null); setBatchCards(null); setBatchMcqs(null); setNotes(""); setCategory("");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setLoading(false); }
  };

  const handleSave = async (publish: boolean) => {
    try {
      const cat = category || "Uncategorized";
      if (previewArticle) await saveArticle({ title: previewTitle, content: previewContent, created_at: new Date().toISOString(), published: publish, original_notes: notes, category: cat });
      else if (previewCards) await saveFlashcardSet({ title: previewTitle, cards: previewCards, created_at: new Date().toISOString(), published: publish, original_notes: notes, category: cat });
      else if (previewMcqs) await saveMcqSet({ title: previewTitle, questions: previewMcqs, created_at: new Date().toISOString(), published: publish, original_notes: notes, category: cat, access_password: "" });
      toast({ title: publish ? "Published!" : "Draft saved!" });
      setPreviewArticle(null); setPreviewCards(null); setPreviewMcqs(null); setNotes(""); setCategory("");
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    }
  };

  const hasBatchPreview = batchArticle || batchCards || batchMcqs;

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "create", label: "Create", icon: FileText },
    { id: "unedited", label: "Unedited Uploads", icon: AlertTriangle },
    { id: "editor", label: "Editor", icon: Edit3 },
    { id: "articles", label: "Articles", icon: FileText },
    { id: "categories", label: "Categories", icon: Layers },
    { id: "flashcards", label: "Flashcards", icon: Layers },
    { id: "mcqs", label: "MCQs", icon: ListChecks },
    { id: "stories", label: "Stories", icon: BookOpen },
    { id: "exams", label: "Exam Results", icon: ListChecks },
    { id: "corrections", label: "Corrections", icon: Pencil },
    { id: "meta-manager", label: "Meta Manager", icon: Globe },
    { id: "raw", label: "Raw", icon: AlertTriangle },
    { id: "upgrade", label: "AI Upgrade", icon: Sparkles },
    { id: "cleanup", label: "Bulk Cleanup", icon: Wrench },
    { id: "seo", label: "SEO & Indexing", icon: Globe },
    { id: "institutions", label: "Institutions", icon: Building2 },
    { id: "import", label: "Import", icon: Upload },
    { id: "payments", label: "Payments", icon: Settings },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  const activeTab = tabs.find(t => t.id === tab);

  const tabGroups = [
    { label: "Content", items: tabs.filter(t => ["create","unedited","editor","articles","categories","flashcards","mcqs","stories","exams","corrections"].includes(t.id)) },
    { label: "Tools", items: tabs.filter(t => ["meta-manager","upgrade","cleanup","seo"].includes(t.id)) },
    { label: "Data", items: tabs.filter(t => ["raw","import"].includes(t.id)) },
    { label: "System", items: tabs.filter(t => ["institutions","payments","notifications","settings"].includes(t.id)) },
  ];

  return (
    <div className="mx-auto max-w-5xl px-3 sm:px-6 py-4 sm:py-8">
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
      <div className="mb-4 sm:mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-2xl sm:text-3xl font-bold text-foreground">Dashboard</h1>
        <button
          type="button"
          onClick={() => navigate("/admin/notifications")}
          className="inline-flex items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/10 px-3.5 py-2 text-xs font-bold text-primary hover:bg-primary/20 transition-colors shadow-2xs"
        >
          <Bell className="h-4 w-4" />
          <span>Broadcast Studio (Send Alerts)</span>
        </button>
      </div>

      {/* Mobile: Dropdown + grid */}
      <div className="mb-6 sm:hidden">
        <button
          onClick={() => {
            const el = document.getElementById("admin-nav-panel");
            if (el) el.classList.toggle("hidden");
          }}
          className="flex w-full items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium text-foreground shadow-sm"
        >
          <span className="flex items-center gap-2">
            {activeTab && <activeTab.icon className="h-4 w-4 text-primary" />}
            {activeTab?.label || "Navigate"}
          </span>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </button>
        <div id="admin-nav-panel" className="hidden mt-2 rounded-xl border border-border bg-card p-3 shadow-lg space-y-3">
          {tabGroups.map(group => (
            <div key={group.label}>
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{group.label}</p>
              <div className="grid grid-cols-3 gap-1.5">
                {group.items.map(t => (
                  <button key={t.id} onClick={() => { if (t.id === "unedited") { navigate("/source-library"); return; } if (t.id === "editor") { navigate("/admin/editor"); return; } if (t.id === "categories") { navigate("/admin/categories"); return; } setTabAndHash(t.id); document.getElementById("admin-nav-panel")?.classList.add("hidden"); }}
                    className={`flex flex-col items-center gap-1 rounded-lg px-2 py-2.5 text-[11px] font-medium transition-colors ${tab === t.id ? "bg-primary/10 text-primary ring-1 ring-primary/30" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}>
                    <t.icon className="h-4 w-4" />
                    <span className="text-center leading-tight">{t.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Desktop: Horizontal tabs */}
      <div className="mb-8 hidden sm:flex gap-1 rounded-xl border border-border bg-secondary/50 p-1 overflow-x-auto">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => { if (t.id === "unedited") { navigate("/source-library"); return; } if (t.id === "editor") { navigate("/admin/editor"); return; } if (t.id === "categories") { navigate("/admin/categories"); return; } setTabAndHash(t.id); }}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap ${tab === t.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
            <t.icon className="h-4 w-4" />{t.label}
          </button>
        ))}
      </div>

      {tab === "payments" && <PaymentSettingsAdmin />}
      {tab === "notifications" && <NotificationAdmin />}

      {tab === "corrections" && (
        <div>
          <h2 className="mb-1 font-serif text-xl font-bold text-foreground">Plate corrections</h2>
          <p className="mb-4 text-sm text-muted-foreground">Reader-submitted label fixes with the plate image and current answer key for one-glance approval.</p>
          <SlideCorrectionsAdmin />
        </div>
      )}

      {tab === "create" && (
        <div>
          <Textarea placeholder="Paste your notes here..." value={notes} onChange={(e) => setNotes(e.target.value)} className="mb-4 min-h-[200px] resize-y" />
          <div className="mb-4">
            <label className="mb-2 block text-sm font-medium text-foreground">Unit/Category</label>
            <CategorySelector 
              value={category} 
              onChange={setCategory} 
              customCategories={customCategories} 
            />
            {!category && <p className="mt-1 text-[10px] text-muted-foreground italic">If left empty, AI will auto-detect the unit.</p>}
          </div>
          <div className="mb-4 grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-border bg-card p-3">
              <label className="mb-2 block text-sm font-medium text-foreground">Flashcards (5-100)</label>
              <div className="flex items-center gap-2">
                <Input type="number" min={5} max={100} value={cardCount} onChange={(e) => setCardCount(clampRequestedCount(Number(e.target.value) || 20))} className="w-24" />
                <div className="flex flex-wrap gap-1">
                  {[10, 20, 30, 50, 80, 100].map((n) => (
                    <button key={n} onClick={() => setCardCount(n)} className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${cardCount === n ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}>{n}</button>
                  ))}
                </div>
              </div>
            </div>
            <div className="rounded-lg border border-border bg-card p-3">
              <label className="mb-2 block text-sm font-medium text-foreground">MCQs (5-100)</label>
              <div className="flex items-center gap-2">
                <Input type="number" min={5} max={100} value={mcqCount} onChange={(e) => setMcqCount(clampRequestedCount(Number(e.target.value) || 15))} className="w-24" />
                <div className="flex flex-wrap gap-1">
                  {[10, 15, 20, 30, 50, 80, 100].map((n) => (
                    <button key={n} onClick={() => setMcqCount(n)} className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${mcqCount === n ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}>{n}</button>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="mb-4 rounded-xl border border-primary/30 bg-primary/5 p-4">
            <div className="mb-3 flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              <h3 className="text-sm font-bold text-foreground">Generate All at Once</h3>
            </div>
            <div className="mb-3 flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer"><input type="checkbox" checked={genArticle} onChange={(e) => setGenArticle(e.target.checked)} className="accent-primary" /> Article</label>
              <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer"><input type="checkbox" checked={genFlashcards} onChange={(e) => setGenFlashcards(e.target.checked)} className="accent-primary" /> {cardCount} Flashcards</label>
              <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer"><input type="checkbox" checked={genMcqs} onChange={(e) => setGenMcqs(e.target.checked)} className="accent-primary" /> {mcqCount} MCQs</label>
            </div>
            <Button onClick={handleGenerateAll} disabled={loading} className="gap-2">
              {loading && loadingType === "all" && <Loader2 className="h-4 w-4 animate-spin" />}
              <Zap className="h-4 w-4" />
              {loading && loadingType === "all" ? "Generating..." : "Generate All (Preview First)"}
            </Button>
          </div>
          {hasBatchPreview && (
            <div className="mb-8 space-y-4 rounded-xl border-2 border-primary/40 bg-primary/5 p-6">
              <div className="flex items-center justify-between">
                <h3 className="font-serif text-lg font-bold text-foreground">Review Generated Content</h3>
                <div className="text-xs rounded-full bg-primary/20 px-3 py-1 text-primary font-medium">{batchCategory}</div>
              </div>
              {batchArticle && (
                <div className="rounded-lg border border-border bg-card p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-bold text-foreground">Article</h4>
                    <Button size="sm" variant="ghost" onClick={() => handleRegenerateBatch("article")} disabled={loading} className="gap-1 text-xs"><RefreshCw className="h-3 w-3" /> Regenerate</Button>
                  </div>
                  <p className="text-sm font-medium text-foreground">{batchArticle.title}</p>
                  <p className="text-xs text-muted-foreground mt-1">{batchArticle.content.slice(0, 150)}...</p>
                </div>
              )}
              {batchCards && (
                <div className="rounded-lg border border-border bg-card p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-bold text-foreground">Flashcards ({batchCards.length})</h4>
                    <Button size="sm" variant="ghost" onClick={() => handleRegenerateBatch("flashcards")} disabled={loading} className="gap-1 text-xs"><RefreshCw className="h-3 w-3" /> Regenerate</Button>
                  </div>
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {batchCards.slice(0, 3).map((c, i) => <p key={i} className="text-xs text-muted-foreground">Q: {c.question}</p>)}
                    {batchCards.length > 3 && <p className="text-xs text-muted-foreground">...and {batchCards.length - 3} more</p>}
                  </div>
                </div>
              )}
              {batchMcqs && (
                <div className="rounded-lg border border-border bg-card p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-bold text-foreground">MCQs ({batchMcqs.length})</h4>
                    <Button size="sm" variant="ghost" onClick={() => handleRegenerateBatch("mcqs")} disabled={loading} className="gap-1 text-xs"><RefreshCw className="h-3 w-3" /> Regenerate</Button>
                  </div>
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {batchMcqs.slice(0, 3).map((q, i) => <p key={i} className="text-xs text-muted-foreground">{i + 1}. {q.question}</p>)}
                    {batchMcqs.length > 3 && <p className="text-xs text-muted-foreground">...and {batchMcqs.length - 3} more</p>}
                  </div>
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <Button onClick={handlePublishAll} disabled={loading} className="gap-2">{loading && <Loader2 className="h-4 w-4 animate-spin" />} Publish All</Button>
                <Button variant="outline" onClick={() => { setBatchArticle(null); setBatchCards(null); setBatchMcqs(null); }}>Discard</Button>
              </div>
            </div>
          )}
          <div className="mb-8 flex flex-wrap gap-3">
            <Button onClick={() => handleGenerate("article")} disabled={loading} variant="outline" className="gap-2">
              {loading && loadingType === "article" && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading && loadingType === "article" ? "Generating..." : "Generate Article"}
            </Button>
            <Button onClick={() => handleGenerate("flashcards")} disabled={loading} variant="outline" className="gap-2">
              {loading && loadingType === "flashcards" && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading && loadingType === "flashcards" ? "Generating..." : `Generate ${cardCount} Flashcards`}
            </Button>
            <Button onClick={() => handleGenerate("mcqs")} disabled={loading} variant="outline" className="gap-2">
              {loading && loadingType === "mcqs" && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading && loadingType === "mcqs" ? "Generating..." : `Generate ${mcqCount} MCQs`}
            </Button>
          </div>
          {previewArticle && (
            <div className="rounded-xl border border-border bg-card p-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-serif text-lg font-bold text-foreground">Article Preview</h3>
                <Button size="sm" variant="ghost" onClick={() => handleGenerate("article")} disabled={loading} className="gap-1"><RefreshCw className="h-3 w-3" /> Regenerate</Button>
              </div>
              <Input value={previewTitle} onChange={(e) => setPreviewTitle(e.target.value)} className="mb-3 font-bold" placeholder="Title" />
              <Textarea value={previewContent} onChange={(e) => setPreviewContent(e.target.value)} className="mb-4 min-h-[200px]" />
              <div className="flex flex-wrap gap-3">
                <Button onClick={() => handleSave(false)} variant="outline">Save Draft</Button>
                <Button onClick={() => handleSave(true)}>Publish</Button>
              </div>
            </div>
          )}
          {previewCards && (
            <div className="rounded-xl border border-border bg-card p-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-serif text-lg font-bold text-foreground">Flashcard Preview ({previewCards.length})</h3>
                <Button size="sm" variant="ghost" onClick={() => handleGenerate("flashcards")} disabled={loading} className="gap-1"><RefreshCw className="h-3 w-3" /> Regenerate</Button>
              </div>
              <Input value={previewTitle} onChange={(e) => setPreviewTitle(e.target.value)} className="mb-4" placeholder="Set title" />
              <div className="mb-4 grid gap-2 max-h-96 overflow-y-auto">
                {previewCards.map((c, i) => (
                  <div key={i} className="rounded-lg border border-border bg-secondary/30 p-3">
                    <p className="text-sm font-medium text-foreground">Q: {c.question}</p>
                    <p className="text-sm text-muted-foreground">A: {c.answer}</p>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-3">
                <Button onClick={() => handleSave(false)} variant="outline">Save Draft</Button>
                <Button onClick={() => handleSave(true)}>Publish</Button>
              </div>
            </div>
          )}
          {previewMcqs && (
            <div className="rounded-xl border border-border bg-card p-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-serif text-lg font-bold text-foreground">MCQ Preview ({previewMcqs.length})</h3>
                <Button size="sm" variant="ghost" onClick={() => handleGenerate("mcqs")} disabled={loading} className="gap-1"><RefreshCw className="h-3 w-3" /> Regenerate</Button>
              </div>
              <Input value={previewTitle} onChange={(e) => setPreviewTitle(e.target.value)} className="mb-4" placeholder="Quiz title" />
              <div className="mb-4 grid gap-3 max-h-96 overflow-y-auto">
                {previewMcqs.map((q, i) => (
                  <div key={i} className="rounded-lg border border-border bg-secondary/30 p-3">
                    <p className="text-sm font-medium text-foreground mb-1">{i + 1}. {q.question}</p>
                    {q.options.map((opt, j) => (
                      <p key={j} className={`text-sm ml-4 ${j === q.correct_answer ? "text-primary font-medium" : "text-muted-foreground"}`}>
                        {String.fromCharCode(65 + j)}) {opt} {j === q.correct_answer ? "✓" : ""}
                      </p>
                    ))}
                    {q.explanation && <p className="mt-1 ml-4 text-xs text-muted-foreground italic">{q.explanation}</p>}
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-3">
                <Button onClick={() => handleSave(false)} variant="outline">Save Draft</Button>
                <Button onClick={() => handleSave(true)}>Publish</Button>
              </div>
            </div>
          )}
          <div className="mt-8 rounded-xl border border-border bg-card p-6">
            <h3 className="mb-1 font-serif text-lg font-bold text-foreground">Direct Publish Mode</h3>
            <p className="mb-4 text-sm text-muted-foreground">
              <strong>Direct Publish (No AI)</strong> saves instantly. Items land in the Raw tab for bulk Gemini formatting later.
            </p>
            <div className="mb-4 grid gap-4 md:grid-cols-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">Content Type</label>
                <select value={directType} onChange={(e) => setDirectType(e.target.value as DirectType)} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground">
                  <option value="article">Article</option>
                  <option value="mcqs">MCQs</option>
                  <option value="flashcards">Flashcards</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">Unit/Category</label>
                <CategorySelector 
                  value={directCategory} 
                  onChange={setDirectCategory} 
                  customCategories={customCategories} 
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">Title (optional)</label>
                <Input value={directTitle} onChange={(e) => setDirectTitle(e.target.value)} placeholder="Custom title" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">{directType === "article" ? "Preview" : "Target count"}</label>
                {directType === "article"
                  ? <div className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-muted-foreground">Auto format</div>
                  : <Input type="number" min={5} max={100} value={directTargetCount} onChange={(e) => setDirectTargetCount(clampRequestedCount(Number(e.target.value) || 20))} />
                }
              </div>
            </div>
            <Textarea value={directContent} onChange={(e) => setDirectContent(e.target.value)}
              placeholder={directType === "article" ? "Paste article markdown/plain text" : directType === "mcqs" ? "Paste MCQs JSON or Q1 + A) B) C) D) format" : "Paste flashcards JSON or Q:/A: format"}
              className="mb-4 min-h-[180px]" />
            <div className="mb-4 flex flex-wrap gap-3">
              <Button onClick={handleDirectPublishRaw} disabled={loading} className="gap-2 bg-amber-600 hover:bg-amber-700 text-white border-0">
                {loading && loadingType === "direct-raw" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bolt className="h-4 w-4" />}
                {loading && loadingType === "direct-raw" ? "Saving..." : "Direct Publish (No AI)"}
              </Button>
              <Button onClick={handleFormatDirect} variant="outline" disabled={loading} className="gap-2">
                {loading && loadingType === "direct" && <Loader2 className="h-4 w-4 animate-spin" />}
                {loading && loadingType === "direct" ? "Formatting..." : "Format with Gemini"}
              </Button>
              <Button onClick={() => handleDirectSave(false)} variant="outline" disabled={loading}>Save Draft</Button>
              <Button onClick={() => handleDirectSave(true)} disabled={loading}>Publish (Formatted)</Button>
            </div>
            {directPreviewArticle && (
              <div className="rounded-lg border border-border bg-secondary/30 p-4">
                <p className="font-medium text-foreground">{directPreviewArticle.title}</p>
                <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{directPreviewArticle.content.slice(0, 500)}...</p>
              </div>
            )}
            {directPreviewMcqs && (
              <div className="rounded-lg border border-border bg-secondary/30 p-4">
                <p className="mb-2 font-medium text-foreground">Parsed MCQs: {directPreviewMcqs.length}</p>
                {directPreviewMcqs.slice(0, 2).map((q, i) => <p key={i} className="text-sm text-muted-foreground">{i + 1}. {q.question}</p>)}
              </div>
            )}
            {directPreviewCards && (
              <div className="rounded-lg border border-border bg-secondary/30 p-4">
                <p className="mb-2 font-medium text-foreground">Parsed Flashcards: {directPreviewCards.length}</p>
                {directPreviewCards.slice(0, 2).map((c, i) => <p key={i} className="text-sm text-muted-foreground">Q: {c.question}</p>)}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "articles" && <ArticlesList initialEditId={articleEditId} onEditOpened={() => setArticleEditId(null)} />}
      {tab === "categories" && <CategoriesTab />}
      {tab === "flashcards" && <FlashcardsList />}
      {tab === "mcqs" && <McqsList />}
      {tab === "stories" && <StoriesTab />}
      {tab === "exams" && <ExamResultsTab />}
      {tab === "meta-manager" && <MetaManagerTab />}
      {tab === "raw" && <RawContentTab geminiKey={geminiKey} />}
      
      {tab === "institutions" && <InstitutionsTab />}
      {tab === "upgrade" && <ContentUpgradeTab />}
      {tab === "cleanup" && <BulkCleanupTab onEditArticle={(id) => { setArticleEditId(id); setTabAndHash("articles"); }} />}
      {tab === "seo" && <SeoIndexingTab />}
      {tab === "import" && <ImportTab />}
      {tab === "settings" && <SettingsPanel setGeminiKey={setGeminiKey} />}
    </div>
  );
}

// ===== SHARED UI COMPONENTS =====

function CategorySelector({
  value,
  onChange,
  customCategories,
}: {
  value: string;
  onChange: (val: string) => void;
  customCategories: ArticleCategory[];
}) {
  const [isTyping, setIsTyping] = useState(false);
  const [inputValue, setInputValue] = useState("");

  const allOptions = [
    ...UNIT_CATEGORIES,
    ...customCategories.map((c) => c.name),
    "Uncategorized",
  ];

  if (isTyping) {
    return (
      <div className="flex gap-2">
        <Input
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            onChange(e.target.value);
          }}
          placeholder="Type new category..."
          className="flex-1 text-sm h-9"
          autoFocus
        />
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setIsTyping(false);
            if (!inputValue.trim()) onChange("Uncategorized");
          }}
          className="h-9 px-2 text-xs"
        >
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <select
        value={allOptions.includes(value) ? value : "Other"}
        onChange={(e) => {
          if (e.target.value === "Other") {
            setIsTyping(true);
            setInputValue("");
          } else {
            onChange(e.target.value);
          }
        }}
        className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:ring-1 focus:ring-primary h-9"
      >
        <optgroup label="Standard Units">
          {UNIT_CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </optgroup>
        {customCategories.length > 0 && (
          <optgroup label="Custom Categories">
            {customCategories.map((c) => (
              <option key={c.id} value={c.name}>{c.name}</option>
            ))}
          </optgroup>
        )}
        <option value="Uncategorized">Uncategorized</option>
        <option value="Other">+ Type New Category...</option>
      </select>
      {!allOptions.includes(value) && value && (
        <div className="flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-[10px] font-bold text-primary border border-primary/20">
          NEW: {value}
        </div>
      )}
    </div>
  );
}

// ===== CATEGORIES TAB =====
function CategoriesTab() {
  const [categories, setCategories] = useState<ArticleCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const { isAdmin, loading: authLoading } = useAuth();

  const refresh = async () => {
    setLoading(true);
    try {
      const data = await getArticleCategories();
      setCategories(data);
    } catch (err: any) {
      toast({ title: "Failed to load categories", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      await saveArticleCategory(newName);
      setNewName("");
      await refresh();
      toast({ title: "Category added!" });
    } catch (err: any) {
      toast({ title: "Failed to add", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure? Articles in this category will become 'Uncategorized'.")) return;
    try {
      await deleteArticleCategory(id);
      await refresh();
      toast({ title: "Category deleted" });
    } catch (err: any) {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    }
  };

  if (loading) return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />;

  return (
    <div className="max-w-2xl">
      <div className="mb-6 rounded-xl border border-border bg-card p-5">
        <h3 className="mb-4 font-serif text-lg font-bold text-foreground">Manage Article Categories</h3>
        <div className="flex gap-2">
          <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Category name (e.g. Clinical Pharmacology)" className="flex-1" />
          <Button onClick={handleAdd} disabled={saving || !newName.trim()} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Layers className="h-4 w-4" />}
            Add Category
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        {categories.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground">No custom categories yet.</p>
        ) : (
          categories.map((c) => (
            <div key={c.id} className="flex items-center justify-between rounded-lg border border-border bg-card p-3">
              <span className="font-medium text-foreground">{c.name}</span>
              <Button size="sm" variant="ghost" onClick={() => handleDelete(c.id)} className="text-destructive h-8 w-8 p-0">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ===== RAW CONTENT TAB =====
function RawContentTab({ geminiKey }: { geminiKey: string }) {
  const { toast } = useToast();
  const { isAdmin, loading: authLoading } = useAuth();
  const [articles, setArticles] = useState<Article[]>([]);
  const [flashcardSets, setFlashcardSets] = useState<FlashcardSet[]>([]);
  const [mcqSets, setMcqSets] = useState<McqSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [formatting, setFormatting] = useState(false);
  const [currentItem, setCurrentItem] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ current: number; total: number; label: string } | null>(null);

  const refresh = async () => {
    setLoading(true);
    const [arts, flashcards, mcqs] = await Promise.all([getArticles(), getFlashcardSets(), getMcqSets()]);
    setArticles(arts.filter((a: any) => a.is_raw === true));
    setFlashcardSets(flashcards.filter((f: any) => f.is_raw === true));
    setMcqSets(mcqs.filter((m: any) => m.is_raw === true));
    setLoading(false);
  };

  useEffect(() => { refresh(); }, []);

  const totalRaw = articles.length + flashcardSets.length + mcqSets.length;

  const formatArticleWithGemini = async (article: Article) => {
    const { data, error } = await supabase.functions.invoke('generate-content', {
      body: { notes: (article as any).original_notes || article.content, type: 'direct-article', geminiKey, title: article.title },
    });
    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(data.error);
    await saveArticle({ ...article, title: data.title, content: data.content, is_raw: false } as any);
  };

  const formatFlashcardsWithGemini = async (set: FlashcardSet) => {
    const { data, error } = await supabase.functions.invoke('generate-content', {
      body: { notes: (set as any).original_notes || JSON.stringify(set.cards), type: 'direct-flashcards', geminiKey, count: Math.max(set.cards.length, 10) },
    });
    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(data.error);
    const cards = Array.isArray(data) && data.length > 0 ? data : set.cards;
    await saveFlashcardSet({ ...set, cards, is_raw: false } as any);
  };

  const formatMcqsWithGemini = async (set: McqSet) => {
    const { data, error } = await supabase.functions.invoke('generate-content', {
      body: { notes: (set as any).original_notes || JSON.stringify(set.questions), type: 'direct-mcqs', geminiKey, count: Math.max(set.questions.length, 10) },
    });
    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(data.error);
    const questions = Array.isArray(data) && data.length > 0 ? data : set.questions;
    await saveMcqSet({ ...set, questions, is_raw: false } as any);
  };

  const handleFormatAll = async () => {
    if (totalRaw === 0) return;
    setFormatting(true);
    let current = 0;
    const total = totalRaw;
    let errors = 0;
    for (const article of articles) {
      current++;
      setProgress({ current, total, label: `Formatting article: ${article.title.slice(0, 45)}...` });
      try { await formatArticleWithGemini(article); } catch { errors++; }
    }
    for (const set of flashcardSets) {
      current++;
      setProgress({ current, total, label: `Formatting flashcards: ${set.title.slice(0, 45)}...` });
      try { await formatFlashcardsWithGemini(set); } catch { errors++; }
    }
    for (const set of mcqSets) {
      current++;
      setProgress({ current, total, label: `Formatting MCQs: ${set.title.slice(0, 45)}...` });
      try { await formatMcqsWithGemini(set); } catch { errors++; }
    }
    setProgress(null);
    setFormatting(false);
    toast({ title: errors === 0 ? `All ${total} items formatted!` : `Done — ${errors} item(s) failed`, description: errors > 0 ? "Failed items remain in the Raw tab." : undefined });
    await refresh();
  };

  const handleFormatOne = async (type: "article" | "flashcards" | "mcqs", item: any) => {
    setCurrentItem(item.id);
    try {
      if (type === "article") await formatArticleWithGemini(item);
      else if (type === "flashcards") await formatFlashcardsWithGemini(item);
      else await formatMcqsWithGemini(item);
      toast({ title: "Formatted!" });
      await refresh();
    } catch (err: any) {
      toast({ title: "Format failed", description: err.message, variant: "destructive" });
    } finally { setCurrentItem(null); }
  };

  const handleDelete = async (type: "article" | "flashcards" | "mcqs", id: string) => {
    if (type === "article") await deleteArticle(id);
    else if (type === "flashcards") await deleteFlashcardSet(id);
    else await deleteMcqSet(id);
    toast({ title: "Deleted" });
    await refresh();
  };

  if (loading) return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />;

  return (
    <div>
      <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              <h3 className="font-serif text-lg font-bold text-foreground">Raw / Unformatted Content</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              {totalRaw === 0 ? "No raw content — everything is formatted!" : `${totalRaw} item${totalRaw > 1 ? "s" : ""} waiting to be formatted with Gemini.`}
            </p>
          </div>
          {totalRaw > 0 && (
            <Button onClick={handleFormatAll} disabled={formatting} className="gap-2 shrink-0 bg-amber-600 hover:bg-amber-700 text-white border-0">
              {formatting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              {formatting ? "Formatting..." : `Format All ${totalRaw} with Gemini`}
            </Button>
          )}
        </div>
        {progress && (
          <div className="mt-4">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs font-medium text-foreground">{progress.label}</span>
              <span className="text-xs text-muted-foreground">{progress.current}/{progress.total}</span>
            </div>
            <div className="h-2 w-full rounded-full bg-amber-200 overflow-hidden">
              <div className="h-full rounded-full bg-amber-600 transition-all duration-300" style={{ width: `${(progress.current / progress.total) * 100}%` }} />
            </div>
          </div>
        )}
      </div>
      {totalRaw === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-4xl mb-3">✅</p>
          <p className="font-medium text-foreground">All content is formatted</p>
          <p className="text-sm mt-1">Use Direct Publish in the Create tab to add raw content here.</p>
        </div>
      )}
      {articles.length > 0 && (
        <div className="mb-6">
          <h4 className="mb-3 text-sm font-bold text-foreground uppercase tracking-wide">Articles ({articles.length})</h4>
          <div className="space-y-2">
            {articles.map((a) => (
              <div key={a.id} className="rounded-xl border border-amber-500/20 bg-card p-3 sm:p-4">
                <div className="min-w-0">
                  <h5 className="font-medium text-foreground text-sm break-words">{a.title}</h5>
                  <p className="text-xs text-muted-foreground mt-0.5">{a.category} · {new Date(a.created_at).toLocaleDateString()}</p>
                </div>
                <div className="flex gap-2 mt-2 pt-2 border-t border-border/50">
                  <Button size="sm" onClick={() => handleFormatOne("article", a)} disabled={formatting || currentItem === a.id} className="gap-1 text-xs h-8">
                    {currentItem === a.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />} Format
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleDelete("article", a.id)} className="text-destructive h-8 ml-auto"><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {flashcardSets.length > 0 && (
        <div className="mb-6">
          <h4 className="mb-3 text-sm font-bold text-foreground uppercase tracking-wide">Flashcard Sets ({flashcardSets.length})</h4>
          <div className="space-y-2">
            {flashcardSets.map((s) => (
              <div key={s.id} className="rounded-xl border border-amber-500/20 bg-card p-3 sm:p-4">
                <div className="min-w-0">
                  <h5 className="font-medium text-foreground text-sm break-words">{s.title}</h5>
                  <p className="text-xs text-muted-foreground mt-0.5">{s.category} · {s.cards.length} cards · {new Date(s.created_at).toLocaleDateString()}</p>
                </div>
                <div className="flex gap-2 mt-2 pt-2 border-t border-border/50">
                  <Button size="sm" onClick={() => handleFormatOne("flashcards", s)} disabled={formatting || currentItem === s.id} className="gap-1 text-xs h-8">
                    {currentItem === s.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />} Format
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleDelete("flashcards", s.id)} className="text-destructive h-8 ml-auto"><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {mcqSets.length > 0 && (
        <div className="mb-6">
          <h4 className="mb-3 text-sm font-bold text-foreground uppercase tracking-wide">MCQ Sets ({mcqSets.length})</h4>
          <div className="space-y-2">
            {mcqSets.map((s) => (
              <div key={s.id} className="rounded-xl border border-amber-500/20 bg-card p-3 sm:p-4">
                <div className="min-w-0">
                  <h5 className="font-medium text-foreground text-sm break-words">{s.title}</h5>
                  <p className="text-xs text-muted-foreground mt-0.5">{s.category} · {s.questions.length} questions · {new Date(s.created_at).toLocaleDateString()}</p>
                </div>
                <div className="flex gap-2 mt-2 pt-2 border-t border-border/50">
                  <Button size="sm" onClick={() => handleFormatOne("mcqs", s)} disabled={formatting || currentItem === s.id} className="gap-1 text-xs h-8">
                    {currentItem === s.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />} Format
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleDelete("mcqs", s.id)} className="text-destructive h-8 ml-auto"><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ===== ARTICLES LIST (Year-based with batch Gemini update & image generation) =====
function ArticlesList({
  initialEditId,
  onEditOpened,
}: {
  initialEditId: string | null;
  onEditOpened: () => void;
}) {
  const [articles, setArticles] = useState<Article[]>([]);
  const [customCategories, setCustomCategories] = useState<ArticleCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Article | null>(null);
  const [activeYear, setActiveYear] = useState<string>("all");
  const [batchLoading, setBatchLoading] = useState<string | null>(null);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number; label: string } | null>(null);
  const [updatedIds, setUpdatedIds] = useState<Set<string>>(new Set());
  const [aiGenerating, setAiGenerating] = useState(false);
  const { toast } = useToast();
  const { isAdmin, loading: authLoading } = useAuth();

  const refresh = async () => {
    setLoading(true);
    try {
      const [arts, cats] = await Promise.all([
        getArticles(),
        getArticleCategories(),
      ]);
      setArticles(arts.filter((a: any) => a.is_raw !== true));
      setCustomCategories(cats);
    } catch (err: any) {
      toast({ title: "Failed to load articles", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  useEffect(() => {
    if (!initialEditId || editing || articles.length === 0) return;
    const target = articles.find((a) => a.id === initialEditId);
    if (target) { setEditing(target); onEditOpened(); }
  }, [initialEditId, editing, articles, onEditOpened]);

  const handleDelete = async (id: string) => { 
    if (!confirm("Are you sure you want to delete this article?")) return;
    await deleteArticle(id); 
    refresh(); 
    toast({ title: "Deleted" }); 
  };

  const togglePublish = async (a: Article) => { 
    await saveArticle({ ...a, published: !a.published }); 
    refresh(); 
    toast({ title: a.published ? "Unpublished" : "Published!" }); 
  };

  const handleSaveEdit = async () => { 
    if (!editing) return; 
    try {
      await saveArticle(editing); 
      setEditing(null); 
      refresh(); 
      toast({ title: "Article updated!" }); 
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    }
  };

  const handleAiGenerateSeo = async () => {
    if (!editing) return;
    setAiGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("content-upgrade", {
        body: { action: "generate_seo_single", id: editing.id, fields: { meta_title: true, meta_description: true, slug: true } }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // Reload the editing article with new SEO values
      const { data: updatedArt } = await supabase.from("articles").select("*").eq("id", editing.id).single();
      if (updatedArt) setEditing(updatedArt as Article);
      toast({ title: "AI SEO metadata generated!" });
    } catch (err: any) {
      toast({ title: "AI Generation failed", description: err.message, variant: "destructive" });
    } finally {
      setAiGenerating(false);
    }
  };

  // Filter by year
  const years = ["all", "Year 1", "Year 2", "Year 3", "Year 4", "Year 5", "Year 6"];
  const filteredArticles = activeYear === "all"
    ? articles
    : articles.filter(a => a.category.startsWith(activeYear));

  // Group by category within selected year
  const grouped = filteredArticles.reduce<Record<string, Article[]>>((acc, a) => {
    const cat = a.category || "Uncategorized";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(a);
    return acc;
  }, {});
  const sortedGroups = Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b));

  // Year counts
  const yearCounts: Record<string, number> = { all: articles.length };
  years.slice(1).forEach(y => { yearCounts[y] = articles.filter(a => a.category.startsWith(y)).length; });

  // Batch Gemini update for filtered articles
  const handleBatchGeminiUpdate = async () => {
    if (!filteredArticles.length) return;
    setBatchLoading("gemini");
    const newUpdated = new Set(updatedIds);
    let errors = 0;
    for (let i = 0; i < filteredArticles.length; i++) {
      const art = filteredArticles[i];
      if (newUpdated.has(art.id)) continue; 
      setBatchProgress({ current: i + 1, total: filteredArticles.length, label: art.title.slice(0, 50) });
      try {
        const { data, error } = await supabase.functions.invoke("content-upgrade", { body: { action: "upgrade", id: art.id, type: "format" } });
        if (error) throw new Error(error.message);
        if (!data?.improved_content) throw new Error("No content returned");
        await supabase.functions.invoke("content-upgrade", { body: { action: "apply", id: art.id, content: data.improved_content, title: art.title } });
        newUpdated.add(art.id);
        setUpdatedIds(new Set(newUpdated));
      } catch { errors++; }
    }
    setBatchProgress(null);
    setBatchLoading(null);
    toast({ title: errors === 0 ? `All ${filteredArticles.length} articles updated!` : `Done \u2014 ${errors} failed` });
    refresh();
  };

  // Batch image generation for filtered articles
  const handleBatchImageGen = async () => {
    if (!filteredArticles.length) return;
    setBatchLoading("images");
    let errors = 0;
    for (let i = 0; i < filteredArticles.length; i++) {
      const art = filteredArticles[i];
      setBatchProgress({ current: i + 1, total: filteredArticles.length, label: art.title.slice(0, 50) });
      try {
        const { data, error } = await supabase.functions.invoke("content-upgrade", { body: { action: "generate_image", id: art.id } });
        if (error) throw new Error(error.message);
        const imageDataUrl = data?.image_data_url as string | undefined;
        if (!imageDataUrl) throw new Error("No image");
        const contentWithoutTopImage = art.content.replace(/^!\[[^\]]*\]\([^)]+\)\s*\n*/m, "").trimStart();
        const newContent = `![${art.title}](${imageDataUrl})\n\n${contentWithoutTopImage}`;
        await supabase.functions.invoke("content-upgrade", { body: { action: "apply", id: art.id, title: art.title, content: newContent } });
      } catch { errors++; }
    }
    setBatchProgress(null);
    setBatchLoading(null);
    toast({ title: errors === 0 ? `Images generated for ${filteredArticles.length} articles!` : `Done \u2014 ${errors} failed` });
    refresh();
  };

  if (loading) return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />;

  if (editing) {
    return (
      <div className="space-y-6">
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-serif text-xl font-bold text-foreground">Edit Article</h3>
            <div className="flex gap-2">
              <Button onClick={handleSaveEdit} className="gap-2"><Save className="h-4 w-4" /> Save Changes</Button>
              <Button onClick={() => setEditing(null)} variant="outline">Discard</Button>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-[2fr_1fr]">
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1 block">Article Title</label>
                <Input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} className="font-bold text-lg" placeholder="Enter article title" />
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1 block">Content (Markdown)</label>
                <Textarea value={editing.content} onChange={(e) => setEditing({ ...editing, content: e.target.value })} className="min-h-[500px] font-mono text-sm leading-relaxed" />
              </div>
            </div>

            <div className="space-y-6">
              <div className="rounded-lg border border-border bg-secondary/30 p-4 space-y-4">
                <h4 className="font-bold text-sm text-foreground flex items-center gap-2">
                  <Globe className="h-4 w-4 text-primary" /> SEO & Metadata
                </h4>
                
                <Button 
                  onClick={handleAiGenerateSeo} 
                  disabled={aiGenerating} 
                  variant="outline" 
                  size="sm" 
                  className="w-full gap-2 border-primary/30 hover:bg-primary/5"
                >
                  {aiGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  Generate AI SEO
                </Button>

                <div className="space-y-3 pt-2">
                  <div>
                    <label className="text-[10px] font-bold uppercase text-muted-foreground mb-1 block">URL Slug</label>
                    <Input value={editing.slug || ""} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} className="text-xs" placeholder="master-pharmacology" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase text-muted-foreground mb-1 block">Meta Title</label>
                    <Input value={editing.meta_title || ""} onChange={(e) => setEditing({ ...editing, meta_title: e.target.value })} className="text-xs" placeholder="SEO Title (60 chars)" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase text-muted-foreground mb-1 block">Meta Description</label>
                    <Textarea value={editing.meta_description || ""} onChange={(e) => setEditing({ ...editing, meta_description: e.target.value })} className="text-xs h-24" placeholder="SEO Description (160 chars)" />
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-border bg-secondary/30 p-4 space-y-4">
                <h4 className="font-bold text-sm text-foreground flex items-center gap-2">
                  <Layers className="h-4 w-4 text-primary" /> Categorization
                </h4>
                <div>
                  <label className="text-[10px] font-bold uppercase text-muted-foreground mb-1 block">Primary Category</label>
                  <select 
                    value={editing.category} 
                    onChange={(e) => setEditing({ ...editing, category: e.target.value })} 
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground focus:ring-1 focus:ring-primary"
                  >
                    <optgroup label="Core Medical Units">
                      {UNIT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </optgroup>
                    {customCategories.length > 0 && (
                      <optgroup label="Custom Categories">
                        {customCategories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
                      </optgroup>
                    )}
                    <option value="Uncategorized">Uncategorized</option>
                  </select>
                </div>
                <div className="pt-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={editing.published} onChange={(e) => setEditing({ ...editing, published: e.target.checked })} className="accent-primary" />
                    <span className="text-xs font-medium text-foreground">Published & Publicly Visible</span>
                  </label>
                </div>
              </div>

              <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
                <h4 className="font-bold text-sm text-destructive mb-2">Danger Zone</h4>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => { if (confirm("Delete permanently?")) handleDelete(editing.id); setEditing(null); }} 
                  className="w-full text-destructive hover:bg-destructive/10 gap-2"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete Article
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Year filter tabs */}
      <div className="mb-4 flex gap-1 rounded-xl border border-border bg-secondary/50 p-1 overflow-x-auto">
        {years.map(y => (
          <button key={y} onClick={() => setActiveYear(y)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap ${activeYear === y ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
            {y === "all" ? "All" : y}
            <span className="ml-1.5 text-xs text-muted-foreground">({yearCounts[y] || 0})</span>
          </button>
        ))}
      </div>

      {/* Batch action bar */}
      {filteredArticles.length > 0 && (
        <div className="mb-6 rounded-xl border border-primary/30 bg-primary/5 p-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 className="text-sm font-bold text-foreground">
                {activeYear === "all" ? "All Articles" : activeYear} — {filteredArticles.length} article{filteredArticles.length !== 1 ? "s" : ""}
              </h3>
              {updatedIds.size > 0 && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  <span className="text-primary font-medium">{updatedIds.size}</span> updated with Gemini this session
                </p>
              )}
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" onClick={handleBatchGeminiUpdate} disabled={!!batchLoading} className="gap-1.5 text-xs">
                {batchLoading === "gemini" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                Update All with Gemini
              </Button>
              <Button size="sm" variant="outline" onClick={handleBatchImageGen} disabled={!!batchLoading} className="gap-1.5 text-xs border-primary/30">
                {batchLoading === "images" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Eye className="h-3 w-3" />}
                Generate Images for All
              </Button>
            </div>
          </div>
          {batchProgress && (
            <div className="mt-3">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs font-medium text-foreground truncate max-w-[70%]">{batchProgress.label}</span>
                <span className="text-xs text-muted-foreground">{batchProgress.current}/{batchProgress.total}</span>
              </div>
              <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
                <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }} />
              </div>
            </div>
          )}
        </div>
      )}

      {filteredArticles.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <p className="font-medium text-foreground">No articles for {activeYear === "all" ? "any year" : activeYear}</p>
        </div>
      )}

      {/* Articles grouped by category */}
      {sortedGroups.map(([cat, arts]) => (
        <div key={cat} className="mb-6">
          <h4 className="mb-3 text-xs font-bold text-primary uppercase tracking-wide">{getCategoryDisplayName(cat)} ({arts.length})</h4>
          <div className="space-y-2">
            {arts.map(a => (
              <div key={a.id} className={`rounded-xl border bg-card p-3 sm:p-4 transition-colors ${updatedIds.has(a.id) ? "border-primary/40 bg-primary/5" : "border-border"}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h5 className="font-medium text-foreground text-sm leading-snug break-words">{a.title}</h5>
                      {updatedIds.has(a.id) && (
                        <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">
                          <Check className="h-2.5 w-2.5" /> Updated
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(a.created_at).toLocaleDateString()} · {a.published ? "Published" : "Draft"}
                    </p>
                  </div>
                </div>
                <div className="flex gap-1 mt-2 pt-2 border-t border-border/50 flex-wrap">
                  <Button size="sm" variant="ghost" asChild className="text-xs h-8"><a href={buildBlogPath(a)} target="_blank" rel="noopener"><Eye className="h-3.5 w-3.5 mr-1" /><span className="sm:inline hidden">View</span></a></Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(a)} className="h-8"><Pencil className="h-3.5 w-3.5 mr-1" /><span className="sm:inline hidden">Edit</span></Button>
                  <Button size="sm" variant="ghost" onClick={() => togglePublish(a)} className="h-8 text-xs">{a.published ? "Unpublish" : "Publish"}</Button>
                  <Button size="sm" variant="ghost" onClick={() => handleDelete(a.id)} className="text-destructive h-8 ml-auto"><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ===== FLASHCARDS LIST =====
function FlashcardsList() {
  const [sets, setSets] = useState<FlashcardSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<FlashcardSet | null>(null);
  const { toast } = useToast();
  const { isAdmin, loading: authLoading } = useAuth();
  const refresh = () => { getFlashcardSets().then((s) => setSets(s.filter((f: any) => f.is_raw !== true))).finally(() => setLoading(false)); };
  useEffect(() => { refresh(); }, []);
  const handleDelete = async (id: string) => { await deleteFlashcardSet(id); refresh(); toast({ title: "Deleted" }); };
  const togglePublish = async (s: FlashcardSet) => { await saveFlashcardSet({ ...s, published: !s.published }); refresh(); toast({ title: s.published ? "Unpublished" : "Published!" }); };
  const handleSaveEdit = async () => { if (!editing) return; await saveFlashcardSet(editing); setEditing(null); refresh(); toast({ title: "Updated!" }); };
  const updateCard = (i: number, field: "question" | "answer", value: string) => {
    if (!editing) return;
    const cards = [...editing.cards]; cards[i] = { ...cards[i], [field]: value }; setEditing({ ...editing, cards });
  };
  if (loading) return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />;
  if (sets.length === 0) return <p className="text-muted-foreground">No flashcard sets yet.</p>;
  if (editing) {
    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="mb-4 font-serif text-lg font-bold text-foreground">Edit Flashcard Set</h3>
        <Input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} className="mb-4 font-bold" placeholder="Title" />
        
        <div className="mb-6 rounded-lg border border-border bg-secondary/30 p-4 space-y-4">
          <h4 className="font-bold text-sm text-foreground flex items-center gap-2">
            <Globe className="h-4 w-4 text-primary" /> SEO & Metadata
          </h4>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-[10px] font-bold uppercase text-muted-foreground mb-1 block">URL Slug</label>
              <Input value={editing.slug || ""} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} className="text-xs" placeholder="slug-path" />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-muted-foreground mb-1 block">Meta Title</label>
              <Input value={editing.meta_title || ""} onChange={(e) => setEditing({ ...editing, meta_title: e.target.value })} className="text-xs" placeholder="SEO Title" />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-muted-foreground mb-1 block">Meta Description</label>
            <Textarea value={editing.meta_description || ""} onChange={(e) => setEditing({ ...editing, meta_description: e.target.value })} className="text-xs h-20" placeholder="SEO Description" />
          </div>
        </div>

        <div className="mb-4 max-h-96 overflow-y-auto space-y-2">
          {editing.cards.map((c, i) => (
            <div key={i} className="rounded-lg border border-border p-3 space-y-2">
              <Input value={c.question} onChange={(e) => updateCard(i, "question", e.target.value)} placeholder="Question" className="text-sm" />
              <Input value={c.answer} onChange={(e) => updateCard(i, "answer", e.target.value)} placeholder="Answer" className="text-sm" />
            </div>
          ))}
        </div>
        <div className="flex gap-3">
          <Button onClick={handleSaveEdit} className="gap-2"><Save className="h-4 w-4" /> Save</Button>
          <Button onClick={() => setEditing(null)} variant="outline">Cancel</Button>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {sets.map((s) => (
        <div key={s.id} className="rounded-xl border border-border bg-card p-3 sm:p-4">
          <div className="min-w-0">
            <h4 className="font-medium text-foreground text-sm break-words">{s.title}</h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              {s.category !== "Uncategorized" && <span className="text-primary">{getCategoryDisplayName(s.category)} · </span>}
              {s.cards.length} cards · {new Date(s.created_at).toLocaleDateString()} · {s.published ? "Published" : "Draft"}
            </p>
          </div>
          <div className="flex gap-1 mt-2 pt-2 border-t border-border/50 flex-wrap">
            <Button size="sm" variant="ghost" onClick={() => setEditing(s)} className="h-8"><Pencil className="h-3.5 w-3.5 mr-1" /><span className="text-xs">Edit</span></Button>
            <Button size="sm" variant="ghost" onClick={() => togglePublish(s)} className="h-8 text-xs">{s.published ? "Unpublish" : "Publish"}</Button>
            <Button size="sm" variant="ghost" onClick={() => handleDelete(s.id)} className="text-destructive h-8 ml-auto"><Trash2 className="h-3.5 w-3.5" /></Button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ===== MCQs LIST =====
function McqsList() {
  const [sets, setSets] = useState<McqSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<McqSet | null>(null);
  const [passwordSetId, setPasswordSetId] = useState<string | null>(null);
  const [passwordValue, setPasswordValue] = useState("");
  const [fixingId, setFixingId] = useState<string | null>(null);
  const [batchFixing, setBatchFixing] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null);
  const { toast } = useToast();
  const { isAdmin, loading: authLoading } = useAuth();
  const refresh = () => { getMcqSets().then((s) => setSets(s.filter((m: any) => m.is_raw !== true))).finally(() => setLoading(false)); };
  useEffect(() => { refresh(); }, []);
  const handleDelete = async (id: string) => { await deleteMcqSet(id); refresh(); toast({ title: "Deleted" }); };
  const togglePublish = async (s: McqSet) => { await saveMcqSet({ ...s, published: !s.published }); refresh(); toast({ title: s.published ? "Unpublished" : "Published!" }); };
  const handleSaveEdit = async () => { if (!editing) return; await saveMcqSet(editing); setEditing(null); refresh(); toast({ title: "Updated!" }); };
  const handleSetPassword = async (s: McqSet) => { await saveMcqSet({ ...s, access_password: passwordValue.trim() }); setPasswordSetId(null); setPasswordValue(""); refresh(); toast({ title: passwordValue.trim() ? "Password set!" : "Password removed." }); };
  const handleRemovePassword = async (s: McqSet) => { await saveMcqSet({ ...s, access_password: "" }); refresh(); toast({ title: "Password removed" }); };
  const updateQuestion = (i: number, field: string, value: any) => { if (!editing) return; const questions = [...editing.questions]; questions[i] = { ...questions[i], [field]: value }; setEditing({ ...editing, questions }); };
  const updateOption = (qi: number, oi: number, value: string) => { if (!editing) return; const questions = [...editing.questions]; const options = [...questions[qi].options]; options[oi] = value; questions[qi] = { ...questions[qi], options }; setEditing({ ...editing, questions }); };

  // AI Fix single MCQ set
  const handleAiFix = async (setId: string) => {
    setFixingId(setId);
    try {
      const { data, error } = await supabase.functions.invoke("mcq-quality-fix", {
        body: { set_id: setId },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      toast({ title: `Fixed: ${data.issues?.length || 0} issues, ${data.removed || 0} removed` });
      refresh();
    } catch (err: any) {
      toast({ title: "Fix failed", description: err.message, variant: "destructive" });
    } finally {
      setFixingId(null);
    }
  };

  // Batch fix all MCQ sets
  const handleBatchFix = async () => {
    setBatchFixing(true);
    try {
      const { data, error } = await supabase.functions.invoke("mcq-quality-fix", { body: {} });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      toast({ title: `Batch fix: ${data.sets_fixed} sets fixed, ${data.questions_removed} questions removed out of ${data.scanned} scanned` });
      refresh();
    } catch (err: any) {
      toast({ title: "Batch fix failed", description: err.message, variant: "destructive" });
    } finally {
      setBatchFixing(false);
    }
  };

  if (loading) return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />;
  if (sets.length === 0) return <p className="text-muted-foreground">No MCQ sets yet.</p>;
  if (editing) {
    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="mb-4 font-serif text-lg font-bold text-foreground">Edit MCQ Set</h3>
        <Input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} className="mb-3 font-bold" placeholder="Title" />
        <select value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value })} className="w-full mb-4 rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground">
          <option value="Uncategorized">Uncategorized</option>
          {UNIT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>

        <div className="mb-6 rounded-lg border border-border bg-secondary/30 p-4 space-y-4">
          <h4 className="font-bold text-sm text-foreground flex items-center gap-2">
            <Globe className="h-4 w-4 text-primary" /> SEO & Metadata
          </h4>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-[10px] font-bold uppercase text-muted-foreground mb-1 block">URL Slug</label>
              <Input value={editing.slug || ""} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} className="text-xs" placeholder="slug-path" />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-muted-foreground mb-1 block">Meta Title</label>
              <Input value={editing.meta_title || ""} onChange={(e) => setEditing({ ...editing, meta_title: e.target.value })} className="text-xs" placeholder="SEO Title" />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-muted-foreground mb-1 block">Meta Description</label>
            <Textarea value={editing.meta_description || ""} onChange={(e) => setEditing({ ...editing, meta_description: e.target.value })} className="text-xs h-20" placeholder="SEO Description" />
          </div>
        </div>

        <div className="mb-4 max-h-[500px] overflow-y-auto space-y-3">
          {editing.questions.map((q, i) => (
            <div key={i} className="rounded-lg border border-border p-3 space-y-2">
              <Input value={q.question} onChange={(e) => updateQuestion(i, "question", e.target.value)} placeholder="Question" className="text-sm font-medium" />
              {q.options.map((opt, j) => (
                <div key={j} className="flex items-center gap-2">
                  <input type="radio" name={`correct-${i}`} checked={q.correct_answer === j} onChange={() => updateQuestion(i, "correct_answer", j)} className="accent-primary" />
                  <Input value={opt} onChange={(e) => updateOption(i, j, e.target.value)} placeholder={`Option ${String.fromCharCode(65 + j)}`} className="text-sm" />
                </div>
              ))}
              <Input value={q.explanation || ""} onChange={(e) => updateQuestion(i, "explanation", e.target.value)} placeholder="Explanation (optional)" className="text-sm text-muted-foreground" />
            </div>
          ))}
        </div>
        <div className="flex gap-3">
          <Button onClick={handleSaveEdit} className="gap-2"><Save className="h-4 w-4" /> Save</Button>
          <Button onClick={() => setEditing(null)} variant="outline">Cancel</Button>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {/* Batch fix button */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button size="sm" onClick={handleBatchFix} disabled={batchFixing} className="gap-1.5">
          {batchFixing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
          {batchFixing ? "Fixing all MCQs..." : "Fix All MCQs (duplicates, garbage)"}
        </Button>
        <span className="text-xs text-muted-foreground">{sets.length} sets</span>
      </div>

      {sets.map((s) => (
        <div key={s.id} className="rounded-xl border border-border bg-card p-3 sm:p-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-medium text-foreground text-sm break-words">{s.title}</h4>
              {s.access_password && s.access_password !== "" && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  <Key className="h-2.5 w-2.5" /> Locked
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {s.category !== "Uncategorized" && <span className="text-primary">{getCategoryDisplayName(s.category)} · </span>}
              {s.questions.length} questions · {new Date(s.created_at).toLocaleDateString()} · {s.published ? "Published" : "Draft"}
            </p>
          </div>
          <div className="flex gap-1 mt-2 pt-2 border-t border-border/50 flex-wrap">
            <Button size="sm" variant="ghost" onClick={() => handleAiFix(s.id)} disabled={fixingId === s.id} className="h-8 gap-1">
              {fixingId === s.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
              <span className="text-xs">Fix</span>
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setPasswordSetId(passwordSetId === s.id ? null : s.id); setPasswordValue(s.access_password || ""); }} className="h-8"><Key className="h-3.5 w-3.5" /></Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(s)} className="h-8"><Pencil className="h-3.5 w-3.5 mr-1" /><span className="text-xs">Edit</span></Button>
            <Button size="sm" variant="ghost" onClick={() => togglePublish(s)} className="h-8 text-xs">{s.published ? "Unpublish" : "Publish"}</Button>
            <Button size="sm" variant="ghost" onClick={() => handleDelete(s.id)} className="text-destructive h-8 ml-auto"><Trash2 className="h-3.5 w-3.5" /></Button>
          </div>
          {passwordSetId === s.id && (
            <div className="mt-3 pt-3 border-t border-border">
              <p className="text-xs font-medium text-foreground mb-2">Set Password (leave empty to remove)</p>
              <div className="flex gap-2">
                <Input type="text" placeholder="Enter password" value={passwordValue} onChange={(e) => setPasswordValue(e.target.value)} className="flex-1 text-sm" />
                <Button size="sm" onClick={() => handleSetPassword(s)} className="gap-1"><Save className="h-3 w-3" /> Save</Button>
                {s.access_password && s.access_password !== "" && (
                  <Button size="sm" variant="destructive" onClick={() => handleRemovePassword(s)}>Remove</Button>
                )}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ===== SETTINGS PANEL =====
function SettingsPanel({ setGeminiKey }: { setGeminiKey: (key: string) => void }) {
  const [geminiKeys, setGeminiKeys] = useState<string[]>([""]);
  const [examPassword, setExamPassword] = useState("");
  const [examPrice, setExamPrice] = useState("5");
  const [examAward, setExamAward] = useState("1000");
  const [mcqFreeLimit, setMcqFreeLimit] = useState("10");
  const [mcqPrice, setMcqPrice] = useState("10");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generatingExam, setGeneratingExam] = useState(false);
  const [auditRunning, setAuditRunning] = useState(false);
  const [auditLog, setAuditLog] = useState<string[]>([]);
  const { toast } = useToast();
  const { isAdmin, loading: authLoading } = useAuth();

  useEffect(() => {
    Promise.all([getSetting("gemini_api_keys"), getSetting("gemini_api_key"), getSetting("exam_password"), getSetting("exam_price"), getSetting("exam_award"), getSetting("mcq_free_limit"), getSetting("mcq_price")]).then(([multiKeys, singleKey, pwd, price, award, freeLimit, mPrice]) => {
      // Load multi-key list, falling back to single key
      if (multiKeys) {
        try {
          const parsed = JSON.parse(multiKeys);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setGeminiKeys(parsed.filter(Boolean).length ? parsed.filter(Boolean) : [""]);
          } else {
            setGeminiKeys(singleKey ? [singleKey] : [""]);
          }
        } catch {
          setGeminiKeys(singleKey ? [singleKey] : [""]);
        }
      } else {
        setGeminiKeys(singleKey ? [singleKey] : [""]);
      }
      setExamPassword(pwd || ""); setExamPrice(price || "5"); setExamAward(award || "1000"); setMcqFreeLimit(freeLimit || "10"); setMcqPrice(mPrice || "10"); setLoading(false);
    });
  }, []);

  const handleSaveKeys = async () => {
    setSaving(true);
    try {
      const validKeys = geminiKeys.map(k => k.trim()).filter(Boolean);
      await saveSetting("gemini_api_keys", JSON.stringify(validKeys));
      // Also save the first key as primary for backward compatibility
      if (validKeys.length > 0) {
        await saveSetting("gemini_api_key", validKeys[0]);
        setGeminiKey(validKeys[0]);
      }
      toast({ title: `${validKeys.length} API key(s) saved!`, description: "Keys will auto-rotate when quota is exceeded." });
    } catch (err: any) {
      toast({ title: "Failed to save", description: err.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const handleSaveExamPassword = async () => {
    setSaving(true);
    try { await saveSetting("exam_password", examPassword.trim()); toast({ title: examPassword.trim() ? "Exam password saved!" : "Exam password removed" }); }
    catch (err: any) { toast({ title: "Failed to save", description: err.message, variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const handleGenerateExam = async () => {
    setGeneratingExam(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-exam');
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      toast({ title: `Exam generation complete`, description: `${data?.unit_count || 0} unit exam(s) created.` });
    } catch (err: any) {
      toast({ title: "Exam generation failed", description: err.message, variant: "destructive" });
    } finally { setGeneratingExam(false); }
  };

  // MCQ Audit — find essay content misclassified as MCQs
  const handleAuditMcqs = async () => {
    setAuditRunning(true);
    setAuditLog(["Starting MCQ audit..."]);
    try {
      const { data: mcqSets } = await supabase
        .from("mcq_sets")
        .select("id, title, questions, category")
        .eq("published", true)
        .is("deleted_at", null);

      if (!mcqSets?.length) {
        setAuditLog(prev => [...prev, "No published MCQ sets found."]);
        setAuditRunning(false);
        return;
      }

      const essaySignals = ["marks", "marking points", "discuss", "describe", "outline", "explain in detail", "enumerate", "differentiate between", "total:", "model answer", "saq", "laq"];
      let movedCount = 0;

      for (const mcqSet of mcqSets) {
        const questions = mcqSet.questions as any[];
        if (!Array.isArray(questions) || questions.length === 0) continue;

        // Check if "questions" look like essays
        let essayScore = 0;
        let mcqScore = 0;
        for (const q of questions) {
          const text = (q.question || "").toLowerCase() + " " + (q.options || []).join(" ").toLowerCase();
          // Essay signals
          for (const signal of essaySignals) {
            if (text.includes(signal)) essayScore++;
          }
          // MCQ signals: has 4 short options
          if (Array.isArray(q.options) && q.options.length >= 4 && q.options.every((o: string) => typeof o === "string" && o.length < 200)) {
            mcqScore++;
          }
          // Options that are paragraphs = essay
          if (Array.isArray(q.options) && q.options.some((o: string) => typeof o === "string" && o.length > 300)) {
            essayScore += 3;
          }
        }

        if (essayScore > mcqScore && essayScore >= 3) {
          setAuditLog(prev => [...prev, `⚠️ "${mcqSet.title}" looks like essays (essay=${essayScore} vs mcq=${mcqScore}). Moving...`]);

          // Convert to essay format
          const saqs = questions.slice(0, 6).map((q: any) => ({
            question: (q.question || "").replace(/^#{1,6}\s+/gm, "").replace(/Choices:\s*$/i, "").trim(),
            answer: (q.options || []).join("\n- "),
            marks: 5,
          }));
          const laqs = questions.length > 6 ? [{
            question: (questions[6].question || "").replace(/^#{1,6}\s+/gm, "").trim(),
            answer: (questions[6].options || []).join("\n- "),
            marks: 20,
          }] : [];

          // Insert into essays
          await supabase.from("essays").insert({
            title: mcqSet.title,
            category: mcqSet.category,
            short_answer_questions: saqs,
            long_answer_questions: laqs,
            published: true,
          });

          // Soft-delete the MCQ set
          await supabase.from("mcq_sets").update({ deleted_at: new Date().toISOString() } as any).eq("id", mcqSet.id);
          movedCount++;
          setAuditLog(prev => [...prev, `✅ Moved "${mcqSet.title}" to Essays`]);
        }
      }

      setAuditLog(prev => [...prev, `Done! Audited ${mcqSets.length} MCQ sets. Moved ${movedCount} to Essays.`]);
      if (movedCount > 0) {
        toast({ title: `Audit complete`, description: `${movedCount} essay-like MCQ sets moved to Essays section.` });
      } else {
        toast({ title: "Audit complete", description: "No misclassified content found." });
      }
    } catch (err: any) {
      setAuditLog(prev => [...prev, `❌ Error: ${err.message}`]);
      toast({ title: "Audit failed", description: err.message, variant: "destructive" });
    } finally { setAuditRunning(false); }
  };

  if (loading) return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />;

  return (
    <div className="max-w-lg space-y-6">
      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="mb-2 font-serif text-lg font-bold text-foreground">Google Gemini API Keys</h3>
        <p className="mb-4 text-sm text-muted-foreground">Add multiple keys from <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-primary underline">Google AI Studio</a>. When one key hits its quota, the system automatically switches to the next.</p>
        <div className="space-y-2 mb-3">
          {geminiKeys.map((key, i) => (
            <div key={i} className="flex gap-2">
              <Input
                type="password"
                placeholder={`API Key ${i + 1}`}
                value={key}
                onChange={(e) => {
                  const updated = [...geminiKeys];
                  updated[i] = e.target.value;
                  setGeminiKeys(updated);
                }}
                className="flex-1"
              />
              {geminiKeys.length > 1 && (
                <Button size="sm" variant="ghost" onClick={() => setGeminiKeys(geminiKeys.filter((_, j) => j !== i))}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setGeminiKeys([...geminiKeys, ""])} className="gap-1">
            + Add Key
          </Button>
          <Button onClick={handleSaveKeys} disabled={saving} size="sm" className="gap-2">
            <Key className="h-3 w-3" /> {saving ? "Saving..." : "Save All Keys"}
          </Button>
        </div>
        {geminiKeys.filter(k => k.trim()).length > 0 && (
          <p className="mt-2 text-xs text-primary">{geminiKeys.filter(k => k.trim()).length} key(s) configured — auto-rotation enabled</p>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="mb-2 font-serif text-lg font-bold text-foreground">MCQ Content Audit</h3>
        <p className="mb-4 text-sm text-muted-foreground">Scan all MCQ sets for essay-like content (marking points, long answers) and move them to the Essays section automatically.</p>
        <Button onClick={handleAuditMcqs} disabled={auditRunning} className="gap-2">
          {auditRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertTriangle className="h-4 w-4" />}
          {auditRunning ? "Auditing..." : "Run MCQ Audit"}
        </Button>
        {auditLog.length > 0 && (
          <div className="mt-3 max-h-40 overflow-y-auto rounded-lg border border-border bg-background p-3 text-xs font-mono text-muted-foreground space-y-0.5">
            {auditLog.map((log, i) => <p key={i}>{log}</p>)}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="mb-2 font-serif text-lg font-bold text-foreground">Default Exam Password</h3>
        <p className="mb-4 text-sm text-muted-foreground">Set a default password for auto-generated weekly exams.</p>
        <div className="flex gap-2">
          <Input type="text" placeholder="Default exam password" value={examPassword} onChange={(e) => setExamPassword(e.target.value)} className="flex-1" />
          <Button onClick={handleSaveExamPassword} disabled={saving} size="sm" className="gap-2"><Save className="h-3 w-3" /> Save</Button>
        </div>
      </div>
      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="mb-2 font-serif text-lg font-bold text-foreground">Exam Price (KES)</h3>
        <p className="mb-4 text-sm text-muted-foreground">Set the M-Pesa payment amount for exam access.</p>
        <div className="flex gap-2">
          <Input type="number" placeholder="5" value={examPrice} onChange={(e) => setExamPrice(e.target.value)} className="flex-1 max-w-[120px]" />
          <Button onClick={async () => { setSaving(true); try { await saveSetting("exam_price", examPrice); toast({ title: "Exam price saved!" }); } catch {} finally { setSaving(false); } }} disabled={saving} size="sm" className="gap-2"><Save className="h-3 w-3" /> Save</Button>
        </div>
      </div>
      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="mb-2 font-serif text-lg font-bold text-foreground">MCQ Paywall — Free Questions</h3>
        <p className="mb-4 text-sm text-muted-foreground">Number of free MCQs before the paywall kicks in. Default: 10.</p>
        <div className="flex gap-2">
          <Input type="number" placeholder="10" value={mcqFreeLimit} onChange={(e) => setMcqFreeLimit(e.target.value)} className="flex-1 max-w-[120px]" />
          <Button onClick={async () => { setSaving(true); try { await saveSetting("mcq_free_limit", mcqFreeLimit); toast({ title: "MCQ free limit saved!" }); } catch {} finally { setSaving(false); } }} disabled={saving} size="sm" className="gap-2"><Save className="h-3 w-3" /> Save</Button>
        </div>
      </div>
      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="mb-2 font-serif text-lg font-bold text-foreground">MCQ Price (KES)</h3>
        <p className="mb-4 text-sm text-muted-foreground">M-Pesa payment amount to unlock remaining MCQs in a set. Default: 10.</p>
        <div className="flex gap-2">
          <Input type="number" placeholder="10" value={mcqPrice} onChange={(e) => setMcqPrice(e.target.value)} className="flex-1 max-w-[120px]" />
          <Button onClick={async () => { setSaving(true); try { await saveSetting("mcq_price", mcqPrice); toast({ title: "MCQ price saved!" }); } catch {} finally { setSaving(false); } }} disabled={saving} size="sm" className="gap-2"><Save className="h-3 w-3" /> Save</Button>
        </div>
      </div>
      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="mb-2 font-serif text-lg font-bold text-foreground">Exam Winner Award (KES)</h3>
        <p className="mb-4 text-sm text-muted-foreground">Default prize for the top-scoring student per unit exam.</p>
        <div className="flex gap-2">
          <Input type="number" placeholder="1000" value={examAward} onChange={(e) => setExamAward(e.target.value)} className="flex-1 max-w-[120px]" />
          <Button onClick={async () => { setSaving(true); try { await saveSetting("exam_award", examAward); toast({ title: "Exam award saved!" }); } catch {} finally { setSaving(false); } }} disabled={saving} size="sm" className="gap-2"><Save className="h-3 w-3" /> Save</Button>
        </div>
      </div>
      <div className="rounded-xl border border-primary/30 bg-primary/5 p-6">
        <h3 className="mb-2 font-serif text-lg font-bold text-foreground">Weekly Exam Generator</h3>
        <p className="mb-4 text-sm text-muted-foreground">Generates a comprehensive exam from all published content.</p>
        <Button onClick={handleGenerateExam} disabled={generatingExam} className="gap-2">
          {generatingExam && <Loader2 className="h-4 w-4 animate-spin" />}
          {generatingExam ? "Generating Exam..." : "Generate Exam Now"}
        </Button>
      </div>
    </div>
  );
}

// ===== EXAM RESULTS TAB =====
function ExamResultsTab() {
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUnit, setSelectedUnit] = useState<string>("");

  const refresh = async () => {
    setLoading(true);
    const { data } = await supabase.from("exam_results").select("*").order("submitted_at", { ascending: false });
    setResults(data || []);
    setLoading(false);
  };

  useEffect(() => { refresh(); }, []);

  const units = [...new Set(results.map((r) => r.unit))].filter(Boolean);

  const filtered = results.filter((r) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q
      || r.student_name?.toLowerCase().includes(q)
      || r.university?.toLowerCase().includes(q)
      || r.exam_title?.toLowerCase().includes(q)
      || r.course?.toLowerCase().includes(q);
    const matchesUnit = !selectedUnit || r.unit === selectedUnit;
    return matchesSearch && matchesUnit;
  });

  // ── FIXED PDF: no emoji in title, proper charset, clean HTML entities ──
  const generatePDF = (unit: string) => {
    const unitResults = [...results]
      .filter((r) => r.unit === unit)
      .sort((a, b) => (b.mcq_score / b.mcq_total) - (a.mcq_score / a.mcq_total));

    const dateStr = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

    let rows = "";
    unitResults.forEach((r, i) => {
      const pct = r.mcq_total > 0 ? Math.round((r.mcq_score / r.mcq_total) * 100) : 0;
      const mins = Math.floor((r.time_taken_seconds || 0) / 60);
      const secs = (r.time_taken_seconds || 0) % 60;
      const timeStr = `${mins}:${String(secs).padStart(2, "0")}`;
      const dateFormatted = r.submitted_at ? new Date(r.submitted_at).toLocaleDateString("en-GB") : "-";
      const medal = i === 0 ? " (1st)" : i === 1 ? " (2nd)" : i === 2 ? " (3rd)" : "";
      const rowBg = i === 0 ? "#fef9c3" : i === 1 ? "#dbeafe" : i === 2 ? "#fce7f3" : (i % 2 === 0 ? "#f9fafb" : "#ffffff");
      const pctColor = pct >= 80 ? "#16a34a" : pct >= 60 ? "#2563eb" : "#d97706";
      rows += `<tr style="background:${rowBg}">
        <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb">${i + 1}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;font-weight:${i < 3 ? "bold" : "normal"}">${escapeHtml(r.student_name || "")}${medal}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb">${escapeHtml(r.university || "")}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb">${escapeHtml(r.course || "")}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb">${r.mcq_score}/${r.mcq_total}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;font-weight:bold;color:${pctColor}">${pct}%</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb">${timeStr}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb">${dateFormatted}</td>
      </tr>`;
    });

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(unit)} - Exam Results</title>
</head>
<body style="font-family:Arial,Helvetica,sans-serif;padding:40px;color:#111;background:#fff;margin:0">
  <h1 style="text-align:center;color:#1a1a2e;font-size:22px;margin:0 0 6px 0">${escapeHtml(unit)} &ndash; Exam Results</h1>
  <p style="text-align:center;color:#555;font-size:13px;margin:0 0 28px 0">Generated: ${dateStr} &bull; ${unitResults.length} student${unitResults.length !== 1 ? "s" : ""}</p>
  <table style="width:100%;border-collapse:collapse;font-size:12px">
    <thead>
      <tr style="background:#1a1a2e;color:#fff">
        <th style="padding:10px;text-align:left;font-weight:600">#</th>
        <th style="padding:10px;text-align:left;font-weight:600">Name</th>
        <th style="padding:10px;text-align:left;font-weight:600">University</th>
        <th style="padding:10px;text-align:left;font-weight:600">Course</th>
        <th style="padding:10px;text-align:left;font-weight:600">Score</th>
        <th style="padding:10px;text-align:left;font-weight:600">%</th>
        <th style="padding:10px;text-align:left;font-weight:600">Time</th>
        <th style="padding:10px;text-align:left;font-weight:600">Date</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <p style="margin-top:32px;text-align:center;font-size:10px;color:#9ca3af">Ompath Study Exam Results &bull; Confidential</p>
</body>
</html>`;

    // base64 data URL preserves UTF-8 charset — blob URLs cause garbled emoji/special chars
    const encoded = btoa(unescape(encodeURIComponent(html)));
    const dataUrl = `data:text/html;charset=utf-8;base64,${encoded}`;
    const win = window.open(dataUrl, "_blank");
    if (win) {
      win.addEventListener("load", () => {
        setTimeout(() => win.print(), 500);
      });
    }
  };

  if (loading) return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />;

  return (
    <div>
      {/* Stats summary */}
      <div className="mb-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-border bg-card p-4 text-center">
          <p className="text-2xl font-bold text-foreground">{results.length}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Total Submissions</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 text-center">
          <p className="text-2xl font-bold text-foreground">{units.length}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Units Examined</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 text-center">
          <p className="text-2xl font-bold text-green-600">
            {results.length > 0 ? Math.round(results.reduce((sum, r) => sum + (r.mcq_total > 0 ? (r.mcq_score / r.mcq_total) * 100 : 0), 0) / results.length) : 0}%
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">Average Score</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 text-center">
          <p className="text-2xl font-bold text-primary">
            {results.length > 0 ? Math.max(...results.map((r) => r.mcq_total > 0 ? Math.round((r.mcq_score / r.mcq_total) * 100) : 0)) : 0}%
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">Top Score</p>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="mb-1 block text-sm font-medium text-foreground">Search</label>
          <Input placeholder="Name, university, course, exam..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-foreground">Filter by Unit</label>
          <select value={selectedUnit} onChange={(e) => setSelectedUnit(e.target.value)} className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground">
            <option value="">All Units</option>
            {units.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
        {selectedUnit && (
          <Button onClick={() => generatePDF(selectedUnit)} variant="outline" className="gap-2">
            Download PDF ({selectedUnit})
          </Button>
        )}
        <Button onClick={refresh} variant="ghost" size="sm" className="gap-1 text-muted-foreground">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </Button>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-4xl mb-3">📋</p>
          <p className="font-medium text-foreground">No exam results yet</p>
          <p className="text-sm mt-1">Results appear here after students submit exams.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-3 py-2 text-left font-medium text-foreground">#</th>
                <th className="px-3 py-2 text-left font-medium text-foreground">Name</th>
                <th className="px-3 py-2 text-left font-medium text-foreground">University</th>
                <th className="px-3 py-2 text-left font-medium text-foreground">Course</th>
                <th className="px-3 py-2 text-left font-medium text-foreground">Unit</th>
                <th className="px-3 py-2 text-left font-medium text-foreground">Score</th>
                <th className="px-3 py-2 text-left font-medium text-foreground">Time</th>
                <th className="px-3 py-2 text-left font-medium text-foreground">Date</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => {
                const pct = r.mcq_total > 0 ? Math.round((r.mcq_score / r.mcq_total) * 100) : 0;
                const mins = Math.floor((r.time_taken_seconds || 0) / 60);
                const secs = (r.time_taken_seconds || 0) % 60;
                return (
                  <tr key={r.id} className="border-b border-border/60 hover:bg-muted/30">
                    <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                    <td className="px-3 py-2 font-medium text-foreground">{r.student_name}</td>
                    <td className="px-3 py-2 text-muted-foreground text-xs">{r.university}</td>
                    <td className="px-3 py-2 text-muted-foreground text-xs">{r.course}</td>
                    <td className="px-3 py-2"><span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{r.unit}</span></td>
                    <td className="px-3 py-2">
                      <span className={`font-bold ${pct >= 80 ? "text-green-600" : pct >= 60 ? "text-blue-600" : "text-amber-600"}`}>
                        {r.mcq_score}/{r.mcq_total} ({pct}%)
                      </span>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{mins}:{String(secs).padStart(2, "0")}</td>
                    <td className="px-3 py-2 text-muted-foreground">{r.submitted_at ? new Date(r.submitted_at).toLocaleDateString() : "-"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {units.length > 0 && (
        <div className="mt-6 rounded-xl border border-border bg-card p-5">
          <h3 className="mb-3 font-serif text-base font-bold text-foreground">Download Results by Unit</h3>
          <div className="flex flex-wrap gap-2">
            {units.map((u) => (
              <Button key={u} variant="outline" size="sm" onClick={() => generatePDF(u)} className="gap-1 text-xs">
                {u} ({results.filter((r) => r.unit === u).length})
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Safe HTML escaping for PDF — prevents encoding issues
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ===== RECYCLE BIN =====
function RecycleBinTab() {
  const { toast } = useToast();
  const { isAdmin, loading: authLoading } = useAuth();
  const [items, setItems] = useState<{ type: string; id: string; title: string; deleted_at: string; category: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    const [{ data: articles }, { data: flashcards }, { data: mcqs }] = await Promise.all([
      supabase.from("articles").select("id, title, deleted_at, category").not("deleted_at", "is", null),
      supabase.from("flashcard_sets").select("id, title, deleted_at, category").not("deleted_at", "is", null),
      supabase.from("mcq_sets").select("id, title, deleted_at, category").not("deleted_at", "is", null),
    ]);
    const all = [
      ...(articles || []).map((a: any) => ({ type: "article", ...a })),
      ...(flashcards || []).map((f: any) => ({ type: "flashcards", ...f })),
      ...(mcqs || []).map((m: any) => ({ type: "mcqs", ...m })),
    ].sort((a, b) => new Date(b.deleted_at).getTime() - new Date(a.deleted_at).getTime());
    setItems(all);
    setLoading(false);
  };

  useEffect(() => { refresh(); }, []);

  const handleRestore = async (item: typeof items[0]) => {
    const table = item.type === "article" ? "articles" : item.type === "flashcards" ? "flashcard_sets" : "mcq_sets";
    await supabase.from(table).update({ deleted_at: null } as any).eq("id", item.id);
    toast({ title: "Restored!" }); refresh();
  };

  const handlePermanentDelete = async (item: typeof items[0]) => {
    const table = item.type === "article" ? "articles" : item.type === "flashcards" ? "flashcard_sets" : "mcq_sets";
    await supabase.from(table).delete().eq("id", item.id);
    toast({ title: "Permanently deleted" }); refresh();
  };

  const daysUntilPurge = (deleted_at: string) => {
    const purge = new Date(new Date(deleted_at).getTime() + 7 * 24 * 60 * 60 * 1000);
    return Math.max(0, Math.ceil((purge.getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
  };

  if (loading) return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />;

  return (
    <div>
      <div className="mb-6 rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-1">
          <Trash2 className="h-5 w-5 text-muted-foreground" />
          <h3 className="font-serif text-lg font-bold text-foreground">Recycle Bin</h3>
        </div>
        <p className="text-sm text-muted-foreground">{items.length === 0 ? "Recycle bin is empty." : `${items.length} item(s) — auto-deleted after 7 days.`}</p>
      </div>
      {items.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-4xl mb-3">🗑️</p>
          <p className="font-medium text-foreground">Nothing in the recycle bin</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="flex items-center justify-between rounded-xl border border-border bg-card p-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold uppercase text-muted-foreground">{item.type}</span>
                  <h5 className="font-medium text-foreground truncate">{item.title}</h5>
                </div>
                <p className="text-xs text-muted-foreground">
                  {item.category} · Deleted {new Date(item.deleted_at).toLocaleDateString()} · <span className="text-destructive">{daysUntilPurge(item.deleted_at)}d until deletion</span>
                </p>
              </div>
              <div className="flex gap-2 ml-3 shrink-0">
                <Button size="sm" variant="outline" onClick={() => handleRestore(item)} className="gap-1 text-xs"><RefreshCw className="h-3 w-3" /> Restore</Button>
                <Button size="sm" variant="ghost" onClick={() => handlePermanentDelete(item)} className="text-destructive text-xs"><Trash2 className="h-3 w-3" /> Delete</Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Institutions Review Tab
// ─────────────────────────────────────────────────────────────────────────────

interface PendingInstitution {
  id: string;
  type: "university" | "course";
  value: string;
  submitted_by: string | null;
  submitted_at: string;
  status: "pending" | "approved" | "rejected";
}

function InstitutionsTab() {
  const [items, setItems] = useState<PendingInstitution[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [updating, setUpdating] = useState<string | null>(null);
  const { toast } = useToast();
  const { isAdmin, loading: authLoading } = useAuth();

  const load = async () => {
    setLoading(true);
    let query = (supabase as any)
      .from("pending_institutions")
      .select("*")
      .order("submitted_at", { ascending: false });
    if (filter !== "all") query = query.eq("status", filter);
    const { data } = await query;
    setItems((data as PendingInstitution[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [filter]);

  const updateStatus = async (id: string, status: "approved" | "rejected") => {
    setUpdating(id);
    const { error } = await (supabase as any)
      .from("pending_institutions")
      .update({ status, reviewed_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      toast({ title: "Failed to update", variant: "destructive" });
    } else {
      toast({ title: status === "approved" ? "Approved — now visible to students" : "Rejected" });
      setItems((prev) => prev.filter((i) => i.id !== id));
    }
    setUpdating(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-serif text-xl font-bold text-foreground">Institutions Review</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Student-submitted universities and courses pending your approval.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {(["pending", "approved", "rejected", "all"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                filter === f ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}>
              {f}
            </button>
          ))}
          <Button size="sm" variant="outline" onClick={load}><RefreshCw className="h-3.5 w-3.5" /></Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center text-muted-foreground text-sm">
          No {filter === "all" ? "" : filter} submissions found.
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 flex-wrap">
              <div className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide shrink-0 ${
                item.type === "university" ? "bg-blue-500/10 text-blue-500" : "bg-purple-500/10 text-purple-500"
              }`}>
                {item.type}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{item.value}</p>
                <p className="text-xs text-muted-foreground">
                  By {item.submitted_by || "Anonymous"} · {new Date(item.submitted_at).toLocaleDateString()}
                </p>
              </div>
              <div className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize shrink-0 ${
                item.status === "pending" ? "bg-amber-500/10 text-amber-500"
                : item.status === "approved" ? "bg-green-500/10 text-green-500"
                : "bg-destructive/10 text-destructive"
              }`}>
                {item.status}
              </div>
              {item.status === "pending" && (
                <div className="flex items-center gap-2 shrink-0">
                  <Button size="sm" onClick={() => updateStatus(item.id, "approved")}
                    disabled={updating === item.id}
                    className="gap-1 bg-green-600 hover:bg-green-700 text-white h-8 px-3 text-xs">
                    {updating === item.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                    Approve
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => updateStatus(item.id, "rejected")}
                    disabled={updating === item.id}
                    className="gap-1 text-destructive border-destructive/30 hover:bg-destructive/10 h-8 px-3 text-xs">
                    <X className="h-3 w-3" /> Reject
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Bulk Cleanup Tab
// ─────────────────────────────────────────────────────────────────────────────

interface CleanupResult {
  id: string;
  title: string;
  category: string;
  issues: string[];
  fixes: Record<string, any>;
  word_count: number;
}

const CLEANUP_YEAR_OPTIONS = ["All", "Year 1", "Year 2", "Year 3", "Year 4", "Year 5"] as const;

function BulkCleanupTab({ onEditArticle }: { onEditArticle: (id: string) => void }) {
  const { toast } = useToast();
  const { isAdmin, loading: authLoading } = useAuth();
  const [scanning, setScanning] = useState(false);
  const [results, setResults] = useState<CleanupResult[]>([]);
  const [fixing, setFixing] = useState<string | null>(null);
  const [autoFixing, setAutoFixing] = useState(false);
  const [migratingMcqs, setMigratingMcqs] = useState(false);
  const [aiFixing, setAiFixing] = useState(false);
  const [manualFixing, setManualFixing] = useState(false);
  const [cleanupYear, setCleanupYear] = useState<(typeof CLEANUP_YEAR_OPTIONS)[number]>("Year 1");
  const [scanProgress, setScanProgress] = useState({ scanned: 0, done: false });
  const [fixLog, setFixLog] = useState<string[]>([]);

  const anyRunning = scanning || autoFixing || migratingMcqs || aiFixing || manualFixing;
  const scopeLabel = cleanupYear === "All" ? "all years" : cleanupYear;

  const handleScan = async () => {
    setScanning(true);
    setResults([]);
    setScanProgress({ scanned: 0, done: false });
    setFixLog([]);

    let cursor: string | null = null;
    let scanned = 0;
    const allResults: CleanupResult[] = [];

    while (true) {
      try {
        const { data, error } = await supabase.functions.invoke("bulk-cleanup", {
          body: { action: "scan", batch_size: 8, cursor, year: cleanupYear },
        });
        if (error) throw new Error(error.message);

        const processed = Number(data?.processed || 0);
        scanned += processed;
        if (data?.results) allResults.push(...(data.results as CleanupResult[]));

        setScanProgress({ scanned, done: Boolean(data?.done) });
        setResults([...allResults]);

        if (data?.done) break;
        const nextCursor = (data?.next_cursor as string | null) || null;
        if (!nextCursor || nextCursor === cursor) break;
        cursor = nextCursor;
      } catch (err: any) {
        toast({ title: "Scan error", description: err.message, variant: "destructive" });
        break;
      }
    }

    setScanning(false);
    toast({ title: `Scan complete (${scopeLabel}): ${allResults.length} notes need review` });
  };

  const handleFix = async (item: CleanupResult) => {
    setFixing(item.id);
    try {
      const { data, error } = await supabase.functions.invoke("bulk-cleanup", {
        body: { action: "fix", article_id: item.id, fixes: item.fixes },
      });
      if (error) throw new Error(error.message);
      const changeText = (data?.changes || []).join(", ") || "Updated";
      setFixLog((prev) => [...prev, `✅ ${item.title}: ${changeText}`]);
      setResults((prev) => prev.filter((r) => r.id !== item.id));
      toast({ title: "Fixed", description: changeText });
    } catch (err: any) {
      setFixLog((prev) => [...prev, `❌ ${item.title}: ${err.message}`]);
      toast({ title: "Fix failed", description: err.message, variant: "destructive" });
    } finally {
      setFixing(null);
    }
  };

  const handleAutoFixAll = async () => {
    setAutoFixing(true);
    setFixLog([]);

    let cursor: string | null = null;
    let totalFixed = 0;
    let totalFailed = 0;
    let totalSkipped = 0;

    while (true) {
      try {
        const { data, error } = await supabase.functions.invoke("bulk-cleanup", {
          body: { action: "fix_all_safe", batch_size: 6, cursor, year: cleanupYear },
        });
        if (error) throw new Error(error.message);

        const fixed = Number(data?.fixed || 0);
        const failed = Number(data?.failed || 0);
        const skipped = Number(data?.skipped || 0);
        const processed = Number(data?.processed || 0);

        totalFixed += fixed;
        totalFailed += failed;
        totalSkipped += skipped;

        setFixLog((prev) => [
          ...prev,
          `Auto-fix batch (${scopeLabel}): ${fixed} fixed · ${failed} failed · ${skipped} skipped (${processed} checked)`,
        ]);

        if (data?.done) break;
        const nextCursor = (data?.next_cursor as string | null) || null;
        if (!nextCursor || nextCursor === cursor) break;
        cursor = nextCursor;
      } catch (err: any) {
        setFixLog((prev) => [...prev, `Error: ${err.message}`]);
        break;
      }
    }

    setAutoFixing(false);
    toast({ title: `Auto-fix done (${scopeLabel}): ${totalFixed} fixed · ${totalFailed} failed · ${totalSkipped} skipped` });
  };

  const handleMigrateMcqs = async () => {
    setMigratingMcqs(true);
    setFixLog([]);

    let cursor: string | null = null;
    let totalMigrated = 0;

    while (true) {
      try {
        const { data, error } = await supabase.functions.invoke("bulk-cleanup", {
          body: { action: "migrate_mcqs", batch_size: 4, cursor, year: cleanupYear },
        });
        if (error) throw new Error(error.message);

        const migrated = Number(data?.migrated || 0);
        totalMigrated += migrated;

        if (data?.migratedArticles?.length) {
          setFixLog((prev) => [
            ...prev,
            ...(data.migratedArticles as string[]).map((a: string) => `📝→📋 ${a}`),
          ]);
        } else {
          setFixLog((prev) => [...prev, `MCQ migration batch (${scopeLabel}): ${migrated} migrated`]);
        }

        if (data?.done) break;
        const nextCursor = (data?.next_cursor as string | null) || null;
        if (!nextCursor || nextCursor === cursor) break;
        cursor = nextCursor;
      } catch (err: any) {
        setFixLog((prev) => [...prev, `Error: ${err.message}`]);
        break;
      }
    }

    setMigratingMcqs(false);
    toast({ title: `MCQ migration complete (${scopeLabel}): ${totalMigrated} notes converted` });
  };

  const handleManualCleanup = async () => {
    setManualFixing(true);
    setFixLog([]);

    let cursor: string | null = null;
    let totals = { updated: 0, mcqs: 0, essays: 0, deleted: 0, failed: 0, skipped: 0 };

    while (true) {
      try {
        const { data, error } = await supabase.functions.invoke("bulk-cleanup", {
          body: { action: "cleanup_non_ai_batch", batch_size: 6, cursor, year: cleanupYear },
        });
        if (error) throw new Error(error.message);

        totals.updated += Number(data?.updated || 0);
        totals.mcqs += Number(data?.migrated_mcqs || 0);
        totals.essays += Number(data?.migrated_essays || 0);
        totals.deleted += Number(data?.deleted || 0);
        totals.failed += Number(data?.failed || 0);
        totals.skipped += Number(data?.skipped || 0);

        const processedArticles = (data?.processed_articles || []) as Array<{ id: string; title: string; action: string; details?: string }>;
        if (processedArticles.length) {
          setFixLog((prev) => [
            ...prev,
            ...processedArticles.map((a) => `Manual: ${a.title || a.id} → ${a.action}${a.details ? ` (${a.details})` : ""}`),
          ]);
          const touched = new Set(processedArticles.map((a) => a.id));
          setResults((prev) => prev.filter((r) => !touched.has(r.id)));
        }

        if (data?.done) break;
        const nextCursor = (data?.next_cursor as string | null) || null;
        if (!nextCursor || nextCursor === cursor) break;
        cursor = nextCursor;
      } catch (err: any) {
        setFixLog((prev) => [...prev, `Manual cleanup error: ${err.message}`]);
        break;
      }
    }

    setManualFixing(false);
    toast({
      title: `Manual cleanup done (${scopeLabel}): ${totals.updated} updated · ${totals.mcqs} MCQ · ${totals.essays} essay · ${totals.deleted} deleted · ${totals.failed} failed`,
    });
  };

  const handleAiFixAll = async () => {
    setAiFixing(true);
    setFixLog([]);

    let cursor: string | null = null;
    let totals = { fixed: 0, mcqs: 0, essays: 0, deleted: 0, failed: 0 };

    while (true) {
      try {
        const { data, error } = await supabase.functions.invoke("bulk-cleanup", {
          body: { action: "ai_fix_batch", batch_size: 1, cursor, year: cleanupYear },
        });
        if (error) throw new Error(error.message);

        totals.fixed += Number(data?.fixed || 0);
        totals.mcqs += Number(data?.migrated_mcqs || 0);
        totals.essays += Number(data?.migrated_essays || 0);
        totals.deleted += Number(data?.deleted || 0);
        totals.failed += Number(data?.failed || 0);

        const processedArticles = (data?.processed_articles || []) as Array<{ id: string; title: string; action: string }>;
        if (processedArticles.length) {
          setFixLog((prev) => [
            ...prev,
            ...processedArticles.map((a) => `AI: ${a.title || a.id} → ${a.action}`),
          ]);
          const touched = new Set(processedArticles.map((a) => a.id));
          setResults((prev) => prev.filter((r) => !touched.has(r.id)));
        }

        if (data?.done) break;
        const nextCursor = (data?.next_cursor as string | null) || null;
        if (!nextCursor || nextCursor === cursor) break;
        cursor = nextCursor;
        await new Promise((resolve) => setTimeout(resolve, 300));
      } catch (err: any) {
        setFixLog((prev) => [...prev, `AI Error: ${err.message}`]);
        break;
      }
    }

    setAiFixing(false);
    toast({
      title: `AI cleanup done (${scopeLabel}): ${totals.fixed} updated · ${totals.mcqs} MCQ migrations · ${totals.essays} essay migrations · ${totals.deleted} deleted · ${totals.failed} failed`,
    });
  };

  const mcqArticles = results.filter((r) => r.fixes.migrate_mcqs);
  const manualReview = results.filter((r) => r.fixes.manual_review);
  const formatIssues = results.filter((r) => !r.fixes.migrate_mcqs && !r.fixes.manual_review);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-2">
          <Wrench className="h-5 w-5 text-primary" />
          <h3 className="font-serif text-lg font-bold text-foreground">Bulk Article Cleanup</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Run cleanup in safe batches. Start with Year 1 using Manual Cleanup (No AI) to avoid AI rate-limit errors.
        </p>

        <div className="mb-3 flex flex-wrap items-center gap-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Year scope</label>
          <select
            value={cleanupYear}
            onChange={(e) => setCleanupYear(e.target.value as (typeof CLEANUP_YEAR_OPTIONS)[number])}
            className="rounded-lg border border-input bg-background px-3 py-2 text-xs font-medium text-foreground"
            aria-label="Select cleanup year"
            disabled={anyRunning}
          >
            {CLEANUP_YEAR_OPTIONS.map((year) => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={handleScan} disabled={anyRunning} className="gap-2">
            {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {scanning ? `Scanning... (${scanProgress.scanned} checked)` : "Scan Articles"}
          </Button>

          <Button onClick={handleManualCleanup} disabled={anyRunning} variant="default" className="gap-2">
            {manualFixing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wrench className="h-4 w-4" />}
            {manualFixing ? "Manual Cleaning..." : "Manual Cleanup (No AI)"}
          </Button>

          <Button onClick={handleAutoFixAll} disabled={anyRunning} variant="outline" className="gap-2">
            {autoFixing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
            {autoFixing ? "Fixing..." : "Auto-Fix Formatting"}
          </Button>

          <Button onClick={handleMigrateMcqs} disabled={anyRunning} variant="outline" className="gap-2">
            {migratingMcqs ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bolt className="h-4 w-4" />}
            {migratingMcqs ? "Migrating..." : "Migrate MCQ Articles"}
          </Button>

          <Button onClick={handleAiFixAll} disabled={anyRunning} variant="outline" className="gap-2">
            {aiFixing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {aiFixing ? "AI Cleaning..." : "AI Cleanup (Lovable AI)"}
          </Button>
        </div>
      </div>

      {fixLog.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <h4 className="text-sm font-bold text-foreground mb-2">Activity Log</h4>
          <div className="max-h-56 overflow-y-auto space-y-0.5 text-xs text-muted-foreground font-mono">
            {fixLog.map((log, i) => <p key={i}>{log}</p>)}
          </div>
        </div>
      )}

      {manualReview.length > 0 && (
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
            {manualReview.length} articles need manual review (very large or complex)
          </p>
          <div className="space-y-2">
            {manualReview.map((item) => (
              <div key={item.id} className="flex items-center justify-between rounded-xl border border-border bg-card p-4">
                <div className="min-w-0 flex-1">
                  <h5 className="font-medium text-foreground text-sm truncate">{item.title}</h5>
                  <p className="text-xs text-muted-foreground">{item.category} · {item.word_count} words</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => onEditArticle(item.id)} className="ml-3 gap-1 shrink-0">
                  <Pencil className="h-3 w-3" />
                  Open editor
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {mcqArticles.length > 0 && (
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
            {mcqArticles.length} articles contain MCQs (should migrate)
          </p>
          <div className="space-y-2">
            {mcqArticles.map((item) => (
              <div key={item.id} className="flex items-center justify-between rounded-xl border border-border bg-card p-4">
                <div className="min-w-0 flex-1">
                  <h5 className="font-medium text-foreground text-sm truncate">{item.title}</h5>
                  <p className="text-xs text-muted-foreground">{item.category} · {item.fixes.mcq_count} MCQs detected · {item.word_count} words</p>
                </div>
                <div className="flex items-center gap-2 ml-3 shrink-0">
                  <Button size="sm" variant="outline" onClick={() => onEditArticle(item.id)}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleFix(item)} disabled={fixing === item.id} className="gap-1">
                    {fixing === item.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Bolt className="h-3 w-3" />}
                    Migrate
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {formatIssues.length > 0 && (
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
            {formatIssues.length} articles with formatting/category issues
          </p>
          <div className="space-y-2">
            {formatIssues.map((item) => (
              <div key={item.id} className="flex items-center justify-between rounded-xl border border-border bg-card p-4">
                <div className="min-w-0 flex-1">
                  <h5 className="font-medium text-foreground text-sm truncate">{item.title}</h5>
                  <p className="text-xs text-muted-foreground">{item.category} · {item.word_count} words</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {item.issues.map((issue, i) => (
                      <span key={i} className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{issue}</span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-3 shrink-0">
                  <Button size="sm" variant="outline" onClick={() => onEditArticle(item.id)}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleFix(item)} disabled={fixing === item.id} className="gap-1">
                    {fixing === item.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wrench className="h-3 w-3" />}
                    Fix
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {results.length === 0 && !scanning && scanProgress.done && (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-4xl mb-3">✨</p>
          <p className="font-medium text-foreground">All scanned articles look clean for {scopeLabel}.</p>
        </div>
      )}
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// Content Upgrade Tab (Gemini AI)
// ─────────────────────────────────────────────────────────────────────────────

interface UpgradeSuggestion {
  id: string;
  title: string;
  suggestion: string;
  type: string;
  priority: string;
  auto_safe: boolean;
}

function ContentUpgradeTab() {
  const [scanning, setScanning] = useState(false);
  const [suggestions, setSuggestions] = useState<UpgradeSuggestion[]>([]);
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ id: string; title: string; content: string } | null>(null);
  const [applying, setApplying] = useState(false);
  const { toast } = useToast();
  const { isAdmin, loading: authLoading } = useAuth();

  const handleScan = async () => {
    setScanning(true);
    setSuggestions([]);
    try {
      const { data, error } = await supabase.functions.invoke("content-upgrade", {
        body: { action: "scan" },
      });
      if (error) throw new Error(error.message);
      setSuggestions(data?.suggestions || []);
      if (!data?.suggestions?.length) {
        toast({ title: "All content looks good! No upgrades needed." });
      }
    } catch (err: any) {
      toast({ title: "Scan failed", description: err.message, variant: "destructive" });
    } finally {
      setScanning(false);
    }
  };

  const handleUpgrade = async (s: UpgradeSuggestion) => {
    setUpgrading(s.id);
    try {
      const { data, error } = await supabase.functions.invoke("content-upgrade", {
        body: { action: "upgrade", id: s.id, type: s.type },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      setPreview({ id: data.id, title: data.title, content: data.improved_content });
      toast({ title: "Upgrade preview ready — review before applying." });
    } catch (err: any) {
      toast({ title: "Upgrade failed", description: err.message, variant: "destructive" });
    } finally {
      setUpgrading(null);
    }
  };

  const handleApply = async () => {
    if (!preview) return;
    setApplying(true);
    try {
      const { data, error } = await supabase.functions.invoke("content-upgrade", {
        body: { action: "apply", id: preview.id, content: preview.content },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      toast({ title: "Upgrade applied successfully!" });
      setPreview(null);
      setSuggestions((prev) => prev.filter((s) => s.id !== preview.id));
    } catch (err: any) {
      toast({ title: "Apply failed", description: err.message, variant: "destructive" });
    } finally {
      setApplying(false);
    }
  };

  const autoApplyAll = async () => {
    const safeSuggestions = suggestions.filter((s) => s.auto_safe);
    if (!safeSuggestions.length) {
      toast({ title: "No auto-safe upgrades to apply" });
      return;
    }
    for (const s of safeSuggestions) {
      setUpgrading(s.id);
      try {
        const { data } = await supabase.functions.invoke("content-upgrade", {
          body: { action: "upgrade", id: s.id, type: s.type },
        });
        if (data?.improved_content) {
          await supabase.functions.invoke("content-upgrade", {
            body: { action: "apply", id: s.id, content: data.improved_content },
          });
        }
      } catch { /* skip */ }
      setUpgrading(null);
    }
    setSuggestions((prev) => prev.filter((s) => !s.auto_safe));
    toast({ title: "Auto-safe upgrades applied!" });
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h3 className="font-serif text-lg font-bold text-foreground">AI Content Upgrade</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Scan your published articles for formatting issues, missing details, and suggest AI-powered improvements.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={handleScan} disabled={scanning} className="gap-2">
            {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {scanning ? "Scanning..." : "Scan Content"}
          </Button>
          {suggestions.filter((s) => s.auto_safe).length > 0 && (
            <Button onClick={autoApplyAll} variant="outline" className="gap-2">
              <Zap className="h-4 w-4" /> Auto-Apply Safe Upgrades ({suggestions.filter((s) => s.auto_safe).length})
            </Button>
          )}
        </div>
      </div>

      {preview && (
        <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-foreground flex items-center gap-2">
              <Eye className="h-4 w-4 text-primary" /> Preview: {preview.title}
            </h4>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleApply} disabled={applying} className="gap-1">
                {applying ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                Apply Upgrade
              </Button>
              <Button size="sm" variant="outline" onClick={() => setPreview(null)}>Discard</Button>
            </div>
          </div>
          <div className="max-h-96 overflow-y-auto rounded-lg border border-border bg-card p-4 text-sm text-foreground whitespace-pre-wrap">
            {preview.content.slice(0, 3000)}
            {preview.content.length > 3000 && <span className="text-muted-foreground">... ({preview.content.length} chars total)</span>}
          </div>
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{suggestions.length} upgrade suggestions</p>
          {suggestions.map((s) => (
            <div key={s.id} className="flex items-center justify-between rounded-xl border border-border bg-card p-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                    s.priority === "high" ? "bg-destructive/10 text-destructive"
                    : s.priority === "medium" ? "bg-amber-500/10 text-amber-600"
                    : "bg-muted text-muted-foreground"
                  }`}>{s.priority}</span>
                  <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-primary">{s.type}</span>
                  {s.auto_safe && <span className="rounded bg-green-500/10 px-1.5 py-0.5 text-[10px] font-bold text-green-600">AUTO-SAFE</span>}
                </div>
                <h5 className="font-medium text-foreground text-sm truncate">{s.title}</h5>
                <p className="text-xs text-muted-foreground">{s.suggestion}</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => handleUpgrade(s)}
                disabled={upgrading === s.id} className="ml-3 gap-1 shrink-0">
                {upgrading === s.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                Upgrade
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// SEO & Indexing Tab
// ─────────────────────────────────────────────────────────────────────────────

const CLEANUP_SEO_YEARS = ["All", "Year 1", "Year 2", "Year 3", "Year 4", "Year 5", "Year 6"] as const;
const CONTENT_TYPES = ["all", "articles", "stories", "mcqs", "flashcards", "essays"] as const;

function SeoIndexingTab() {
  const { toast } = useToast();
  const { isAdmin, loading: authLoading } = useAuth();
  const [seoYear, setSeoYear] = useState<string>("All");
  const [seoMode, setSeoMode] = useState<"missing" | "all">("missing");
  const [includeUnpublished, setIncludeUnpublished] = useState(true);
  const [seoFields, setSeoFields] = useState({
    title: true,
    meta_title: true,
    meta_description: true,
    slug: true,
    og_image_url: true,
  });
  const [generating, setGenerating] = useState(false);
  const [seoLog, setSeoLog] = useState<string[]>([]);
  const [seoArticles, setSeoArticles] = useState<Array<{
    id: string;
    title: string;
    category: string;
    slug: string;
    meta_title: string;
    meta_description: string;
    og_image_url: string;
    published?: boolean;
    url: string;
    seo_status: "complete" | "missing";
    missing_count: number;
  }>>([]);
  const [loadingArticles, setLoadingArticles] = useState(false);
  const [updatingOne, setUpdatingOne] = useState<string | null>(null);
  const [batches, setBatches] = useState<Array<{ batch_number: number; count: number; urls: any[] }>>([]);
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [submitting, setSubmitting] = useState<number | null>(null);
  const [copiedBatch, setCopiedBatch] = useState<number | null>(null);
  const [siteUrlInput, setSiteUrlInput] = useState("https://ompathstudy.com");
  const [googleApiKey, setGoogleApiKey] = useState("");
  const [contentTypeFilter, setContentTypeFilter] = useState<string>("all");
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [savingSiteUrl, setSavingSiteUrl] = useState(false);

  const sitemapUrl = `${siteUrlInput.replace(/\/+$/, "")}/sitemap-dynamic.xml`;

  const syncSiteUrlConfig = async (showToast = false) => {
    const normalized = siteUrlInput.trim() || "https://ompathstudy.com";
    const { data, error } = await supabase.functions.invoke("google-indexing", {
      body: { action: "set_config", site_url: normalized },
    });
    if (error) throw new Error(error.message);

    const nextUrl = data?.base_url || normalized;
    setSiteUrlInput(nextUrl);
    if (showToast) toast({ title: "Site URL saved" });
    return nextUrl;
  };

  const loadSiteUrlConfig = async () => {
    setLoadingConfig(true);
    try {
      const { data, error } = await supabase.functions.invoke("google-indexing", {
        body: { action: "get_config" },
      });
      if (error) throw new Error(error.message);
      if (data?.base_url) setSiteUrlInput(data.base_url);
    } catch {
      // keep local default
    } finally {
      setLoadingConfig(false);
    }
  };

  const handleLoadSeoArticles = async () => {
    setLoadingArticles(true);
    try {
      await syncSiteUrlConfig();
      const all: any[] = [];
      let cursor: string | null = null;
      let done = false;
      let guard = 0;

      while (!done && guard < 40) {
        const { data, error } = await supabase.functions.invoke("content-upgrade", {
          body: {
            action: "list_articles_seo",
            year: seoYear === "All" ? null : seoYear,
            include_unpublished: includeUnpublished,
            site_url: siteUrlInput,
            batch_size: 150,
            cursor,
          },
        });
        if (error) throw new Error(error.message);

        const chunk = Array.isArray(data?.articles) ? data.articles : [];
        all.push(...chunk);
        done = Boolean(data?.done);
        const nextCursor = typeof data?.next_cursor === "string" ? data.next_cursor : null;
        if (!nextCursor || nextCursor === cursor) break;
        cursor = nextCursor;
        guard += 1;
      }

      setSeoArticles(all);
    } catch (err: any) {
      toast({ title: "Failed to load articles", description: err.message, variant: "destructive" });
    } finally {
      setLoadingArticles(false);
    }
  };

  const handleGenerateSeo = async () => {
    setGenerating(true);
    setSeoLog([]);

    let cursor: string | null = null;
    let totalUpdated = 0;

    try {
      await syncSiteUrlConfig();
    } catch (err: any) {
      setGenerating(false);
      toast({ title: "Failed to save site URL", description: err.message, variant: "destructive" });
      return;
    }

    while (true) {
      try {
        const { data, error } = await supabase.functions.invoke("content-upgrade", {
          body: {
            action: "generate_seo",
            batch_size: 8,
            cursor,
            year: seoYear === "All" ? null : seoYear,
            include_all: seoMode === "all",
            include_unpublished: includeUnpublished,
            fields: seoFields,
            site_url: siteUrlInput,
          },
        });
        if (error) throw new Error(error.message);

        totalUpdated += Number(data?.updated || 0);

        const processedArticles = (data?.processed_articles || []) as Array<{ id: string; title: string; action: string }>;
        if (processedArticles.length) {
          setSeoLog((prev) => [...prev, ...processedArticles.map((a) => `SEO: ${a.title} → ${a.action}`)]);
        }

        if (data?.done) break;
        const nextCursor = (data?.next_cursor as string | null) || null;
        if (!nextCursor || nextCursor === cursor) break;
        cursor = nextCursor;
      } catch (err: any) {
        setSeoLog((prev) => [...prev, `Error: ${err.message}`]);
        break;
      }
    }

    setGenerating(false);
    await handleLoadSeoArticles();
    toast({ title: `SEO generation done: ${totalUpdated} articles updated` });
  };

  const handleGenerateSingle = async (id: string) => {
    setUpdatingOne(id);
    try {
      const { data, error } = await supabase.functions.invoke("content-upgrade", {
        body: { action: "generate_seo_single", id, fields: seoFields, site_url: siteUrlInput },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      await handleLoadSeoArticles();
      toast({ title: "SEO updated for article" });
    } catch (err: any) {
      toast({ title: "SEO update failed", description: err.message, variant: "destructive" });
    } finally {
      setUpdatingOne(null);
    }
  };

  const handleLoadBatches = async () => {
    setLoadingBatches(true);
    try {
      await syncSiteUrlConfig();
      const { data, error } = await supabase.functions.invoke("google-indexing", {
        body: { action: "list_all_urls", year: seoYear === "All" ? null : seoYear, content_type: contentTypeFilter, site_url: siteUrlInput },
      });
      if (error) throw new Error(error.message);
      setBatches(data?.batches || []);
      toast({ title: `${data?.total || 0} URLs in ${data?.batch_count || 0} batches` });
    } catch (err: any) {
      const description = err.message?.includes("FunctionsHttpError") || err.message?.includes("404")
        ? "Indexing service is not available yet."
        : err.message;
      toast({ title: "Failed to load batches", description, variant: "destructive" });
    } finally {
      setLoadingBatches(false);
    }
  };

  const handleCopyBatchUrls = async (batchNumber: number) => {
    const batch = batches.find(b => b.batch_number === batchNumber);
    if (!batch) return;
    const urlsText = batch.urls.map((u: any) => u.url).join("\n");
    await navigator.clipboard.writeText(urlsText);
    setCopiedBatch(batchNumber);
    setTimeout(() => setCopiedBatch(null), 2000);
    toast({ title: `Copied ${batch.count} URLs from batch ${batchNumber}` });
  };

  const handleSubmitBatch = async (batchNumber: number) => {
    setSubmitting(batchNumber);
    try {
      const batch = batches.find(b => b.batch_number === batchNumber);
      if (!batch) throw new Error("Batch not found");
      const urls = batch.urls.map((u: any) => u.url);

      const { data, error } = await supabase.functions.invoke("google-indexing", {
        body: { action: "submit_to_google", urls, google_api_key: googleApiKey.trim() || undefined },
      });
      if (error) throw new Error(error.message);

      if (data?.method === "manual") {
        await navigator.clipboard.writeText(data.urls_text || "");
        toast({ title: "URLs copied for manual submission" });
      } else {
        toast({ title: `Submitted: ${data?.submitted || 0} URLs, Failed: ${data?.failed || 0}` });
      }
    } catch (err: any) {
      toast({ title: "Submission failed", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(null);
    }
  };

  useEffect(() => {
    loadSiteUrlConfig();
  }, []);

  useEffect(() => {
    handleLoadSeoArticles();
  }, [seoYear]);

  const completeCount = seoArticles.filter((a) => a.seo_status === "complete").length;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Search className="h-5 w-5 text-primary" />
          <h3 className="font-serif text-lg font-bold text-foreground">Generate SEO Metadata</h3>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select value={seoYear} onChange={(e) => setSeoYear(e.target.value)} className="rounded-lg border border-input bg-background px-3 py-2 text-xs font-medium text-foreground" disabled={generating || loadingArticles}>
            {CLEANUP_SEO_YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <select value={seoMode} onChange={(e) => setSeoMode(e.target.value as "missing" | "all")} className="rounded-lg border border-input bg-background px-3 py-2 text-xs font-medium text-foreground" disabled={generating}>
            <option value="missing">Only missing SEO</option>
            <option value="all">Regenerate all articles</option>
          </select>
          <label className="flex items-center gap-2 rounded-lg border border-input bg-background px-3 py-2 text-xs font-medium text-foreground">
            <input type="checkbox" checked={includeUnpublished} onChange={(e) => setIncludeUnpublished(e.target.checked)} /> Include drafts/raw
          </label>
          <Button onClick={handleGenerateSeo} disabled={generating} className="gap-2">
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {generating ? "Generating..." : "Generate SEO"}
          </Button>
          <Button onClick={handleLoadSeoArticles} disabled={loadingArticles} variant="outline" className="gap-2">
            {loadingArticles ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Refresh list
          </Button>
        </div>

        <div className="grid gap-2 md:grid-cols-[1fr_auto_1fr]">
          <Input value={siteUrlInput} onChange={(e) => setSiteUrlInput(e.target.value)} placeholder="https://yourdomain.com" disabled={loadingConfig || savingSiteUrl} />
          <Button
            variant="outline"
            className="gap-2"
            disabled={loadingConfig || savingSiteUrl}
            onClick={async () => {
              setSavingSiteUrl(true);
              try {
                await syncSiteUrlConfig(true);
              } catch (err: any) {
                toast({ title: "Failed to save site URL", description: err.message, variant: "destructive" });
              } finally {
                setSavingSiteUrl(false);
              }
            }}
          >
            {loadingConfig || savingSiteUrl ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />}
            {loadingConfig ? "Loading..." : savingSiteUrl ? "Saving..." : "Save URL"}
          </Button>
          <Input value={googleApiKey} onChange={(e) => setGoogleApiKey(e.target.value)} placeholder="Google API key (optional for direct submit)" />
        </div>

        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          <label className="flex items-center gap-1"><input type="checkbox" checked={seoFields.title} onChange={(e) => setSeoFields((p) => ({ ...p, title: e.target.checked }))} /> Title</label>
          <label className="flex items-center gap-1"><input type="checkbox" checked={seoFields.meta_title} onChange={(e) => setSeoFields((p) => ({ ...p, meta_title: e.target.checked }))} /> Meta title</label>
          <label className="flex items-center gap-1"><input type="checkbox" checked={seoFields.meta_description} onChange={(e) => setSeoFields((p) => ({ ...p, meta_description: e.target.checked }))} /> Meta description</label>
          <label className="flex items-center gap-1"><input type="checkbox" checked={seoFields.slug} onChange={(e) => setSeoFields((p) => ({ ...p, slug: e.target.checked }))} /> Slug</label>
          <label className="flex items-center gap-1"><input type="checkbox" checked={seoFields.og_image_url} onChange={(e) => setSeoFields((p) => ({ ...p, og_image_url: e.target.checked }))} /> Thumbnail URL</label>
        </div>

        <p className="text-xs text-muted-foreground">{seoArticles.length} articles · {completeCount} complete · {seoArticles.length - completeCount} missing fields</p>
      </div>

      {seoLog.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <h4 className="text-sm font-bold text-foreground mb-2">SEO Activity Log</h4>
          <div className="max-h-56 overflow-y-auto space-y-0.5 text-xs text-muted-foreground font-mono">
            {seoLog.map((log, i) => <p key={i}>{log}</p>)}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Globe className="h-5 w-5 text-primary" />
          <h3 className="font-serif text-lg font-bold text-foreground">Google Indexing – All Content</h3>
        </div>
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
          <p className="text-xs font-semibold text-primary mb-1">Sitemap URL</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs text-foreground bg-background rounded px-2 py-1 border border-border break-all">{sitemapUrl}</code>
            <Button size="sm" variant="outline" className="shrink-0 gap-1" onClick={() => { navigator.clipboard.writeText(sitemapUrl); toast({ title: "Sitemap URL copied" }); }}>
              <Copy className="h-3 w-3" /> Copy
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={contentTypeFilter} onChange={(e) => setContentTypeFilter(e.target.value)} className="rounded-lg border border-input bg-background px-3 py-2 text-xs font-medium text-foreground">
            {CONTENT_TYPES.map((t) => <option key={t} value={t}>{t === "all" ? "All Content" : t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
          </select>
          <Button onClick={handleLoadBatches} disabled={loadingBatches} className="gap-2">
            {loadingBatches ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />}
            {loadingBatches ? "Loading..." : "Load All URLs"}
          </Button>
        </div>
      </div>

      {batches.length > 0 && (
        <div className="space-y-3">
          {batches.map((batch) => (
            <div key={batch.batch_number} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h5 className="font-medium text-foreground">Batch {batch.batch_number}</h5>
                  <p className="text-xs text-muted-foreground">{batch.count} URLs</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => handleCopyBatchUrls(batch.batch_number)} className="gap-1">
                    {copiedBatch === batch.batch_number ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    {copiedBatch === batch.batch_number ? "Copied" : "Copy URLs"}
                  </Button>
                  <Button size="sm" onClick={() => handleSubmitBatch(batch.batch_number)} disabled={submitting === batch.batch_number} className="gap-1">
                    {submitting === batch.batch_number ? <Loader2 className="h-3 w-3 animate-spin" /> : <ExternalLink className="h-3 w-3" />} Submit
                  </Button>
                </div>
              </div>
              <div className="max-h-40 overflow-auto space-y-1">
                {batch.urls.map((u: any) => (
                  <div key={u.id} className="flex items-center gap-2 text-xs">
                    <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                      u.type === "article" ? "bg-primary/10 text-primary"
                      : u.type === "story" ? "bg-purple-500/10 text-purple-600"
                      : u.type === "mcq" ? "bg-amber-500/10 text-amber-600"
                      : u.type === "flashcard" ? "bg-blue-500/10 text-blue-600"
                      : "bg-green-500/10 text-green-600"
                    }`}>{u.type}</span>
                    <span className="truncate text-muted-foreground">{u.title}</span>
                    {!u.has_meta && <span className="shrink-0 text-[10px] text-destructive font-semibold">SEO ✗</span>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <h4 className="text-sm font-bold text-foreground">All Articles SEO Status</h4>
        <div className="max-h-[34rem] overflow-auto space-y-2">
          {seoArticles.map((a) => (
            <div key={a.id} className="rounded-lg border border-border bg-background p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{a.title}</p>
                  <p className="text-xs text-muted-foreground">{a.category}</p>
                  <p className="text-xs text-muted-foreground break-all">{a.url}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button size="sm" variant="outline" className="gap-1" onClick={() => { navigator.clipboard.writeText(a.url); toast({ title: "Share URL copied" }); }}>
                    <Copy className="h-3 w-3" /> URL
                  </Button>
                  <Button size="sm" onClick={() => handleGenerateSingle(a.id)} disabled={updatingOne === a.id} className="gap-1">
                    {updatingOne === a.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />} Update
                  </Button>
                </div>
              </div>
              <div className="mt-2 grid gap-1 text-xs text-muted-foreground">
                <p><span className="font-semibold text-foreground">Meta title:</span> {a.meta_title || "Missing"}</p>
                <p><span className="font-semibold text-foreground">Meta description:</span> {a.meta_description || "Missing"}</p>
                <p><span className="font-semibold text-foreground">Slug:</span> {a.slug || "Missing"}</p>
                <p><span className="font-semibold text-foreground">Thumbnail:</span> {a.og_image_url ? "Set" : "Missing"}</p>
              </div>
            </div>
          ))}
          {!loadingArticles && seoArticles.length === 0 && <p className="text-sm text-muted-foreground">No articles found for this filter.</p>}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Stories Management Tab
// ─────────────────────────────────────────────────────────────────────────────

function StoriesTab() {
  const { toast } = useToast();
  const { isAdmin, loading: authLoading } = useAuth();
  const [stories, setStories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editCoverUrl, setEditCoverUrl] = useState("");
  const [editMetaTitle, setEditMetaTitle] = useState("");
  const [editMetaDescription, setEditMetaDescription] = useState("");
  const [editSlug, setEditSlug] = useState("");
  const [editOgImage, setEditOgImage] = useState("");
  const [saving, setSaving] = useState(false);
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });
  const [pendingStories, setPendingStories] = useState<any[]>([]);

  const fetchStories = async () => {
    setLoading(true);
    const { data } = await supabase.from("stories").select("*").is("deleted_at", null).order("created_at", { ascending: false });
    setStories(data || []);
    setLoading(false);
  };

  const fetchPending = async () => {
    const { data } = await supabase.from("stories").select("*").eq("published", false).is("deleted_at", null).order("created_at", { ascending: false });
    setPendingStories(data || []);
  };

  useEffect(() => { fetchStories(); fetchPending(); }, []);

  const handleEdit = (story: any) => {
    setEditId(story.id);
    setEditTitle(story.title);
    setEditContent(story.content);
    setEditCategory(story.category);
    setEditCoverUrl(story.cover_image_url || "");
    setEditMetaTitle(story.meta_title || "");
    setEditMetaDescription(story.meta_description || "");
    setEditSlug(story.slug || "");
    setEditOgImage(story.og_image_url || "");
  };

  const handleSave = async () => {
    if (!editId) return;
    setSaving(true);
    const { error } = await supabase.from("stories").update({
      title: editTitle,
      content: editContent,
      category: editCategory,
      cover_image_url: editCoverUrl || null,
      meta_title: editMetaTitle,
      meta_description: editMetaDescription,
      slug: editSlug,
      og_image_url: editOgImage
    }).eq("id", editId);
    if (error) toast({ title: "Save failed", description: error.message, variant: "destructive" });
    else { toast({ title: "Story updated" }); setEditId(null); fetchStories(); }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("stories").update({ deleted_at: new Date().toISOString() }).eq("id", id);
    if (!error) { toast({ title: "Story deleted" }); fetchStories(); }
  };

  const handleApprove = async (id: string) => {
    const { error, data } = await supabase.from("stories").update({ published: true }).eq("id", id).select("id, title").single();
    if (!error) {
      toast({ title: "Story approved & published" });
      if (data) autoIndexUrls([`${SITE_URL}/stories/${data.id}-${slugifyText(data.title) || "story"}`]);
      fetchStories(); fetchPending();
    }
  };

  const handleBulkAIUpdate = async () => {
    const toUpdate = stories.filter(s => s.content.length < 5000);
    if (!toUpdate.length) { toast({ title: "All stories are already well-formatted" }); return; }
    setBulkUpdating(true);
    setBulkProgress({ done: 0, total: toUpdate.length });

    for (let i = 0; i < toUpdate.length; i++) {
      try {
        const { data, error } = await supabase.functions.invoke("generate-content", {
          body: { notes: toUpdate[i].content, type: "expand-story", title: toUpdate[i].title },
        });
        if (!error && data?.content) {
          await supabase.from("stories").update({
            content: data.content,
            title: data.title || toUpdate[i].title,
          }).eq("id", toUpdate[i].id);
        }
      } catch { /* continue */ }
      setBulkProgress({ done: i + 1, total: toUpdate.length });
    }

    setBulkUpdating(false);
    toast({ title: "Bulk update complete!" });
    fetchStories();
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  if (editId) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-serif text-lg font-bold text-foreground">Edit Story</h3>
          <Button variant="ghost" size="sm" onClick={() => setEditId(null)}>Cancel</Button>
        </div>
        <Input value={editTitle} onChange={e => setEditTitle(e.target.value)} placeholder="Title" className="font-bold" />
        <Input value={editCategory} onChange={e => setEditCategory(e.target.value)} placeholder="Category" />
        
        <div className="rounded-lg border border-border bg-secondary/30 p-4 space-y-4">
          <h4 className="font-bold text-sm text-foreground flex items-center gap-2">
            <Globe className="h-4 w-4 text-primary" /> SEO & Metadata
          </h4>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-[10px] font-bold uppercase text-muted-foreground mb-1 block">URL Slug</label>
              <Input value={editSlug} onChange={(e) => setEditSlug(e.target.value)} className="text-xs" placeholder="slug-path" />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-muted-foreground mb-1 block">Meta Title</label>
              <Input value={editMetaTitle} onChange={(e) => setEditMetaTitle(e.target.value)} className="text-xs" placeholder="SEO Title" />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-muted-foreground mb-1 block">Meta Description</label>
            <Textarea value={editMetaDescription} onChange={(e) => setEditMetaDescription(e.target.value)} className="text-xs h-20" placeholder="SEO Description" />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-muted-foreground mb-1 block">OG Image URL</label>
            <Input value={editOgImage} onChange={(e) => setEditOgImage(e.target.value)} className="text-xs" placeholder="https://..." />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">Cover Image URL</label>
          <Input value={editCoverUrl} onChange={e => setEditCoverUrl(e.target.value)} placeholder="https://... (paste image URL)" />
          {editCoverUrl && <img src={editCoverUrl} alt="Cover preview" className="mt-2 h-32 w-full rounded-lg object-cover border border-border" />}
        </div>
        <Textarea value={editContent} onChange={e => setEditContent(e.target.value)} className="min-h-[400px] resize-y font-mono text-sm" />
        <div className="flex gap-3">
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save
          </Button>
          <Button variant="outline" onClick={async () => {
            setSaving(true);
            try {
              const { data, error } = await supabase.functions.invoke("generate-content", {
                body: { notes: editContent, type: "expand-story", title: editTitle },
              });
              if (error) throw new Error(error.message);
              if (data?.content) setEditContent(data.content);
              if (data?.title) setEditTitle(data.title);
              toast({ title: "Story expanded with AI" });
            } catch (err: any) {
              toast({ title: "AI expand failed", description: err.message, variant: "destructive" });
            } finally { setSaving(false); }
          }} disabled={saving} className="gap-2">
            <Sparkles className="h-4 w-4" /> Expand with AI
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {pendingStories.length > 0 && (
        <div className="rounded-xl border-2 border-amber-500/30 bg-amber-500/5 p-5">
          <h3 className="font-serif text-lg font-bold text-foreground mb-3 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" /> Pending Submissions ({pendingStories.length})
          </h3>
          <div className="space-y-3">
            {pendingStories.map(s => (
              <div key={s.id} className="rounded-lg border border-border bg-card p-4">
                <h4 className="font-bold text-foreground">{s.title}</h4>
                <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{s.content.slice(0, 200)}...</p>
                <div className="flex gap-2 mt-3">
                  <Button size="sm" onClick={() => handleApprove(s.id)} className="gap-1"><Check className="h-3 w-3" /> Approve</Button>
                  <Button size="sm" variant="outline" onClick={() => handleEdit(s)}>Edit</Button>
                  <Button size="sm" variant="destructive" onClick={() => handleDelete(s.id)} className="gap-1"><Trash2 className="h-3 w-3" /> Delete</Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h3 className="font-serif text-lg font-bold text-foreground">All Stories ({stories.length})</h3>
        <Button onClick={handleBulkAIUpdate} disabled={bulkUpdating} variant="outline" className="gap-2">
          {bulkUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {bulkUpdating ? `Updating ${bulkProgress.done}/${bulkProgress.total}...` : "AI Expand Short Stories"}
        </Button>
      </div>

      {bulkUpdating && (
        <div className="w-full bg-secondary rounded-full h-2">
          <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${(bulkProgress.done / bulkProgress.total) * 100}%` }} />
        </div>
      )}

      <div className="space-y-3">
        {stories.map(s => (
          <div key={s.id} className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-foreground truncate">{s.title}</h4>
                  {!s.published && <span className="shrink-0 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-600">Draft</span>}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{s.category} · {s.content.length} chars</p>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button size="sm" variant="ghost" onClick={() => handleEdit(s)}><Pencil className="h-3.5 w-3.5" /></Button>
                <Button size="sm" variant="ghost" onClick={() => handleDelete(s.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// WordPress Import Tab
// ─────────────────────────────────────────────────────────────────────────────

function ImportTab() {
  const { toast } = useToast();
  const { isAdmin, loading: authLoading } = useAuth();
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number; articles: number; mcqs: number; stories: number; skipped: number; errors: string[] } | null>(null);
  const [jsonData, setJsonData] = useState<any[] | null>(null);
  const [fileName, setFileName] = useState("");

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        if (Array.isArray(parsed)) {
          setJsonData(parsed);
          toast({ title: `Loaded ${parsed.length} posts from ${file.name}` });
        } else {
          toast({ title: "Invalid JSON format", description: "Expected an array of posts", variant: "destructive" });
        }
      } catch {
        toast({ title: "Failed to parse JSON file", variant: "destructive" });
      }
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!jsonData?.length) return;
    setImporting(true);
    const batchSize = 20;
    const totals = { done: 0, total: jsonData.length, articles: 0, mcqs: 0, stories: 0, skipped: 0, errors: [] as string[] };
    setProgress({ ...totals });

    for (let i = 0; i < jsonData.length; i += batchSize) {
      const batch = jsonData.slice(i, i + batchSize);
      try {
        const { data, error } = await supabase.functions.invoke("import-wordpress", {
          body: { posts: batch, action: "import" },
        });
        if (error) throw new Error(error.message);
        if (data) {
          totals.articles += data.articles || 0;
          totals.mcqs += data.mcqs || 0;
          totals.stories += data.stories || 0;
          totals.skipped += data.skipped || 0;
          if (data.errors?.length) totals.errors.push(...data.errors);
        }
      } catch (err: any) {
        totals.errors.push(`Batch ${Math.floor(i / batchSize) + 1}: ${err.message}`);
      }
      totals.done = Math.min(i + batchSize, jsonData.length);
      setProgress({ ...totals });
    }

    setImporting(false);
    toast({
      title: "Import complete!",
      description: `${totals.articles} articles, ${totals.mcqs} MCQ sets, ${totals.stories} stories imported. ${totals.skipped} skipped.`,
    });
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-2">
          <Upload className="h-5 w-5 text-primary" />
          <h3 className="font-serif text-lg font-bold text-foreground">Import WordPress Posts</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Upload a WordPress JSON export file. Posts will be auto-classified as articles, MCQs, or stories and assigned categories.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <label className="flex-1 cursor-pointer rounded-xl border-2 border-dashed border-border hover:border-primary/50 transition-colors p-6 text-center">
            <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">{fileName || "Click to select JSON file"}</p>
            {jsonData && <p className="text-xs text-primary mt-1">{jsonData.length} posts ready</p>}
            <input type="file" accept=".json" onChange={handleFileSelect} className="hidden" />
          </label>
        </div>

        {jsonData && (
          <Button onClick={handleImport} disabled={importing} className="gap-2">
            {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {importing ? `Importing... (${progress?.done || 0}/${progress?.total || 0})` : `Import ${jsonData.length} Posts`}
          </Button>
        )}

        {progress && (
          <div className="mt-4 space-y-3">
            <div className="w-full bg-secondary rounded-full h-2.5">
              <div className="bg-primary h-2.5 rounded-full transition-all" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-lg border border-border bg-background p-3 text-center">
                <p className="text-2xl font-bold text-foreground">{progress.articles}</p>
                <p className="text-xs text-muted-foreground">Articles</p>
              </div>
              <div className="rounded-lg border border-border bg-background p-3 text-center">
                <p className="text-2xl font-bold text-foreground">{progress.mcqs}</p>
                <p className="text-xs text-muted-foreground">MCQ Sets</p>
              </div>
              <div className="rounded-lg border border-border bg-background p-3 text-center">
                <p className="text-2xl font-bold text-foreground">{progress.stories}</p>
                <p className="text-xs text-muted-foreground">Stories</p>
              </div>
              <div className="rounded-lg border border-border bg-background p-3 text-center">
                <p className="text-2xl font-bold text-foreground">{progress.skipped}</p>
                <p className="text-xs text-muted-foreground">Skipped</p>
              </div>
            </div>
            {progress.errors.length > 0 && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                <p className="text-xs font-bold text-destructive mb-1">Errors ({progress.errors.length})</p>
                <div className="max-h-32 overflow-y-auto text-xs text-muted-foreground space-y-0.5">
                  {progress.errors.slice(0, 20).map((err, i) => <p key={i}>{err}</p>)}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ===== META MANAGER TAB =====
function MetaManagerTab() {
  const { toast } = useToast();
  const { isAdmin, loading: authLoading } = useAuth();
  const [contentType, setContentType] = useState<"articles" | "mcq_sets" | "flashcard_sets" | "essays">("articles");
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null);
  const [filterYear, setFilterYear] = useState("all");

  const loadItems = async () => {
    setLoading(true);
    const { data } = await supabase.from(contentType).select("id, title, category, meta_title, meta_description, slug, og_image_url, published, created_at").is("deleted_at", null).eq("published", true).order("created_at", { ascending: false }).limit(500);
    setItems(data || []);
    setLoading(false);
  };

  useEffect(() => { loadItems(); }, [contentType]);

  const filtered = filterYear === "all" ? items : items.filter(i => (i.category || "").startsWith(filterYear));

  const needsMeta = (item: any) => !item.meta_title || !item.meta_description || !item.slug;

  const updateSingleMeta = async (item: any) => {
    setProcessing(item.id);
    try {
      const { data, error } = await supabase.functions.invoke("generate-content", {
        body: {
          notes: `Title: ${item.title}\nCategory: ${item.category || "General"}\nType: ${contentType}`,
          type: "generate-seo-meta",
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      const updates: any = {};
      if (data?.meta_title) updates.meta_title = data.meta_title;
      if (data?.meta_description) updates.meta_description = data.meta_description;
      if (data?.slug) updates.slug = data.slug;
      
      await supabase.from(contentType).update(updates).eq("id", item.id);
      toast({ title: "Meta updated!" });
      await loadItems();
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    } finally {
      setProcessing(null);
    }
  };

  const handleBatchUpdate = async () => {
    const toUpdate = filtered.filter(needsMeta);
    if (!toUpdate.length) { toast({ title: "All items already have meta data" }); return; }
    setBatchRunning(true);
    let errors = 0;
    for (let i = 0; i < toUpdate.length; i++) {
      setBatchProgress({ current: i + 1, total: toUpdate.length });
      try {
        const item = toUpdate[i];
        const { data, error } = await supabase.functions.invoke("generate-content", {
          body: { notes: `Title: ${item.title}\nCategory: ${item.category || "General"}\nType: ${contentType}`, type: "generate-seo-meta" },
        });
        if (error || data?.error) { errors++; continue; }
        const updates: any = {};
        if (data?.meta_title) updates.meta_title = data.meta_title;
        if (data?.meta_description) updates.meta_description = data.meta_description;
        if (data?.slug) updates.slug = data.slug;
        await supabase.from(contentType).update(updates).eq("id", item.id);
      } catch { errors++; }
    }
    setBatchRunning(false);
    setBatchProgress(null);
    toast({ title: errors === 0 ? `Updated ${toUpdate.length} items!` : `Done — ${errors} failed` });
    await loadItems();
  };

  const missingCount = filtered.filter(needsMeta).length;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="font-serif text-lg font-bold text-foreground mb-3">Meta Title & Description Manager</h3>
        <p className="text-sm text-muted-foreground mb-4">Bulk update meta titles, descriptions, and slugs for all your content using AI.</p>
        
        <div className="flex flex-wrap gap-2 mb-4">
          {(["articles", "mcq_sets", "flashcard_sets", "essays"] as const).map(t => (
            <button key={t} onClick={() => setContentType(t)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${contentType === t ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}>
              {t === "articles" ? "Articles" : t === "mcq_sets" ? "MCQs" : t === "flashcard_sets" ? "Flashcards" : "Essays"}
            </button>
          ))}
        </div>
        
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <select value={filterYear} onChange={(e) => setFilterYear(e.target.value)} className="rounded-md border border-input bg-background px-2 py-1 text-xs">
            <option value="all">All Years</option>
            {[1,2,3,4,5,6].map(y => <option key={y} value={`Year ${y}`}>Year {y}</option>)}
          </select>
          <span className="text-xs text-muted-foreground">{filtered.length} items · {missingCount} missing meta</span>
          {missingCount > 0 && (
            <Button size="sm" onClick={handleBatchUpdate} disabled={batchRunning} className="gap-1 text-xs ml-auto">
              {batchRunning ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
              {batchRunning ? `Updating ${batchProgress?.current}/${batchProgress?.total}...` : `AI Update ${missingCount} Missing`}
            </Button>
          )}
        </div>

        {batchRunning && batchProgress && (
          <div className="mb-4">
            <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }} />
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="space-y-2">
          {filtered.map(item => (
            <div key={item.id} className="rounded-lg border border-border bg-card p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
                  <p className="text-[10px] text-muted-foreground">{item.category}</p>
                  <div className="mt-1 space-y-0.5">
                    <p className="text-[10px] text-primary truncate">{item.meta_title || "❌ No meta title"}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{item.meta_description || "❌ No meta description"}</p>
                    <p className="text-[10px] text-muted-foreground truncate">slug: {item.slug || "❌ No slug"}</p>
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={() => updateSingleMeta(item)} disabled={processing === item.id} className="shrink-0 gap-1 text-[10px] h-7">
                  {processing === item.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                  AI Meta
                </Button>
              </div>
            </div>
          ))}
          {filtered.length === 0 && <p className="text-center text-muted-foreground py-8">No published items found.</p>}
        </div>
      )}
    </div>
  );
}
