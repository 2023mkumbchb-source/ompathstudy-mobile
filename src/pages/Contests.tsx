import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, BookOpenCheck, Building2, CalendarClock, ShieldCheck, Sparkles, Trophy, Users } from "lucide-react";
import { CONTEST_RULES, FLAGSHIP_CONTEST, UNIVERSITY_LEADERS } from "@/lib/contest";
import { updateMetaTags } from "@/lib/seo";
import { useEffect, useState } from "react";
import { loadContestPlatform, type ContestUniversity } from "@/lib/contest-store";

const features = [
  { icon: Building2, title: "University representation", copy: "Verified institutional teams competing across medical-school years." },
  { icon: BookOpenCheck, title: "Clinically grounded questions", copy: "Structured medical questions with locked answer keys and reviewed explanations." },
  { icon: ShieldCheck, title: "Transparent integrity", copy: "Clearly disclosed event logging, moderator review and published appeal rules." },
];

export default function Contests() {
  const [contest, setContest] = useState(FLAGSHIP_CONTEST);
  const [universities, setUniversities] = useState<ContestUniversity[]>([]);

  useEffect(() => {
    updateMetaTags({
      title: "Mega Contest | OmpathStudy",
      description: "OmpathStudy's inter-university medical knowledge competition for students across Kenya.",
    });
    loadContestPlatform().then(({ contests, universities: rows }) => {
      const flagship = contests.find((item) => item.slug === FLAGSHIP_CONTEST.slug);
      if (flagship) setContest(flagship);
      setUniversities(rows);
    }).catch(() => {
      // Keep the static preview available during a temporary API interruption.
    });
  }, []);

  return (
    <div className="min-h-dvh bg-[#071315] text-white">
      <section className="relative overflow-hidden border-b border-white/10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_20%,rgba(39,196,180,0.18),transparent_38%),radial-gradient(circle_at_20%_70%,rgba(249,115,82,0.10),transparent_34%)]" />
        <div className="relative mx-auto max-w-6xl px-5 py-16 sm:py-24">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-teal-300/20 bg-teal-300/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-teal-200">
              <Sparkles className="h-3.5 w-3.5" /> In development
            </span>
            <h1 className="mt-6 font-serif text-4xl font-bold leading-[1.05] sm:text-6xl">Medicine becomes an arena.</h1>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-white/65 sm:text-lg">
              The OmpathStudy Mega Contest will bring medical students together for verified, fair and clinically meaningful inter-university competition.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to={`/contests/${contest.slug}/briefing`} className="inline-flex items-center gap-2 rounded-lg bg-teal-300 px-5 py-3 text-sm font-bold text-[#071315] transition hover:bg-teal-200">
                Preview contest briefing <ArrowRight className="h-4 w-4" />
              </Link>
              <a href="#format" className="rounded-lg border border-white/15 px-5 py-3 text-sm font-bold text-white/80 transition hover:bg-white/5">Explore the format</a>
            </div>
          </motion.div>
        </div>
      </section>

      <main className="mx-auto max-w-6xl space-y-16 px-5 py-12 sm:py-16">
        <section id="format" className="grid gap-5 md:grid-cols-3">
          {features.map(({ icon: Icon, title, copy }, index) => (
            <motion.article key={title} initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: index * 0.08 }} className="rounded-2xl border border-white/10 bg-white/[0.035] p-6">
              <Icon className="h-6 w-6 text-teal-300" />
              <h2 className="mt-5 text-lg font-bold">{title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-white/55">{copy}</p>
            </motion.article>
          ))}
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.35fr,0.65fr]">
          <article className="overflow-hidden rounded-2xl border border-white/10 bg-[#0b1d20]">
            <div className="border-b border-white/10 p-6 sm:p-8">
              <div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-[0.15em] text-teal-300">
                <Trophy className="h-4 w-4" /> Flagship competition
              </div>
              <h2 className="mt-4 font-serif text-3xl font-bold">{contest.title}</h2>
              <p className="mt-3 max-w-2xl text-white/60">{contest.subtitle}</p>
            </div>
            <dl className="grid gap-px bg-white/10 sm:grid-cols-2">
              {[
                ["Subjects", contest.subjects.join(" · ")],
                ["Eligible years", contest.years.map((year) => `Year ${year}`).join(" · ")],
                ["Competition path", contest.format],
                ["Representation", contest.teams],
              ].map(([label, value]) => (
                <div key={label} className="bg-[#0b1d20] p-6">
                  <dt className="text-xs font-bold uppercase tracking-wider text-white/40">{label}</dt>
                  <dd className="mt-2 text-sm leading-relaxed text-white/80">{value}</dd>
                </div>
              ))}
            </dl>
            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-white/10 p-6 sm:px-8">
              <p className="flex items-center gap-2 text-sm text-white/50"><CalendarClock className="h-4 w-4" /> Launch date will be announced after institutional onboarding.</p>
              <div className="flex gap-4"><Link to={`/contests/${contest.slug}/register`} className="text-sm font-bold text-white/70 hover:text-white">Registration</Link><Link to={`/contests/${contest.slug}/lobby`} className="text-sm font-bold text-white/70 hover:text-white">Lobby</Link><Link to={`/contests/${contest.slug}/briefing`} className="text-sm font-bold text-teal-300 hover:text-teal-200">Open preview →</Link></div>
            </div>
          </article>

          <aside className="rounded-2xl border border-white/10 bg-white/[0.035] p-6">
            <div className="flex items-center gap-2"><Users className="h-5 w-5 text-amber-300" /><h2 className="font-bold">University table</h2></div>
            <p className="mt-2 text-sm text-white/45">{universities.length ? `${universities.length} institutions are listed for future onboarding.` : "The inaugural season starts with a clean record."}</p>
            <ol className="mt-6 space-y-3">
              {UNIVERSITY_LEADERS.map((team) => (
                <li key={team.position} className="flex items-center gap-3 rounded-xl border border-white/10 p-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/5 text-sm font-bold text-white/45">{team.position}</span>
                  <span className="min-w-0 flex-1 text-sm text-white/65">{team.name}</span>
                  <span className="text-sm font-bold text-teal-300">{team.points}</span>
                </li>
              ))}
            </ol>
          </aside>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-6 sm:p-8">
          <div className="flex items-center gap-3"><ShieldCheck className="h-6 w-6 text-teal-300" /><h2 className="font-serif text-2xl font-bold">Fair-play foundation</h2></div>
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {CONTEST_RULES.map((rule, index) => <p key={rule} className="flex gap-3 text-sm leading-relaxed text-white/60"><span className="text-teal-300">{String(index + 1).padStart(2, "0")}</span>{rule}</p>)}
          </div>
        </section>
      </main>
    </div>
  );
}
