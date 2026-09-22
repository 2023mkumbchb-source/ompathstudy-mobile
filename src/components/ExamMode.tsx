import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, X, Lightbulb, Clock, AlertTriangle, Shield, LogOut, Lock, CheckCircle, Phone, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trackAnswer } from "@/lib/answer-tracker";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface McqQuestion {
  question: string;
  options: string[];
  correct_answer: number;
  explanation?: string;
}

interface StudentInfo {
  name: string;
  university: string;
  course: string;
}

interface Props {
  questions: McqQuestion[];
  title: string;
  setId?: string;
  timeLimitMinutes?: number;
  studentInfo?: StudentInfo;
  unitName?: string;
  onExit: () => void;
  freeLimit?: number;
  examPrice?: number;
  isPaid?: boolean;
  paymentStatus?: "idle" | "pending" | "completed" | "failed";
  phoneInput?: string;
  onPhoneChange?: (v: string) => void;
  onPay?: () => void;
  onRetryPay?: () => void;
}

// ── Persistence ──────────────────────────────────────────────────────────────

interface PersistedExam {
  setId: string;
  answers: [number, number][];
  submittedAt: number;
  elapsed: number;
  score: number;
  total: number;
  studentName: string;
  title: string;
  submitReason: string;
}

interface PersistedExamSession {
  sessionId: string;
  answers: [number, number][];
  elapsed: number;
}

const storageKey = (id: string) => `exam_result_${id}`;
const sessionStorageKey = (id: string) => `exam_session_${id}`;
const STUDENT_CREDS_KEY = "student_credentials";

function saveToStorage(data: PersistedExam) {
  try { localStorage.setItem(storageKey(data.setId), JSON.stringify(data)); } catch {}
}

function loadFromStorage(id: string): PersistedExam | null {
  try {
    const raw = localStorage.getItem(storageKey(id));
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveSessionToStorage(data: PersistedExamSession) {
  try { localStorage.setItem(sessionStorageKey(data.sessionId), JSON.stringify(data)); } catch {}
}

function loadSessionFromStorage(id: string): PersistedExamSession | null {
  try {
    const raw = localStorage.getItem(sessionStorageKey(id));
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function clearSessionFromStorage(id: string) {
  try { localStorage.removeItem(sessionStorageKey(id)); } catch {}
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

type SubmitReason = "manual" | "timeout" | "tab_switch";

// ─────────────────────────────────────────────────────────────────────────────

export default function ExamMode({
  questions, title, setId,
  timeLimitMinutes, studentInfo, unitName,
  onExit,
  freeLimit = 0,
  examPrice = 5,
  isPaid = true,
  paymentStatus = "idle",
  phoneInput = "",
  onPhoneChange,
  onPay,
  onRetryPay,
}: Props) {
  const { isAdmin } = useAuth();
  const [answers, setAnswers] = useState<Map<number, number>>(new Map());
  const [submitted, setSubmitted] = useState(false);
  const [submitReason, setSubmitReason] = useState<SubmitReason>("manual");
  const [startTime, setStartTime] = useState(() => Date.now());
  const [elapsed, setElapsed] = useState(0);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [displayAnswers, setDisplayAnswers] = useState<Map<number, number>>(new Map());
  const submittedRef = useRef(false);
  const sessionId = setId || `local_${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

  const timeLimit = timeLimitMinutes ? timeLimitMinutes * 60 : undefined;
  const remaining = timeLimit ? Math.max(0, timeLimit - elapsed) : undefined;

  // Paywall — exam free up to freeLimit MCQs, then paused until isPaid
  const isPaywalled = freeLimit > 0 && !isPaid && answers.size >= freeLimit;
  const [pausedMs, setPausedMs] = useState(0);
  const pauseStartRef = useRef<number | null>(null);

  useEffect(() => {
    if (isPaywalled && pauseStartRef.current === null) {
      pauseStartRef.current = Date.now();
    } else if (!isPaywalled && pauseStartRef.current !== null) {
      setPausedMs((p) => p + (Date.now() - (pauseStartRef.current as number)));
      pauseStartRef.current = null;
    }
  }, [isPaywalled]);

  // ── On mount: restore submitted result or in-progress session ──
  useEffect(() => {
    if (setId) {
      const savedResult = loadFromStorage(setId);
      if (savedResult) {
        submittedRef.current = true;
        setSubmitted(true);
        setSubmitReason(savedResult.submitReason as SubmitReason);
        setElapsed(savedResult.elapsed);
        setDisplayAnswers(new Map(savedResult.answers));
        return;
      }
    }

    const savedSession = loadSessionFromStorage(sessionId);
    if (savedSession) {
      const restoredAnswers = new Map(savedSession.answers);
      setAnswers(restoredAnswers);
      setElapsed(savedSession.elapsed);
      setStartTime(Date.now() - savedSession.elapsed * 1000);
    }
  }, [setId, sessionId]);

  // ── Timer ──
  useEffect(() => {
    if (submitted) return;
    const id = setInterval(() => {
      const pauseAdj = pausedMs + (pauseStartRef.current ? Date.now() - pauseStartRef.current : 0);
      setElapsed(Math.max(0, Math.floor((Date.now() - startTime - pauseAdj) / 1000)));
    }, 1000);
    return () => clearInterval(id);
  }, [startTime, submitted, pausedMs, isPaywalled]);

  // ── Persist in-progress session ──
  useEffect(() => {
    if (submitted) return;
    saveSessionToStorage({
      sessionId,
      answers: [...answers.entries()],
      elapsed,
    });
  }, [answers, elapsed, submitted, sessionId]);

  // ── Fullscreen ──
  useEffect(() => {
    const el = document.documentElement;
    if (el.requestFullscreen && !document.fullscreenElement) el.requestFullscreen().catch(() => {});
    return () => { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); };
  }, []);

  // ── Block copy/paste/right-click (students only — admin can copy freely) ──
  useEffect(() => {
    if (isAdmin) return;
    const block = (e: Event) => e.preventDefault();
    ["copy", "cut", "paste", "contextmenu"].forEach((ev) => document.addEventListener(ev, block));
    return () => ["copy", "cut", "paste", "contextmenu"].forEach((ev) => document.removeEventListener(ev, block));
  }, [isAdmin]);

  // ── No-select style ──
  useEffect(() => {
    if (isAdmin) return;
    const s = document.createElement("style");
    s.id = "exam-no-select";
    s.textContent = `.exam-container * { user-select: none; -webkit-user-select: none; }`;
    document.head.appendChild(s);
    return () => s.remove();
  }, [isAdmin]);

  // ── Submit ──
  const doSubmit = useCallback(async (reason: SubmitReason) => {
    if (submittedRef.current) return;
    submittedRef.current = true;

    const now = Date.now();
    const currentElapsed = Math.floor((now - startTime) / 1000);
    const correctCount = [...answers.entries()].filter(([qi, oi]) => questions[qi].correct_answer === oi).length;

    if (setId) {
      saveToStorage({
        setId,
        answers: [...answers.entries()],
        submittedAt: now,
        elapsed: currentElapsed,
        score: correctCount,
        total: questions.length,
        studentName: studentInfo?.name || "",
        title,
        submitReason: reason,
      });
    }

    clearSessionFromStorage(sessionId);

    if (studentInfo) {
      try {
        localStorage.setItem(STUDENT_CREDS_KEY, JSON.stringify(studentInfo));
      } catch {}
    }

    setSubmitted(true);
    setSubmitReason(reason);
    setElapsed(currentElapsed);
    setDisplayAnswers(new Map(answers));

    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});

    if (setId) {
      for (const [qIdx, selectedOpt] of answers.entries()) {
        const q = questions[qIdx];
        trackAnswer({
          mcq_set_id: setId,
          question_index: qIdx,
          question_text: q.question,
          selected_answer: selectedOpt,
          correct_answer: q.correct_answer,
          is_correct: selectedOpt === q.correct_answer,
        });
      }
    }

    if (studentInfo && setId) {
      try {
        await supabase.from("exam_results").insert({
          exam_id: setId,
          exam_title: title,
          unit: unitName || "General",
          student_name: studentInfo.name,
          university: studentInfo.university,
          course: studentInfo.course,
          mcq_score: correctCount,
          mcq_total: questions.length,
          time_taken_seconds: currentElapsed,
          submit_reason: reason,
        });
      } catch (e) {
        console.error("DB save failed:", e);
      }
    }
  }, [answers, questions, setId, studentInfo, title, unitName, startTime, sessionId]);

  useEffect(() => {
    if (submittedRef.current || !timeLimit) return;
    if (elapsed >= timeLimit) doSubmit("timeout");
  }, [elapsed, timeLimit, doSubmit]);

  useEffect(() => {
    if (submittedRef.current) return;
    const onVis = () => { if (document.hidden) doSubmit("tab_switch"); };
    document.addEventListener("visibilitychange", onVis);
    return () => { document.removeEventListener("visibilitychange", onVis); };
  }, [doSubmit]);

  const selectAnswer = (qIdx: number, optIdx: number) => {
    if (submitted) return;
    setAnswers((prev) => new Map(prev).set(qIdx, optIdx));
  };

  const answered = answers.size;
  const total = questions.length;
  const unanswered = total - answered;

  const correctCount = [...displayAnswers.entries()].filter(
    ([qi, oi]) => questions[qi]?.correct_answer === oi
  ).length;
  const pct = total > 0 ? Math.round((correctCount / total) * 100) : 0;

  const handleExitWithSave = () => {
    saveSessionToStorage({
      sessionId,
      answers: [...answers.entries()],
      elapsed,
    });
    setShowExitConfirm(false);
    onExit();
  };

  const timeColor =
    remaining !== undefined
      ? remaining <= 60 ? "text-red-500 bg-red-500/10"
        : remaining <= 300 ? "text-amber-500 bg-amber-500/10"
        : "text-primary bg-primary/10"
      : "text-primary bg-primary/10";

  // ── DIALOGS ──
  const ExitDialog = () => (
    <AnimatePresence>
      {showExitConfirm && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
        >
          <motion.div
            initial={{ scale: 0.92 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.92 }}
            className="w-full max-w-sm border-y border-border bg-card p-6 shadow-xl"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="rounded-full bg-destructive/10 p-2">
                <LogOut className="h-5 w-5 text-destructive" />
              </div>
              <h3 className="font-serif text-base font-bold text-foreground">Exit Exam?</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-1">
              Your progress is <strong className="text-foreground">saved automatically</strong>.
            </p>
            <p className="text-xs text-muted-foreground mb-5">
              You can come back and continue this exam from where you stopped.
            </p>
            <div className="flex gap-3">
              <Button variant="destructive" onClick={handleExitWithSave} className="flex-1">
                Save & Exit
              </Button>
              <Button variant="outline" onClick={() => setShowExitConfirm(false)} className="flex-1">
                Keep Going
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  const SubmitDialog = () => (
    <AnimatePresence>
      {showSubmitConfirm && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
        >
          <motion.div
            initial={{ scale: 0.92 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.92 }}
            className="w-full max-w-sm border-y border-border bg-card p-6 shadow-xl"
          >
            <h3 className="font-serif text-base font-bold text-foreground mb-2">Submit Exam?</h3>
            {unanswered > 0 && (
              <div className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-400 flex items-center gap-2">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                {unanswered} question{unanswered > 1 ? "s" : ""} unanswered — marked wrong.
              </div>
            )}
            <p className="text-sm text-muted-foreground mb-1">
              Answered <strong className="text-foreground">{answered}/{total}</strong> questions.
            </p>
            <p className="text-xs text-muted-foreground mb-5">
              Your score and full answer review will be shown immediately after submission.
            </p>
            <div className="flex gap-3">
              <Button
                onClick={() => {
                  setShowSubmitConfirm(false);
                  doSubmit("manual");
                }}
                className="flex-1"
              >
                Submit Now
              </Button>
              <Button variant="outline" onClick={() => setShowSubmitConfirm(false)} className="flex-1">
                Review First
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  // ── RESULTS ───────────────────────────────────────────────────────────────
  if (submitted) {
    const grade =
      pct >= 80
        ? { label: "Excellent!", color: "text-green-500", bg: "border-green-500/20 bg-green-500/5", icon: "🏆" }
        : pct >= 60
          ? { label: "Good job!", color: "text-blue-500", bg: "border-blue-500/20 bg-blue-500/5", icon: "✅" }
          : { label: "Keep studying", color: "text-amber-500", bg: "border-amber-500/20 bg-amber-500/5", icon: "📚" };

    const reasonNote: Record<SubmitReason, string | null> = {
      manual: null,
      timeout: "Time ran out — exam was auto-submitted.",
      tab_switch: "Exam auto-submitted: you switched tabs or left the page.",
    };

    return (
      <div className="min-h-screen bg-background px-3 sm:px-6 py-6 pb-20">
        <div className="mx-auto max-w-2xl space-y-4">
          {reasonNote[submitReason] && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 flex items-center gap-2 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{reasonNote[submitReason]}</span>
            </div>
          )}

          {studentInfo && (
            <div className="border-y border-border bg-card p-4 text-sm">
              <p className="text-foreground font-medium">{studentInfo.name}</p>
              <p className="text-muted-foreground text-xs">
                {studentInfo.university} · {studentInfo.course}
              </p>
            </div>
          )}

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className={`border-y ${grade.bg} p-5 text-center`}
          >
            <div className="text-4xl mb-2">{grade.icon}</div>
            <h2 className="font-serif text-xl sm:text-2xl font-bold text-foreground mb-1">
              {grade.label}
            </h2>
            <p className="text-xs text-muted-foreground mb-3 truncate">{title}</p>

            <div className="flex items-center justify-center gap-4 sm:gap-6">
              <div>
                <p className={`text-3xl sm:text-4xl font-bold ${grade.color}`}>{pct}%</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Score</p>
              </div>

              <div className="w-px h-8 bg-border" />

              <div>
                <p className="text-3xl sm:text-4xl font-bold text-foreground">
                  {correctCount}/{total}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Correct</p>
              </div>

              <div className="w-px h-8 bg-border" />

              <div>
                <p className="text-3xl sm:text-4xl font-bold text-foreground">
                  {formatTime(elapsed)}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Time</p>
              </div>
            </div>
          </motion.div>

          <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-3 flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
            <CheckCircle className="h-4 w-4 shrink-0" />
            Results and answers are available immediately.
          </div>

          <div className="space-y-3">
            {questions.map((q, qi) => {
              const selected = displayAnswers.get(qi);
              const isCorrect = selected === q.correct_answer;
              const wasAnswered = selected !== undefined;

              return (
                <div
                  key={qi}
                  className={`border-y p-3 ${
                    !wasAnswered
                      ? "border-muted bg-muted/30"
                      : isCorrect
                        ? "border-green-500/30 bg-green-500/5"
                        : "border-destructive/30 bg-destructive/5"
                  }`}
                >
                  <div className="flex items-start gap-2 mb-2">
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                        !wasAnswered
                          ? "bg-muted-foreground/20 text-muted-foreground"
                          : isCorrect
                            ? "bg-green-500/20 text-green-600"
                            : "bg-destructive/20 text-destructive"
                      }`}
                    >
                      {qi + 1}
                    </span>

                    <p className="text-xs sm:text-sm font-medium text-foreground leading-relaxed break-words">
                      {q.question}
                    </p>
                  </div>

                  {!wasAnswered && (
                    <div className="ml-8 mb-2 text-[10px] sm:text-xs text-muted-foreground">
                      Not answered
                    </div>
                  )}

                  <div className="space-y-1 ml-8">
                    {q.options.map((opt, oi) => {
                      const isSelected = selected === oi;
                      const isCorrectOpt = oi === q.correct_answer;

                      let style = "border-border bg-card";
                      if (isCorrectOpt) {
                        style = "border-green-500 bg-green-500/10 text-green-700 dark:text-green-400";
                      } else if (isSelected && !isCorrectOpt) {
                        style = "border-destructive/50 bg-destructive/10 text-destructive";
                      }

                      return (
                        <div
                          key={oi}
                          className={`flex items-start gap-1.5 border p-2 text-xs sm:text-sm ${style}`}
                        >
                          <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[9px] font-bold mt-0.5">
                            {String.fromCharCode(65 + oi)}
                          </span>

                          <span className="flex-1 break-words">{opt}</span>

                          {isCorrectOpt && (
                            <Check className="h-3.5 w-3.5 text-green-500 shrink-0" />
                          )}

                          {isSelected && !isCorrectOpt && (
                            <X className="h-3.5 w-3.5 text-destructive shrink-0" />
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {q.explanation && (
                    <div className="mt-2 ml-8 rounded-lg border border-primary/20 bg-primary/5 p-2 flex gap-1.5">
                      <Lightbulb className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                      <p className="text-[10px] sm:text-xs text-foreground leading-relaxed break-words">
                        {q.explanation}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <Button onClick={onExit} className="w-full">
            Back to Exams
          </Button>
        </div>
      </div>
    );
  }

  // ── EXAM IN PROGRESS ──────────────────────────────────────────────────────
  return (
    <div className="exam-container fixed inset-0 z-50 bg-background overflow-y-auto">
      {ExitDialog()}
      {SubmitDialog()}

      <div className="sticky top-0 z-10 border-b border-border bg-card/95 backdrop-blur px-3 sm:px-6 py-2.5">
        <div className="mx-auto max-w-2xl flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h2 className="font-serif text-sm sm:text-base font-bold text-foreground truncate">
              {title}
            </h2>
            <p className="text-[10px] sm:text-xs text-muted-foreground">
              {answered}/{total} answered{studentInfo && <> · {studentInfo.name}</>}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs sm:text-sm font-mono font-bold ${timeColor}`}>
              <Clock className="h-3 w-3" />
              {remaining !== undefined ? formatTime(remaining) : formatTime(elapsed)}
            </div>

            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Shield className="h-3 w-3" />
              <span className="hidden sm:inline">Proctored</span>
            </div>

            <button
              onClick={() => setShowExitConfirm(true)}
              className="flex items-center gap-1 rounded-full px-2 py-1 text-[10px] text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            >
              <LogOut className="h-3 w-3" />
              <span className="hidden sm:inline">Exit</span>
            </button>
          </div>
        </div>

        <div className="mx-auto max-w-2xl mt-1.5">
          <div className="h-1 w-full rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${(answered / total) * 100}%` }}
            />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-3 sm:px-6 py-4 pb-28 space-y-3">
        {questions.map((q, qi) => {
          const selected = answers.get(qi);
          const lockedByPaywall = freeLimit > 0 && !isPaid && qi >= freeLimit;

          return (
            <div key={qi}>
              {isPaywalled && qi === freeLimit && (
                <div className="mb-3 rounded-xl border border-primary/30 bg-card p-5 text-center shadow-sm">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Lock className="h-5 w-5" />
                  </div>

                  <h3 className="mb-1 font-serif text-lg font-bold text-foreground">
                    Unlock the full exam
                  </h3>

                  <p className="mb-1 text-sm text-muted-foreground">
                    Question {freeLimit + 1} onward is locked. Pay{" "}
                    <strong className="text-foreground">KES {examPrice}</strong> to continue.
                  </p>

                  <p className="mb-4 text-[11px] text-amber-600 dark:text-amber-400">
                    Timer is paused while you pay.
                  </p>

                  {paymentStatus === "pending" ? (
                    <div className="rounded-lg border border-primary/30 bg-primary/10 p-3">
                      <Loader2 className="mx-auto h-5 w-5 animate-spin text-primary" />
                      <p className="mt-2 text-sm font-medium text-foreground">Check your phone</p>
                      <p className="text-xs text-muted-foreground">Enter your M-Pesa PIN to complete.</p>
                    </div>
                  ) : paymentStatus === "failed" ? (
                    <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3">
                      <p className="text-sm font-medium text-foreground">Payment failed</p>
                      <Button size="sm" variant="outline" className="mt-2" onClick={onRetryPay}>
                        Try again
                      </Button>
                    </div>
                  ) : paymentStatus === "completed" ? (
                    <div className="rounded-lg border border-primary/30 bg-primary/10 p-3">
                      <CheckCircle className="mx-auto h-5 w-5 text-primary" />
                      <p className="mt-2 text-sm font-medium text-foreground">
                        Unlocked. Continue your exam.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <Input
                        type="tel"
                        placeholder="Safaricom number e.g. 0712 345 678"
                        value={phoneInput}
                        onChange={(e) => onPhoneChange?.(e.target.value)}
                        className="h-11 text-center"
                      />

                      <Button
                        onClick={onPay}
                        disabled={!phoneInput.trim()}
                        className="w-full gap-2"
                      >
                        <Phone className="h-4 w-4" /> Pay KES {examPrice} via M-Pesa
                      </Button>
                    </div>
                  )}
                </div>
              )}

              <div
                className={`relative rounded-xl border p-3 transition-colors ${
                  selected !== undefined
                    ? "border-primary/30 bg-primary/5"
                    : "border-border bg-card"
                } ${lockedByPaywall ? "select-none" : ""}`}
                style={
                  lockedByPaywall
                    ? { filter: "blur(6px)", opacity: 0.55, pointerEvents: "none" }
                    : undefined
                }
                aria-hidden={lockedByPaywall || undefined}
              >
                <div className="flex items-start gap-2 mb-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                    {qi + 1}
                  </span>

                  <p className="text-xs sm:text-sm font-medium text-foreground leading-relaxed break-words">
                    {q.question}
                  </p>
                </div>

                <div className="space-y-1 ml-8">
                  {q.options.map((opt, oi) => (
                    <button
                      key={oi}
                      onClick={() => selectAnswer(qi, oi)}
                      disabled={lockedByPaywall}
                      className={`w-full flex items-start gap-1.5 rounded-lg border p-2 text-xs sm:text-sm text-left transition-colors ${
                        selected === oi
                          ? "border-primary bg-primary/10 text-primary font-medium"
                          : "border-border bg-card hover:border-primary/40 hover:bg-primary/5"
                      }`}
                    >
                      <span
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[9px] font-bold mt-0.5 ${
                          selected === oi
                            ? "border-primary bg-primary text-primary-foreground"
                            : ""
                        }`}
                      >
                        {String.fromCharCode(65 + oi)}
                      </span>

                      <span className="flex-1 break-words">{opt}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-10 border-t border-border bg-card/95 backdrop-blur px-3 sm:px-6 py-3">
        <div className="mx-auto max-w-2xl flex items-center justify-between gap-3">
          <p className="text-xs shrink-0">
            {unanswered > 0
              ? <span className="text-amber-500 font-medium">{unanswered} unanswered</span>
              : <span className="text-green-500 font-medium">All answered</span>}

            {remaining !== undefined && remaining <= 120 && (
              <span className="text-red-500 font-medium ml-2">
                · {formatTime(remaining)} left!
              </span>
            )}
          </p>

          <Button
            onClick={() => setShowSubmitConfirm(true)}
            disabled={answered === 0}
            className="flex-1 max-w-xs"
          >
            Submit ({answered}/{total})
          </Button>
        </div>
      </div>
    </div>
  );
}

export function loadSavedCredentials(): { name: string; university: string; course: string } | null {
  try {
    const raw = localStorage.getItem("student_credentials");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
