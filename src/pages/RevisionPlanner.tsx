import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { CalendarDays, Check, Loader2, LockKeyhole, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { getAcademicYears, getUnitsForYear, type Unit } from "@/lib/academic";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

type PlanRow = Pick<Tables<"revision_plans">, "id" | "title" | "exam_date" | "daily_minutes" | "rest_days" | "unit_ids">;
type PlanItem = Pick<Tables<"revision_plan_items">, "id" | "scheduled_date" | "resource_title" | "activity" | "estimated_minutes" | "status">;

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** YYYY-MM-DD in the learner's local timezone. A plain toISOString().slice(0,10)
 *  shifts the calendar day for anyone east of UTC (e.g. Kenya, UTC+3), which
 *  would silently schedule the first day or two of a plan on the wrong date. */
export function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export interface ScheduleUnit {
  id: string;
  name: string;
}

export interface ScheduleRow {
  scheduled_date: string;
  unit_id: string;
  resource_title: string;
  activity: string;
  estimated_minutes: number;
  display_order: number;
}

/**
 * Pure schedule builder, kept free of Supabase so it can be unit tested.
 * Walks calendar days from `startDate` up to (but not past) `studyDays`
 * ahead -- i.e. never schedules a study session after the exam date -- and
 * skips any day-of-week listed in `restDays` (0=Sun..6=Sat).
 */
export function buildScheduleRows(
  units: ScheduleUnit[],
  studyDays: number,
  dailyMinutes: number,
  restDays: number[],
  startDate: Date = new Date(),
): ScheduleRow[] {
  if (!units.length || studyDays < 1) return [];
  const targetCount = Math.min(studyDays, Math.max(7, units.length * 3));
  const rows: ScheduleRow[] = [];
  let i = 0;
  for (let dayOffset = 0; dayOffset < studyDays && rows.length < targetCount; dayOffset++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + dayOffset);
    if (restDays.includes(d.getDay())) continue;
    const unit = units[i % units.length];
    rows.push({
      scheduled_date: localDateStr(d),
      unit_id: unit.id,
      resource_title: unit.name,
      activity: i % 3 === 2 ? "practice questions" : "review notes",
      estimated_minutes: Math.max(20, Math.floor(dailyMinutes / (i % 2 ? 2 : 1))),
      display_order: i,
    });
    i++;
  }
  return rows;
}

export default function RevisionPlanner() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [year, setYear] = useState(3);
  const [units, setUnits] = useState<Unit[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [date, setDate] = useState("");
  const [minutes, setMinutes] = useState(90);
  const [restDays, setRestDays] = useState<number[]>([0]);
  const [activePlan, setActivePlan] = useState<PlanRow | null>(null);
  const [items, setItems] = useState<PlanItem[]>([]);
  const [planLoading, setPlanLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [ending, setEnding] = useState(false);

  useEffect(() => {
    void getAcademicYears();
    getUnitsForYear(year).then(setUnits);
  }, [year]);

  const loadActivePlan = useCallback(async () => {
    if (!userId) {
      setActivePlan(null);
      setItems([]);
      setPlanLoading(false);
      return;
    }
    setPlanLoading(true);
    const { data: plan } = await supabase
      .from("revision_plans")
      .select("id, title, exam_date, daily_minutes, rest_days, unit_ids")
      .eq("user_id", userId)
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!plan) {
      setActivePlan(null);
      setItems([]);
      setPlanLoading(false);
      return;
    }
    setActivePlan(plan);
    const { data: planItems } = await supabase
      .from("revision_plan_items")
      .select("id, scheduled_date, resource_title, activity, estimated_minutes, status")
      .eq("plan_id", plan.id)
      .order("scheduled_date")
      .limit(200);
    setItems(planItems || []);
    setPlanLoading(false);
  }, [userId]);

  useEffect(() => {
    void loadActivePlan();
  }, [loadActivePlan]);

  const toggleRestDay = (day: number) => {
    setRestDays((v) => (v.includes(day) ? v.filter((d) => d !== day) : [...v, day]));
  };

  const generate = async (e: FormEvent) => {
    e.preventDefault();
    if (!userId || !date || !selected.length) return;
    if (restDays.length >= 7) {
      toast({ description: "Keep at least one day free for studying.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const chosen = units.filter((u) => selected.includes(u.id));
      const studyDays = Math.max(1, Math.ceil((new Date(date).getTime() - Date.now()) / 86400000));
      const rows = buildScheduleRows(chosen, studyDays, minutes, restDays);
      if (!rows.length) {
        toast({ description: "Your exam date and rest days leave no study days. Adjust and try again.", variant: "destructive" });
        return;
      }

      const { data: plan, error } = await supabase
        .from("revision_plans")
        .insert({
          user_id: userId,
          title: `Year ${year} revision plan`,
          unit_ids: selected,
          exam_date: date,
          daily_minutes: minutes,
          study_days: studyDays,
          rest_days: restDays,
          activity_types: ["read", "practice"],
        })
        .select("id, title, exam_date, daily_minutes, rest_days, unit_ids")
        .single();
      if (error || !plan) throw error || new Error("Plan could not be created");

      const { data: inserted, error: itemsError } = await supabase
        .from("revision_plan_items")
        .insert(rows.map((r) => ({ ...r, plan_id: plan.id, user_id: userId })))
        .select("id, scheduled_date, resource_title, activity, estimated_minutes, status");
      if (itemsError) throw itemsError;

      setActivePlan(plan);
      setItems(inserted || []);
      toast({ description: "Your revision plan is ready." });
    } catch {
      toast({ description: "Could not build your plan. Please try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const endPlan = async () => {
    if (!activePlan) return;
    setEnding(true);
    try {
      const { error } = await supabase.from("revision_plans").update({ active: false }).eq("id", activePlan.id);
      if (error) throw error;
      setActivePlan(null);
      setItems([]);
      setSelected([]);
      toast({ description: "Plan ended. Build a new one whenever you're ready." });
    } catch {
      toast({ description: "Could not end this plan. Please try again.", variant: "destructive" });
    } finally {
      setEnding(false);
    }
  };

  const toggle = async (item: PlanItem) => {
    const status = item.status === "completed" ? "pending" : "completed";
    setItems((v) => v.map((x) => (x.id === item.id ? { ...x, status } : x)));
    try {
      const { error } = await supabase.from("revision_plan_items").update({ status }).eq("id", item.id);
      if (error) throw error;
    } catch {
      setItems((v) => v.map((x) => (x.id === item.id ? { ...x, status: item.status } : x)));
      toast({ description: "Could not update that task. Please try again.", variant: "destructive" });
    }
  };

  if (!user) {
    return (
      <main className="mx-auto max-w-2xl px-5 py-16 text-center">
        <LockKeyhole className="mx-auto h-8 w-8 text-primary" />
        <h1 className="mt-3 font-serif text-3xl font-bold">Revision Planner</h1>
        <p className="mt-2 text-muted-foreground">Sign in to create and save a personal examination plan.</p>
        <Link to="/login" className="mt-5 inline-block border bg-primary px-5 py-2.5 font-bold text-primary-foreground">
          Sign in
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-5 py-8 sm:py-12">
      <Helmet>
        <title>Revision Planner | OmpathStudy</title>
        <meta name="robots" content="noindex" />
      </Helmet>

      <nav aria-label="Breadcrumb" className="mb-4 text-xs text-muted-foreground">
        <Link to="/" className="hover:text-primary">Home</Link> ›{" "}
        <Link to="/my-revision" className="hover:text-primary">My Revision</Link> ›{" "}
        <span className="text-foreground">Revision Planner</span>
      </nav>

      {planLoading ? (
        <div className="grid gap-8 lg:grid-cols-[360px_1fr]">
          <Skeleton className="h-96 w-full border-y" />
          <div className="space-y-2">
            <Skeleton className="h-16 w-full border" />
            <Skeleton className="h-16 w-full border" />
            <Skeleton className="h-16 w-full border" />
          </div>
        </div>
      ) : activePlan ? (
        <div className="grid gap-8 lg:grid-cols-[360px_1fr]">
          <div className="h-fit border-y border-border bg-card p-5">
            <CalendarDays className="h-6 w-6 text-primary" aria-hidden="true" />
            <h1 className="mt-3 font-serif text-2xl font-bold">{activePlan.title}</h1>
            <dl className="mt-4 space-y-2 text-sm text-muted-foreground">
              {activePlan.exam_date && (
                <div className="flex justify-between gap-2">
                  <dt>Exam date</dt>
                  <dd className="font-medium text-foreground">{activePlan.exam_date}</dd>
                </div>
              )}
              {activePlan.daily_minutes != null && (
                <div className="flex justify-between gap-2">
                  <dt>Daily target</dt>
                  <dd className="font-medium text-foreground">{activePlan.daily_minutes} min</dd>
                </div>
              )}
              <div className="flex justify-between gap-2">
                <dt>Rest days</dt>
                <dd className="font-medium text-foreground">
                  {activePlan.rest_days.length ? activePlan.rest_days.map((d) => DAY_LABELS[d]).join(", ") : "None"}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt>Progress</dt>
                <dd className="font-medium text-foreground">
                  {items.filter((i) => i.status === "completed").length} / {items.length} done
                </dd>
              </div>
            </dl>
            <Button
              variant="outline"
              onClick={endPlan}
              disabled={ending}
              className="mt-5 w-full min-h-[44px] gap-2"
            >
              {ending ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
              End this plan
            </Button>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Ending this plan keeps its history but lets you build a fresh one.
            </p>
          </div>

          <section>
            <h2 className="font-serif text-2xl font-bold">Your schedule</h2>
            <p className="mt-1 text-sm text-muted-foreground">A balanced sequence of reading and question practice.</p>

            <div className="mt-5 space-y-2">
              {items.length ? (
                items.map((i) => (
                  <button
                    key={i.id}
                    type="button"
                    onClick={() => toggle(i)}
                    aria-pressed={i.status === "completed"}
                    className={`flex w-full items-center gap-3 border p-4 text-left transition-colors ${
                      i.status === "completed" ? "border-primary/20 bg-primary/5" : "border-border bg-card hover:border-primary/30"
                    }`}
                  >
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${
                        i.status === "completed" ? "bg-primary text-primary-foreground" : "border-border"
                      }`}
                      aria-hidden="true"
                    >
                      {i.status === "completed" && <Check className="h-4 w-4" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <strong className="block truncate text-sm">{i.resource_title}</strong>
                      <span className="text-xs text-muted-foreground">
                        {i.scheduled_date} · {i.activity} · {i.estimated_minutes} min
                      </span>
                    </span>
                  </button>
                ))
              ) : (
                <p className="border border-dashed border-border p-10 text-center text-muted-foreground">
                  This plan has no scheduled sessions yet.
                </p>
              )}
            </div>
          </section>
        </div>
      ) : (
        <div className="grid gap-8 lg:grid-cols-[360px_1fr]">
          <form onSubmit={generate} className="h-fit border-y border-border bg-card p-5">
            <CalendarDays className="h-6 w-6 text-primary" aria-hidden="true" />
            <h1 className="mt-3 font-serif text-2xl font-bold">Build your plan</h1>

            <label htmlFor="rp-year" className="mt-5 block text-xs font-bold">Academic year</label>
            <select
              id="rp-year"
              value={year}
              onChange={(e) => { setYear(+e.target.value); setSelected([]); }}
              className="mt-1 w-full min-h-[44px] border border-border bg-background p-2.5"
            >
              {[1, 2, 3, 4, 5, 6].map((y) => <option key={y} value={y}>Year {y}</option>)}
            </select>

            <fieldset className="mt-4">
              <legend className="block text-xs font-bold">Units</legend>
              <div className="mt-2 max-h-56 space-y-1 overflow-auto">
                {units.length === 0 && (
                  <p className="border border-dashed border-border p-3 text-xs text-muted-foreground">
                    No units published for Year {year} yet.
                  </p>
                )}
                {units.map((u) => (
                  <label key={u.id} className="flex items-center gap-2 border p-2 text-sm hover:bg-muted">
                    <input
                      type="checkbox"
                      checked={selected.includes(u.id)}
                      onChange={() => setSelected((v) => (v.includes(u.id) ? v.filter((x) => x !== u.id) : [...v, u.id]))}
                      className="h-4 w-4"
                    />
                    {u.name}
                  </label>
                ))}
              </div>
            </fieldset>

            <label htmlFor="rp-date" className="mt-4 block text-xs font-bold">Exam date</label>
            <input
              id="rp-date"
              type="date"
              min={localDateStr(new Date(Date.now() + 86400000))}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1 w-full min-h-[44px] border border-border bg-background p-2.5"
            />

            <label htmlFor="rp-minutes" className="mt-4 block text-xs font-bold">Minutes per day</label>
            <input
              id="rp-minutes"
              type="number"
              min="20"
              max="480"
              value={minutes}
              onChange={(e) => setMinutes(+e.target.value)}
              className="mt-1 w-full min-h-[44px] border border-border bg-background p-2.5"
            />

            <fieldset className="mt-4">
              <legend className="block text-xs font-bold">Rest days</legend>
              <p className="mt-1 text-[11px] text-muted-foreground">No sessions are scheduled on these days.</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {DAY_LABELS.map((label, day) => {
                  const active = restDays.includes(day);
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => toggleRestDay(day)}
                      aria-pressed={active}
                      className={`min-h-[36px] min-w-[44px] border px-2 text-xs font-semibold transition-colors ${
                        active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground hover:border-primary/40"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <Button disabled={loading || !date || !selected.length} className="mt-5 w-full min-h-[44px]">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Generate plan"}
            </Button>
          </form>

          <section>
            <h2 className="font-serif text-2xl font-bold">Your schedule</h2>
            <p className="mt-1 text-sm text-muted-foreground">A balanced sequence of reading and question practice.</p>
            <p className="mt-5 border border-dashed border-border p-10 text-center text-muted-foreground">
              Choose units and an exam date to generate your schedule.
            </p>
          </section>
        </div>
      )}
    </main>
  );
}
