import { useEffect, useState } from "react";
import { GraduationCap, Loader2, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { celebrate } from "@/lib/celebration";

export const UNIVERSITIES = ["Mount Kenya University", "University of Nairobi", "Kenyatta University", "Moi University", "JKUAT", "Other"];
export const COURSES = [
  "MBChB — Medicine & Surgery",
  "BDS — Dental Surgery",
  "BSc Nursing",
  "BSc Clinical Medicine",
  "BSc Pharmacy",
  "BSc Medical Laboratory Sciences",
  "BSc Public Health",
  "BSc Physiotherapy",
  "BSc Nutrition & Dietetics",
  "Other",
];

const REGISTRATION_PROFILE_PENDING = "ompath_registration_profile_pending";

/** The study-profile dialog is opt-in from the account-creation flow only. */
export function markRegistrationProfilePending() {
  try { localStorage.setItem(REGISTRATION_PROFILE_PENDING, "true"); } catch { /* unavailable storage */ }
}

function isRegistrationProfilePending() {
  try { return localStorage.getItem(REGISTRATION_PROFILE_PENDING) === "true"; } catch { return false; }
}

function clearRegistrationProfilePending() {
  try { localStorage.removeItem(REGISTRATION_PROFILE_PENDING); } catch { /* unavailable storage */ }
}

export default function LearnerProfileGate() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [checking, setChecking] = useState(false);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  const [name, setName] = useState("");
  const [university, setUniversity] = useState("");
  const [course, setCourse] = useState("MBChB — Medicine & Surgery");
  const [year, setYear] = useState("");

  useEffect(() => {
    if (authLoading || !user || isAdmin) { setOpen(false); return; }
    // Never turn a failed/offline profile request into a blocking dialog. Existing
    // learners edit these fields from Account; only a fresh registration sets this flag.
    if (!navigator.onLine || !isRegistrationProfilePending()) {
      setOpen(false);
      setChecking(false);
      return;
    }
    let alive = true;
    setChecking(true);
    (supabase as any).from("profiles").select("display_name,university,course,study_year,onboarding_completed").eq("user_id", user.id).maybeSingle()
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) { setOpen(false); return; }
        setName(data?.display_name || String(user.user_metadata?.full_name || ""));
        setUniversity((data as any)?.university || "");
        setCourse((data as any)?.course || "MBChB — Medicine & Surgery");
        setYear((data as any)?.study_year ? String((data as any).study_year) : "");
        if ((data as any)?.onboarding_completed) {
          clearRegistrationProfilePending();
          setOpen(false);
        } else {
          setOpen(true);
        }
      })
      .catch(() => { if (alive) setOpen(false); })
      .finally(() => { if (alive) setChecking(false); });
    return () => { alive = false; };
  }, [user, isAdmin, authLoading]);

  if (!user || isAdmin || authLoading || checking || !open) return null;

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim() || !university || !course || !year) return;
    setSaving(true);
    const { error } = await (supabase as any).from("profiles").upsert({
      user_id: user.id,
      display_name: name.trim(),
      university,
      course,
      study_year: Number(year),
      onboarding_completed: true,
      updated_at: new Date().toISOString(),
    } as any, { onConflict: "user_id" });
    setSaving(false);
    if (error) { toast({ title: "Profile was not saved", description: error.message, variant: "destructive" }); return; }
    clearRegistrationProfilePending();
    celebrate();
    setCelebrating(true);
    toast({ title: "Study profile ready", description: "Recommendations will now follow your course and year." });
    setTimeout(() => { setOpen(false); setCelebrating(false); }, 1100);
  };

  return <div className="fixed inset-0 z-[200] grid place-items-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm">
    {celebrating ? (
      <div className="w-full max-w-md animate-in fade-in zoom-in-95 rounded-3xl border border-border bg-card p-8 text-center shadow-2xl duration-300">
        <div className="mx-auto flex h-16 w-16 animate-in zoom-in spin-in-6 items-center justify-center rounded-full bg-primary/10 text-primary duration-500">
          <Sparkles className="h-8 w-8" />
        </div>
        <h2 className="mt-4 font-serif text-xl font-bold text-foreground">You're all set, {name.trim().split(" ")[0]}!</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">Personalising your revision now…</p>
      </div>
    ) : (
    <form onSubmit={save} className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl sm:p-8">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"><GraduationCap /></div>
      <h1 className="mt-4 font-serif text-2xl font-bold">Tell us what you study</h1>
      <p className="mt-2 text-sm text-muted-foreground">This lets OmpathStudy identify untouched units and recommend topics from answers you miss.</p>
      <label className="mt-5 block text-sm font-semibold" htmlFor="profile-name">Your name</label>
      <Input id="profile-name" value={name} onChange={e => setName(e.target.value)} required className="mt-1" />
      <label className="mt-4 block text-sm font-semibold" htmlFor="profile-university">University</label>
      <select id="profile-university" value={university} onChange={e => setUniversity(e.target.value)} required className="mt-1 min-h-11 w-full rounded-lg border border-border bg-background px-3">
        <option value="">Select university</option>{UNIVERSITIES.map(x => <option key={x}>{x}</option>)}
      </select>
      <label className="mt-4 block text-sm font-semibold" htmlFor="profile-course">Course</label>
      <select id="profile-course" value={course} onChange={e => setCourse(e.target.value)} required className="mt-1 min-h-11 w-full rounded-lg border border-border bg-background px-3">
        <option value="">Select course</option>{COURSES.map(x => <option key={x}>{x}</option>)}
      </select>
      <label className="mt-4 block text-sm font-semibold" htmlFor="profile-year">Current year</label>
      <select id="profile-year" value={year} onChange={e => setYear(e.target.value)} required className="mt-1 min-h-11 w-full rounded-lg border border-border bg-background px-3">
        <option value="">Select year</option>{[1,2,3,4,5,6].map(x => <option key={x} value={x}>Year {x}</option>)}
      </select>
      <Button type="submit" disabled={saving} className="mt-6 min-h-11 w-full">{saving ? <Loader2 className="animate-spin" /> : "Start personalised revision"}</Button>
    </form>
    )}
  </div>;
}
