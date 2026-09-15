import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, CheckCircle, Clock, Loader2, Phone, Shield, Sparkles, Trophy, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { getSetting, getCategoryDisplayName, getYearFromCategory, buildExamPath, normalizeMcqQuestions } from "@/lib/store";
import { updateMetaTags } from "@/lib/seo";
import { dedupeResourceSummaries, isPublicMcqSet } from "@/lib/content-policy";

interface ExamSet {
  id: string;
  title: string;
  category: string;
  questions: { question: string; options: string[]; correct_answer: number; explanation?: string }[];
  created_at: string;
}

const UNLOCKED_KEY = "unlocked_exams";

function inferUnit(exam: ExamSet): string {
  const fromCategory = exam.category?.replace(/^Weekly Exam\s*:?\s*/i, "").trim();
  if (fromCategory && fromCategory !== "Weekly Exam") return getCategoryDisplayName(fromCategory);

  const titleMatch = exam.title.match(/Weekly\s+(.+?)\s+Exam/i);
  if (titleMatch?.[1]) return titleMatch[1].trim();

  return "General";
}

export default function Exams() {
  const location = useLocation();
  const mcqMode = location.pathname.startsWith("/mcqs");
  useEffect(() => {
    updateMetaTags({
      title: mcqMode ? "Medical MCQ Practice" : "Timed Exams",
      description: mcqMode
        ? "Practice medical MCQs organized by academic year and unit."
        : "Timed, proctored medical exams for Kenyan health students, organized by academic year and unit.",
    });
  }, [mcqMode]);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const selectedYear = searchParams.get("year") || "All";
  const [examSets, setExamSets] = useState<ExamSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [examPrice, setExamPrice] = useState(5);
  const [phoneByExamId, setPhoneByExamId] = useState<Record<string, string>>({});
  const [paying, setPaying] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<"idle" | "pending" | "completed" | "failed">("idle");
  const [payingForExamId, setPayingForExamId] = useState<string | null>(null);
  const [unlockedExams, setUnlockedExams] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadExams();
    getSetting("exam_price").then((price) => {
      if (price && !isNaN(Number(price))) setExamPrice(Number(price));
    });

    const saved = localStorage.getItem(UNLOCKED_KEY);
    if (saved) {
      try {
        setUnlockedExams(new Set(JSON.parse(saved)));
      } catch {
        setUnlockedExams(new Set());
      }
    }
  }, [mcqMode]);

  const loadExams = async () => {
    const { data } = await supabase
      .from("mcq_sets")
      .select("*")
      .eq("published", true)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false });

    const usable = ((data || []) as unknown as ExamSet[])
      .filter(isPublicMcqSet)
      .filter((exam: any) => {
        const text = `${exam.title || ""} ${exam.category || ""} ${exam.exam_type || ""}`;
        const isAssessment = /\b(?:exam|examination|eoy|end[ -]of[ -]year|cat|continuous assessment|past paper|supplementary|main paper|weekly exam)\b/i.test(text);
        return mcqMode ? !isAssessment : isAssessment;
      })
      .map((exam) => ({ ...exam, questions: normalizeMcqQuestions(exam.questions || []) }))
      .filter((exam) => exam.questions.length > 0);
    setExamSets(dedupeResourceSummaries(usable));
    setLoading(false);
  };

  const persistUnlocked = (next: Set<string>) => {
    setUnlockedExams(next);
    localStorage.setItem(UNLOCKED_KEY, JSON.stringify([...next]));
  };

  const pollPayment = (txnId: string, examId: string) => {
    let attempts = 0;
    const pollId = setInterval(async () => {
      attempts += 1;
      if (attempts > 60) {
        clearInterval(pollId);
        setPaymentStatus("failed");
        setPaying(false);
        return;
      }

      try {
        const { data: result, error } = await supabase.functions.invoke("check-payment", {
          body: { transaction_id: txnId },
        });
        if (error) return;

        if (result.status === "completed") {
          clearInterval(pollId);
          setPaymentStatus("completed");
          setPaying(false);
          const next = new Set(unlockedExams);
          next.add(examId);
          persistUnlocked(next);
        } else if (result.status === "failed") {
          clearInterval(pollId);
          setPaymentStatus("failed");
          setPaying(false);
        }
      } catch {
        // keep polling
      }
    }, 2000);
  };

  const handlePay = async (exam: ExamSet) => {
    const phone = (phoneByExamId[exam.id] || "").trim();
    if (!phone) return;

    setPaying(true);
    setPaymentStatus("pending");
    setPayingForExamId(exam.id);

    try {
      const { data, error } = await supabase.functions.invoke("initiate-payment", {
        body: {
          phone,
          amount: examPrice,
          package_type: `exam:${inferUnit(exam)}`,
        },
      });

      if (error || !data?.success) {
        throw new Error(data?.error || error?.message || "Payment failed");
      }

      pollPayment(data.transaction_id, exam.id);
    } catch {
      setPaymentStatus("failed");
      setPaying(false);
    }
  };

  const sampleExam: ExamSet = {
    id: "sample-exam",
    title: mcqMode ? "Sample Pathology MCQs" : "Sample Pathology Exam",
    category: "Pathology",
    created_at: new Date().toISOString(),
    questions: [
      {
        question: "Which process is the hallmark of acute inflammation in early tissue injury?",
        options: ["Fibrosis", "Neutrophil recruitment", "Granuloma formation", "Metaplasia"],
        correct_answer: 1,
        explanation: "Acute inflammation is dominated by vascular changes and neutrophil migration.",
      },
      {
        question: "A classic Reed-Sternberg cell is most associated with which disease?",
        options: ["Burkitt lymphoma", "Hodgkin lymphoma", "Multiple myeloma", "AML"],
        correct_answer: 1,
        explanation: "Reed-Sternberg cells are pathognomonic for Hodgkin lymphoma.",
      },
    ],
  };

  const filteredExamSets = useMemo(() => {
    if (selectedYear === "All") return examSets;
    return examSets.filter((exam) => getYearFromCategory(exam.category) === selectedYear);
  }, [examSets, selectedYear]);

  const allExams = useMemo(() => [sampleExam, ...filteredExamSets], [filteredExamSets, mcqMode]);

  return (
    <div className="min-h-screen bg-background">

      {/* ── Hero — only text changed, no logic ── */}
      <section className="relative overflow-hidden border-b border-border bg-gradient-to-br from-primary/10 via-background to-accent/10 px-4 py-12 sm:py-16">
        <div className="mx-auto max-w-5xl">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-semibold text-primary">
              <Trophy className="h-3.5 w-3.5" /> {mcqMode ? "Unit-Based MCQ Practice" : "Unit-Based Exams"}
            </div>
            <h1 className="mb-3 font-serif text-3xl font-bold text-foreground sm:text-4xl">{mcqMode ? "MCQ Practice" : "Exam Centre"}</h1>
            <p className="mx-auto max-w-2xl text-sm leading-relaxed text-muted-foreground">
              {mcqMode ? "Question banks for self-directed practice, separated from CATs and examination papers." : "Timed CATs and examination papers, separated from ordinary practice banks."} {selectedYear === "All" ? "Select a year to narrow the list." : `Currently viewing ${selectedYear}.`}
            </p>
          </motion.div>

          {/* Support card — new addition, no logic impact */}
          {!mcqMode && <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 }}
            className="mx-auto mt-7 max-w-lg rounded-2xl border border-rose-200 dark:border-rose-900/40 bg-rose-50 dark:bg-rose-950/20 p-4 sm:p-5"
          >
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-rose-100 dark:bg-rose-900/40 p-2 shrink-0 mt-0.5">
                <Heart className="h-4 w-4 text-rose-500" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground mb-1">Support Ompath Study</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Each exam is just <strong className="text-foreground">KES {examPrice}</strong>. This goes directly toward building weekly exams, expanding the question bank, and keeping Ompath Study free for all health students in Kenya.
                </p>
              </div>
            </div>
          </motion.div>}
        </div>
      </section>

      {/* ── Exam list — 100% original logic, only subtitle text changed ── */}
      <section className="mx-auto max-w-5xl space-y-4 px-4 py-8">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : allExams.length === 0 ? (
          <p className="py-16 text-center text-muted-foreground">No {mcqMode ? "MCQ sets" : "exams"} available yet.</p>
        ) : (
          allExams.map((exam, index) => {
            const isSample = exam.id === "sample-exam";
            const unlocked = true;
            const unitName = inferUnit(exam);
            const isCurrentPayment = payingForExamId === exam.id;

            return (
              <motion.div
                key={exam.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
                className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6"
              >
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="mb-1 text-xs font-medium text-primary">Unit: {unitName}</p>
                    <h2 className="font-serif text-lg font-bold text-foreground">{exam.title}</h2>
                    {/* CHANGED: removed "Section B SAQs · Section C LAQ" — MCQs only */}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {exam.questions.length} MCQs · {exam.questions.length} minutes · Section A
                    </p>
                  </div>
                  <span className="rounded-full border border-border bg-secondary px-3 py-1 text-[10px] font-semibold text-foreground">
                    FREE
                  </span>
                </div>

                <Button onClick={() => navigate(isSample ? `/exams/${exam.id}/start` : buildExamPath(exam))} className="w-full gap-2">
                  <Shield className="h-4 w-4" /> {mcqMode ? "Start Practice" : "Start Exam"} <ArrowRight className="h-4 w-4" />
                </Button>
                {!isSample && !unlocked && (
                  <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    First 15 questions are free. Pay KES {examPrice} inside the exam to unlock the rest.
                  </div>
                )}
              </motion.div>
            );
          })
        )}

        {/* Bottom support note */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="rounded-2xl border border-border bg-card p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4 mt-2"
        >
          <div className="rounded-full bg-rose-500/10 p-3 shrink-0">
            <Heart className="h-5 w-5 text-rose-500" />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground mb-1">Every exam supports this platform</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Ompath Study is built by and for health students in Kenya. The small fee helps cover question generation, platform hosting, and new study tools — so we can keep growing and keep everything else free.
            </p>
          </div>
        </motion.div>
      </section>

    </div>
  );
}
