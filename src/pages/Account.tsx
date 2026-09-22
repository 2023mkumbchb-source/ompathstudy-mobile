import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import {
  Loader2, ShieldCheck, Pencil, Check, LogOut, KeyRound, GraduationCap, X,
  LayoutDashboard, FileEdit, FolderTree, Database, BookOpen, Target, Sparkles, Bell,
  Smartphone, Volume2, ChevronRight, RefreshCw, CreditCard,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  AccountInfo, fetchAccount, normalizePassCode, readStoredPass, renamePassCode, useAccess, verifyCode,
} from "@/lib/access";
import { UNIVERSITIES, COURSES } from "@/components/LearnerProfileGate";
import { celebrate } from "@/lib/celebration";
import { toast } from "@/hooks/use-toast";
import {
  getMobileNotificationPrefs,
  saveMobileNotificationPrefs,
  MobileNotificationPrefs,
  checkNotificationPermission,
  requestNotificationPermission,
  playNotificationChime,
  triggerNativeNotification,
} from "@/lib/notifications";

interface StudyProfile {
  display_name: string;
  university: string;
  course: string;
  study_year: string;
}

const EMPTY_PROFILE: StudyProfile = { display_name: "", university: "", course: "", study_year: "" };

/** Subscriber account page: plan, pass code, study profile and sign-out. */
export default function Account() {
  const { user, isAdmin, signOut } = useAuth();
  const access = useAccess();
  const [info, setInfo] = useState<AccountInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [codeInput, setCodeInput] = useState("");
  const [newCode, setNewCode] = useState("");
  const [busy, setBusy] = useState(false);

  const [profile, setProfile] = useState<StudyProfile>(EMPTY_PROFILE);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileDraft, setProfileDraft] = useState<StudyProfile>(EMPTY_PROFILE);
  const [savingProfile, setSavingProfile] = useState(false);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [savingNotifications, setSavingNotifications] = useState(false);

  const [adminStats, setAdminStats] = useState<{ articles: number; students: number } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetchAccount(readStoredPass()?.code);
    setInfo(res);
    setNewCode(res.code || "");
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load, user?.id]);

  useEffect(() => {
    if (!user) { setProfile(EMPTY_PROFILE); setProfileLoaded(false); return; }
    let alive = true;
    (supabase as any)
      .from("profiles")
      .select("display_name,university,course,study_year")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }: { data: any }) => {
        if (!alive) return;
        const next: StudyProfile = {
          display_name: data?.display_name || "",
          university: data?.university || "",
          course: data?.course || "",
          study_year: data?.study_year ? String(data.study_year) : "",
        };
        setProfile(next);
        setProfileDraft(next);
        setProfileLoaded(true);
      });
    return () => { alive = false; };
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    (supabase as any).from("notification_preferences").select("email_enabled").eq("user_id", user.id).maybeSingle()
      .then(({ data }: { data: { email_enabled?: boolean } | null }) => setEmailNotifications(data?.email_enabled !== false));
  }, [user?.id]);

  const updateEmailNotifications = async (enabled: boolean) => {
    if (!user) return;
    setSavingNotifications(true);
    const { error } = await (supabase as any).from("notification_preferences").upsert({
      user_id: user.id, email_enabled: enabled, updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    setSavingNotifications(false);
    if (error) return toast({ title: "Preference was not saved", description: error.message, variant: "destructive" });
    setEmailNotifications(enabled);
    toast({ title: enabled ? "Email notifications enabled" : "Email notifications disabled" });
  };

  const [mobilePrefs, setMobilePrefs] = useState<MobileNotificationPrefs>(getMobileNotificationPrefs());
  const [permStatus, setPermStatus] = useState<"granted" | "denied" | "prompt">("granted");

  useEffect(() => {
    setMobilePrefs(getMobileNotificationPrefs());
    checkNotificationPermission().then(setPermStatus);
  }, []);

  const updateMobilePref = (key: keyof MobileNotificationPrefs, val: boolean) => {
    const updated = saveMobileNotificationPrefs({ [key]: val });
    setMobilePrefs(updated);
    toast({ title: `${key === "pushEnabled" ? "Push alerts" : key === "soundEnabled" ? "Chimes" : "In-app popups"} ${val ? "enabled" : "disabled"}` });
  };

  const testMobileAlert = async () => {
    playNotificationChime();
    await triggerNativeNotification({
      id: `test_acc_${Date.now()}`,
      title: "Ompath Study Push Alert",
      message: "Mobile notifications and sound alerts are working smoothly on your device!",
      type: "update",
      priority: "urgent",
      created_at: new Date().toISOString(),
      action_url: "/notifications",
    });
    toast({ title: "Test notification sent to device! 🔔" });
  };

  useEffect(() => {
    if (!isAdmin) { setAdminStats(null); return; }
    let alive = true;
    Promise.all([
      supabase.from("articles").select("id", { count: "exact", head: true }).eq("published", true),
      (supabase as any).from("profiles").select("id", { count: "exact", head: true }),
    ]).then(([articlesRes, profilesRes]) => {
      if (!alive) return;
      setAdminStats({ articles: articlesRes.count || 0, students: (profilesRes as any).count || 0 });
    });
    return () => { alive = false; };
  }, [isAdmin]);

  const startEditProfile = () => { setProfileDraft(profile); setEditingProfile(true); };
  const cancelEditProfile = () => { setProfileDraft(profile); setEditingProfile(false); };

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profileDraft.display_name.trim() || !profileDraft.university || !profileDraft.course || !profileDraft.study_year) return;
    setSavingProfile(true);
    const { error } = await (supabase as any).from("profiles").upsert({
      user_id: user.id,
      display_name: profileDraft.display_name.trim(),
      university: profileDraft.university,
      course: profileDraft.course,
      study_year: Number(profileDraft.study_year),
      onboarding_completed: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    setSavingProfile(false);
    if (error) { toast({ title: "Profile was not saved", description: error.message, variant: "destructive" }); return; }
    setProfile(profileDraft);
    setEditingProfile(false);
    celebrate();
    toast({ title: "Study profile updated" });
  };

  const link = async () => {
    setBusy(true);
    const res = await verifyCode(codeInput);
    setBusy(false);
    if (!res.ok) {
      toast({ title: "Could not link that code", description: res.error, variant: "destructive" });
      return;
    }
    access.applyPass(res.pass!);
    toast({ title: "Subscription linked" });
    load();
  };

  const rename = async () => {
    if (!info?.code) return;
    setBusy(true);
    const res = await renamePassCode(info.code, newCode);
    setBusy(false);
    if (!res.ok) {
      toast({ title: "Could not change the code", description: res.error, variant: "destructive" });
      return;
    }
    access.applyPass(res.pass!);
    toast({ title: "Code updated" });
    load();
  };

  return (
    <div className="mx-auto min-h-[65vh] max-w-2xl px-5 py-10">
      <Helmet>
        <title>My account | Ompath Study</title>
        <meta name="description" content="Manage your Ompath Study subscription and pass code." />
        <meta name="robots" content="noindex" />
      </Helmet>

      <h1 className="font-serif text-3xl font-bold text-foreground">My account</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {user?.email ? `Signed in as ${user.email}` : "You are browsing as a guest."}
      </p>

      {!user && (
        <>
          <Link
            to="/login"
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
          >
            <ShieldCheck className="h-4 w-4" /> Sign in with Google or email
          </Link>

          <section className="mt-6 border-y border-dashed border-border bg-card/60 p-5">
            <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-primary" /> Why sign in?
            </p>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2"><GraduationCap className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> A study profile that tailors recommendations to your course and year</li>
              <li className="flex items-start gap-2"><Target className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> Progress and MCQ attempts saved to your account, not just this device</li>
              <li className="flex items-start gap-2"><BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> Pass codes and subscriptions linked permanently to your email</li>
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">Guest browsing still works — progress is just kept on this device only, and is lost if you clear your browser data.</p>
          </section>
        </>
      )}

      {user && (
        <section className="mt-6 border-y border-border bg-card p-5">
          <div className="flex items-center justify-between gap-2">
            <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
              <GraduationCap className="h-3.5 w-3.5 text-primary" /> Study profile
            </p>
            {profileLoaded && !editingProfile && (
              <button type="button" onClick={startEditProfile} className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                <Pencil className="h-3 w-3" /> Edit
              </button>
            )}
          </div>

          {!profileLoaded ? (
            <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…</div>
          ) : editingProfile ? (
            <form onSubmit={saveProfile} className="mt-3 space-y-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-muted-foreground" htmlFor="acc-profile-name">Name</label>
                <input
                  id="acc-profile-name"
                  value={profileDraft.display_name}
                  onChange={(e) => setProfileDraft((d) => ({ ...d, display_name: e.target.value }))}
                  required
                  className="w-full border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-muted-foreground" htmlFor="acc-profile-university">University</label>
                <select
                  id="acc-profile-university"
                  value={profileDraft.university}
                  onChange={(e) => setProfileDraft((d) => ({ ...d, university: e.target.value }))}
                  required
                  className="min-h-11 w-full border border-border bg-background px-3 text-sm text-foreground"
                >
                  <option value="">Select university</option>{UNIVERSITIES.map((x) => <option key={x}>{x}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-muted-foreground" htmlFor="acc-profile-course">Course</label>
                <select
                  id="acc-profile-course"
                  value={profileDraft.course}
                  onChange={(e) => setProfileDraft((d) => ({ ...d, course: e.target.value }))}
                  required
                  className="min-h-11 w-full border border-border bg-background px-3 text-sm text-foreground"
                >
                  <option value="">Select course</option>{COURSES.map((x) => <option key={x}>{x}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-muted-foreground" htmlFor="acc-profile-year">Current year</label>
                <select
                  id="acc-profile-year"
                  value={profileDraft.study_year}
                  onChange={(e) => setProfileDraft((d) => ({ ...d, study_year: e.target.value }))}
                  required
                  className="min-h-11 w-full border border-border bg-background px-3 text-sm text-foreground"
                >
                  <option value="">Select year</option>{[1, 2, 3, 4, 5, 6].map((x) => <option key={x} value={x}>Year {x}</option>)}
                </select>
              </div>
              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={savingProfile} className="inline-flex items-center gap-1.5 border bg-primary px-3 py-2 text-xs font-bold text-primary-foreground disabled:opacity-50">
                  {savingProfile ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Save
                </button>
                <button type="button" onClick={cancelEditProfile} className="inline-flex items-center gap-1.5 border border-border px-3 py-2 text-xs font-semibold text-foreground">
                  <X className="h-3.5 w-3.5" /> Cancel
                </button>
              </div>
            </form>
          ) : profile.display_name ? (
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Name</dt><dd className="text-foreground">{profile.display_name}</dd>
              <dt className="text-muted-foreground">University</dt><dd className="text-foreground">{profile.university}</dd>
              <dt className="text-muted-foreground">Course</dt><dd className="text-foreground">{profile.course}</dd>
              <dt className="text-muted-foreground">Year</dt><dd className="text-foreground">Year {profile.study_year}</dd>
            </dl>
          ) : (
            <div className="mt-3">
              <p className="text-sm text-muted-foreground">You haven't set up a study profile yet.</p>
              <button type="button" onClick={startEditProfile} className="mt-2 inline-flex items-center gap-1.5 border bg-primary px-3 py-2 text-xs font-bold text-primary-foreground">
                <GraduationCap className="h-3.5 w-3.5" /> Set up study profile
              </button>
            </div>
          )}
        </section>
      )}

      {user && (
        <section className="mt-4 border-y border-border bg-card p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground"><Bell className="h-3.5 w-3.5 text-primary" /> Email Notifications</p>
              <p className="mt-1 text-sm text-muted-foreground">Receive important study-resource and account updates by email.</p>
            </div>
            <button type="button" role="switch" aria-checked={emailNotifications} disabled={savingNotifications} onClick={() => void updateEmailNotifications(!emailNotifications)} className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50 ${emailNotifications ? "bg-primary" : "bg-muted"}`}>
              <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${emailNotifications ? "translate-x-6" : "translate-x-1"}`} />
            </button>
          </div>
        </section>
      )}

      {/* Mobile App Notifications Card */}
      <Link to="/updates" className="mt-4 flex items-center justify-between border-y border-primary/20 bg-primary/5 p-5 transition hover:bg-primary/10">
        <div><p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-primary"><RefreshCw className="h-4 w-4" /> App Update Center</p><p className="mt-1 text-sm text-muted-foreground">Check, install and restart without downloading another APK.</p></div>
        <ChevronRight className="h-5 w-5 text-primary" />
      </Link>

      <section className="mt-4 border-y border-border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
              <Smartphone className="h-3.5 w-3.5 text-primary" /> Mobile App Notifications
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Push alerts, CAT reminders, and sound chimes on this device.
            </p>
          </div>
          <button
            type="button"
            onClick={testMobileAlert}
            className="inline-flex items-center gap-1.5 border border-border bg-muted/40 px-2.5 py-1.5 text-xs font-semibold text-foreground hover:bg-muted"
          >
            <Volume2 className="h-3.5 w-3.5 text-primary" /> Test
          </button>
        </div>

        {permStatus !== "granted" && (
          <div className="flex items-center justify-between border border-amber-500/20 bg-amber-500/10 p-3 text-xs">
            <span className="text-amber-600 dark:text-amber-400 font-medium">
              Android permission needed for background exam alerts
            </span>
            <button
              type="button"
              onClick={async () => {
                const granted = await requestNotificationPermission();
                setPermStatus(granted ? "granted" : "denied");
                if (granted) toast({ title: "Notification permission granted! 🔔" });
              }}
              className="rounded-md bg-amber-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-amber-700"
            >
              Grant
            </button>
          </div>
        )}

        <div className="space-y-3 pt-1">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-foreground">Status Bar Push Alerts</p>
              <p className="text-[11px] text-muted-foreground">Receive CAT and exam alerts on Android tray</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={mobilePrefs.pushEnabled}
              onClick={() => updateMobilePref("pushEnabled", !mobilePrefs.pushEnabled)}
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${mobilePrefs.pushEnabled ? "bg-primary" : "bg-muted"}`}
            >
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${mobilePrefs.pushEnabled ? "translate-x-5" : "translate-x-0.5"}`} />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-foreground">WhatsApp-Style In-App Banners</p>
              <p className="text-[11px] text-muted-foreground">Pop floating banners when new updates are published</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={mobilePrefs.bannerEnabled}
              onClick={() => updateMobilePref("bannerEnabled", !mobilePrefs.bannerEnabled)}
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${mobilePrefs.bannerEnabled ? "bg-primary" : "bg-muted"}`}
            >
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${mobilePrefs.bannerEnabled ? "translate-x-5" : "translate-x-0.5"}`} />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-foreground">Notification Sound & Chimes</p>
              <p className="text-[11px] text-muted-foreground">Gentle audio chime when announcements arrive</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={mobilePrefs.soundEnabled}
              onClick={() => updateMobilePref("soundEnabled", !mobilePrefs.soundEnabled)}
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${mobilePrefs.soundEnabled ? "bg-primary" : "bg-muted"}`}
            >
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${mobilePrefs.soundEnabled ? "translate-x-5" : "translate-x-0.5"}`} />
            </button>
          </div>
        </div>

        <div className="pt-2 border-t border-border">
          <Link
            to="/notifications"
            className="flex items-center justify-between text-xs font-semibold text-primary hover:underline"
          >
            <span>Open Notification Center (view announcements & history)</span>
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {isAdmin && (
        <section className="mt-4 border-y border-border bg-card p-5">
          <p className="mb-3 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            <LayoutDashboard className="h-3.5 w-3.5 text-primary" /> Admin
          </p>
          {adminStats && (
            <div className="mb-3 grid grid-cols-2 gap-3">
              <div className="border bg-muted/50 p-3">
                <p className="font-serif text-xl font-bold text-foreground">{adminStats.articles}</p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">published articles</p>
              </div>
              <div className="border bg-muted/50 p-3">
                <p className="font-serif text-xl font-bold text-foreground">{adminStats.students}</p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">student profiles</p>
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <Link to="/admin" className="flex items-center gap-2 border border-border px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted/40">
              <LayoutDashboard className="h-3.5 w-3.5 text-primary" /> Dashboard
            </Link>
            <Link to="/admin/notifications" className="flex items-center gap-2 border border-border px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted/40 bg-primary/5 border-primary/20">
              <Bell className="h-3.5 w-3.5 text-primary" /> Broadcast Studio
            </Link>
            <Link to="/admin/editor" className="flex items-center gap-2 border border-border px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted/40">
              <FileEdit className="h-3.5 w-3.5 text-primary" /> Editor
            </Link>
            <Link to="/admin/categories" className="flex items-center gap-2 border border-border px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted/40">
              <FolderTree className="h-3.5 w-3.5 text-primary" /> Categories
            </Link>
            <Link to="/admin/study-system" className="flex items-center gap-2 border border-border px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted/40">
              <Database className="h-3.5 w-3.5 text-primary" /> Study System
            </Link>
            <Link to="/admin/payments" className="flex items-center gap-2 border border-border px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted/40">
              <CreditCard className="h-3.5 w-3.5 text-primary" /> Payments
            </Link>
          </div>
        </section>
      )}

      {loading ? (
        <div className="flex min-h-[30vh] items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : info?.found ? (
        <>
          <section className="mt-6 border-y border-border bg-card p-5">
            <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Subscription
            </p>
            <p className="mt-2 font-serif text-xl font-bold text-foreground">{info.plan}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {info.expired
                ? `Expired on ${new Date(info.expires_at!).toLocaleDateString()}`
                : `Active until ${new Date(info.expires_at!).toLocaleDateString()}`}
              {info.allow_download ? " · PDF handouts included" : ""}
            </p>
          </section>

          <section className="mt-4 border-y border-border bg-card p-5">
            <p className="mb-2 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
              <Pencil className="h-3.5 w-3.5" /> Your pass code
            </p>
            <div className="flex gap-2">
              <input
                value={newCode}
                onChange={(e) => setNewCode(normalizePassCode(e.target.value))}
                className="flex-1 border border-border bg-background px-3 py-2 font-mono text-sm font-bold text-foreground outline-none focus:border-primary"
              />
              <button
                type="button"
                onClick={rename}
                disabled={busy || !newCode || newCode === info.code}
                className="inline-flex items-center gap-1.5 border bg-primary px-3 py-2 text-xs font-bold text-primary-foreground disabled:opacity-50"
              >
                <Check className="h-3.5 w-3.5" /> Save
              </button>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Codes are matched loosely — capitals, spaces and dashes don’t matter when you sign in.
            </p>
          </section>

        </>
      ) : (
        <section className="mt-6 border-y border-border bg-card p-5">
          <p className="mb-2 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            <KeyRound className="h-3.5 w-3.5" /> No subscription found on this account
          </p>
          <p className="mb-3 text-sm text-muted-foreground">
            Already paid? Enter your pass code once to link it to this email account.
          </p>
          <div className="flex gap-2">
            <input
              value={codeInput}
              onChange={(e) => setCodeInput(normalizePassCode(e.target.value))}
              placeholder="OM-XXXXXXXX"
              className="flex-1 border border-border bg-background px-3 py-2 font-mono text-sm text-foreground outline-none focus:border-primary"
            />
            <button
              type="button"
              onClick={link}
              disabled={busy || !codeInput}
              className="inline-flex items-center gap-1.5 border bg-primary px-4 py-2 text-xs font-bold text-primary-foreground disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Link
            </button>
          </div>
        </section>
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        {access.hasPass && (
          <button
            type="button"
            onClick={() => { access.signOutPass(); toast({ title: "Saved pass cleared" }); load(); }}
            className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-xs font-semibold text-foreground"
          >
            <LogOut className="h-3.5 w-3.5" /> Clear saved pass
          </button>
        )}
        {user && (
          <button
            type="button"
            onClick={async () => { await signOut(); toast({ title: "Signed out" }); }}
            className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-xs font-semibold text-foreground"
          >
            <LogOut className="h-3.5 w-3.5" /> Sign out of my account
          </button>
        )}
      </div>
    </div>
  );
}
