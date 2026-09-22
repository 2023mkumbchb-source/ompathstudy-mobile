import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { GraduationCap, AlertCircle, ArrowRight, Sparkles, Clock, Calendar } from "lucide-react";
import {
  AppNotification,
  getCachedNotifications,
  subscribeToNotifications,
} from "@/lib/notifications";

interface ExamCountdownWidgetProps {
  yearNumber?: number;
  className?: string;
}

export default function ExamCountdownWidget({
  yearNumber,
  className = "",
}: ExamCountdownWidgetProps) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  useEffect(() => {
    setNotifications(getCachedNotifications());
    const unsub = subscribeToNotifications(setNotifications);
    return unsub;
  }, []);

  // Find relevant active exam notification
  const activeExamAlert = useMemo(() => {
    return notifications.find((n) => {
      if (n.type !== "exam") return false;
      if (yearNumber && n.study_year && n.study_year !== yearNumber) return false;
      return true;
    });
  }, [notifications, yearNumber]);

  if (!activeExamAlert) {
    return (
      <div
        className={`relative overflow-hidden border-y border-amber-500/20 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent p-4 sm:p-5 ${className}`}
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                  {yearNumber ? `Year ${yearNumber} Exams` : "Exam Revision"}
                </span>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" /> CAT & EOY Revision
                </span>
              </div>
              <h3 className="mt-1 font-serif text-base sm:text-lg font-bold text-foreground">
                High-Yield Examination Revision Bank
              </h3>
              <p className="mt-0.5 text-xs sm:text-sm text-muted-foreground">
                Master past papers, clinical spotters, and answered MCQs for upcoming continuous assessment tests.
              </p>
            </div>
          </div>

          <Link
            to={yearNumber ? `/year/${yearNumber}` : "/revision-index"}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2 text-xs sm:text-sm font-semibold text-slate-950 transition-transform hover:scale-105 shadow-sm"
          >
            <span>Start Practice</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`relative overflow-hidden border-y-2 border-amber-500/40 bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-amber-500/5 p-4 sm:p-5 shadow-lg ${className}`}
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-slate-950 shadow-md animate-pulse">
            <GraduationCap className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-amber-500 text-slate-950 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider shadow-xs">
                Official Exam Alert
              </span>
              {activeExamAlert.study_year && (
                <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                  Year {activeExamAlert.study_year}
                </span>
              )}
            </div>
            <h3 className="mt-1 font-serif text-base sm:text-lg font-bold text-foreground">
              {activeExamAlert.title}
            </h3>
            <p className="mt-1 text-xs sm:text-sm text-muted-foreground max-w-2xl leading-relaxed whitespace-pre-line">
              {activeExamAlert.message}
            </p>
          </div>
        </div>

        {activeExamAlert.action_url && (
          <Link
            to={activeExamAlert.action_url}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2.5 text-xs sm:text-sm font-bold text-slate-950 transition-all hover:bg-amber-400 hover:bg-muted/40 hover:scale-105"
          >
            <span>Open Exam Bank</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        )}
      </div>
    </div>
  );
}
