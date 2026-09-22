import "@/styles/workspace.css";
import { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { Link } from "react-router-dom";
import { Phone, Mail, MessageCircle, ExternalLink, GraduationCap, Code2, Stethoscope, Sparkles, ArrowRight, MapPin } from "lucide-react";
import { motion } from "framer-motion";
import portrait from "@/assets/abongo-davis-portrait.jpg";
import { updateMetaTags, SITE_URL } from "@/lib/seo";
import { useSiteSettings } from "@/lib/site-settings";
import { useAuth } from "@/hooks/useAuth";

const PROJECTS = [
  {
    name: "Ompath Study",
    domain: "ompathstudy.com",
    href: "https://www.ompathstudy.com",
    blurb: "Free medical study notes, MCQ banks, flashcards and past papers for MBChB students across East Africa.",
    tag: "Founder & Editor",
  },
  {
    name: "Kenya Adverts",
    domain: "kenyaadverts.com",
    href: "https://www.kenyaadverts.com",
    blurb: "A national listings platform connecting buyers, sellers and service providers across Kenya.",
    tag: "Founder",
  },
  {
    name: "Kenya Adverts (Kenya)",
    domain: "kenyaadverts.co.ke",
    href: "https://www.kenyaadverts.co.ke",
    blurb: "The official .co.ke arm — a marketplace plus a service for clients who want custom websites built.",
    tag: "Founder",
  },
];

export default function About() {
  const { founderPageVisible, aboutProfile, loading } = useSiteSettings();
  const { isAdmin } = useAuth();
  useEffect(() => {
    updateMetaTags({
      title: "Abongo Davis – Founder of Ompath Study | Medical Student & Web Developer",
      description:
        "Abongo Davis is a medical student, founder of Ompath Study and Kenya Adverts, and a self-taught web developer. Hire him to build modern, fast websites.",
      image: `${SITE_URL}/og-default.png`,
      url: `${SITE_URL}/about`,
      type: "website",
    });

    // Person schema for richer Google results
    const ld = document.createElement("script");
    ld.type = "application/ld+json";
    ld.id = "about-person-jsonld";
    ld.text = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Person",
      name: "Abongo Davis",
      url: `${SITE_URL}/about`,
      jobTitle: "Medical Student & Web Developer",
      email: "mailto:hydrosafecare@gmail.com",
      telephone: "+254115475543",
      sameAs: [
        "https://www.ompathstudy.com",
        "https://www.kenyaadverts.com",
        "https://www.kenyaadverts.co.ke",
      ],
      description:
        "Founder of Ompath Study and Kenya Adverts. Medical student passionate about medicine, technology and building websites.",
    });
    document.head.appendChild(ld);
    return () => { document.getElementById("about-person-jsonld")?.remove(); };
  }, []);

  if (loading) return null;
  if (!founderPageVisible && !isAdmin) return <Navigate to="/" replace />;
  const phoneHref = aboutProfile.phone.replace(/[^+\d]/g, "");
  const whatsappHref = aboutProfile.whatsapp.replace(/\D/g, "");

  return (
    <div className="min-h-dvh bg-muted/20">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border bg-primary/5">
        <div className="absolute inset-0 opacity-[0.06] pointer-events-none" aria-hidden>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,hsl(var(--primary))_0,transparent_45%)]" />
        </div>
        <div className="relative mx-auto grid max-w-6xl gap-10 px-5 py-12 sm:py-16 lg:grid-cols-[280px_1fr] lg:items-center lg:gap-14">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mx-auto"
          >
            <div className="relative">
              <div className="absolute -inset-3 rounded-md bg-primary/20 blur-2xl" aria-hidden />
              <div className="relative h-56 w-56 sm:h-64 sm:w-64 lg:h-72 lg:w-72 overflow-hidden rounded-md border-4 border-card shadow-sm ring-1 ring-primary/20">
                <img
                  src={portrait}
                  alt={`${aboutProfile.name} — Founder of Ompath Study`}
                  width={768}
                  height={960}
                  className="h-full w-full object-cover"
                />
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
              <Sparkles className="h-3 w-3" />
              Founder · Ompath Study
            </div>
            <h1 className="font-serif text-4xl font-bold leading-[1.05] tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              {aboutProfile.name}
            </h1>
            <p className="mt-3 text-base sm:text-lg text-muted-foreground">
              {aboutProfile.headline}
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><GraduationCap className="h-4 w-4 text-primary" /> Medical student</span>
              <span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4 text-primary" /> {aboutProfile.location}</span>
            </div>

            <div className="mt-7 flex flex-wrap gap-3">
              <a href={`https://wa.me/${whatsappHref}`} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-bold text-primary-foreground shadow-sm shadow-primary/20 transition hover:opacity-90">
                <MessageCircle className="h-4 w-4" /> WhatsApp Me
              </a>
              <a href={`mailto:${aboutProfile.email}`}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-6 py-3 text-sm font-bold text-foreground hover:border-primary hover:text-primary transition">
                <Mail className="h-4 w-4" /> Email
              </a>
              <a href={`tel:${phoneHref}`}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-6 py-3 text-sm font-bold text-foreground hover:border-primary hover:text-primary transition">
                <Phone className="h-4 w-4" /> {aboutProfile.phone}
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Bio + values */}
      <section className="mx-auto max-w-4xl px-5 py-14">
        <div className="prose prose-lg max-w-none text-foreground/90">
          <h2 className="font-serif text-2xl sm:text-3xl font-bold text-foreground">About me</h2>
          <p className="text-base sm:text-lg leading-relaxed text-muted-foreground">
            {aboutProfile.bio}
          </p>
          <p className="text-base sm:text-lg leading-relaxed text-muted-foreground">
            Outside the wards I'm a self-taught web developer. I design and ship modern, fast, SEO-friendly websites for businesses,
            startups and creators — most recently <strong className="text-foreground">Kenya Adverts</strong>, a national listings
            and services marketplace. If you have an idea you'd like turned into a real product, I'm available for client work.
          </p>
          <p className="text-base sm:text-lg leading-relaxed text-muted-foreground">
            I'm based in Kenya. The fastest way to reach me is WhatsApp on
            {" "}<a href="https://wa.me/254115475543" className="text-primary font-semibold">+254 115 475 543</a>{" "}
            or email at <a href="mailto:hydrosafecare@gmail.com" className="text-primary font-semibold">hydrosafecare@gmail.com</a>.
          </p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {[
            { icon: Stethoscope, title: "Medicine", body: "MBChB student passionate about clinical reasoning, pathology and evidence-based practice." },
            { icon: Code2, title: "Web Development", body: "I design and build modern, fast, SEO-friendly websites for businesses and creators." },
            { icon: Sparkles, title: "Building", body: "I love turning ideas into shipped products — listings, learning tools, marketplaces." },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title} className="border-y border-border bg-card p-5">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="font-serif text-lg font-bold text-foreground">{title}</h3>
              <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Projects */}
      <section className="border-y border-border bg-card/40">
        <div className="mx-auto max-w-5xl px-5 py-14">
          <div className="mb-8">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">Projects I founded</p>
            <h2 className="font-serif text-3xl sm:text-4xl font-bold text-foreground">Things I've built</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {PROJECTS.map((p) => (
              <a key={p.domain} href={p.href} target="_blank" rel="noopener noreferrer"
                className="group flex h-full flex-col border-y border-border bg-background p-6 transition-colors hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-sm">
                <div className="mb-2 inline-flex w-fit rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                  {p.tag}
                </div>
                <h3 className="font-serif text-xl font-bold text-foreground">{p.name}</h3>
                <p className="text-xs font-mono text-muted-foreground">{p.domain}</p>
                <p className="mt-3 text-sm text-muted-foreground leading-relaxed flex-1">{p.blurb}</p>
                <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary group-hover:gap-2.5 transition-colors">
                  Visit <ExternalLink className="h-3.5 w-3.5" />
                </span>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Hire / contact */}
      <section className="mx-auto max-w-4xl px-5 py-16 text-center">
        <h2 className="font-serif text-3xl sm:text-4xl font-bold text-foreground">Need a website built?</h2>
        <p className="mx-auto mt-3 max-w-2xl text-base sm:text-lg text-muted-foreground leading-relaxed">
          I take on a small number of client projects each month — modern, fast, SEO-friendly websites for businesses,
          creators and startups. If you've got an idea, let's talk.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <a href="https://wa.me/254115475543?text=Hi%20Abongo%2C%20I%27d%20like%20a%20website%20built." target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3 text-sm font-bold text-primary-foreground shadow-sm shadow-primary/20 transition hover:opacity-90">
            <MessageCircle className="h-4 w-4" /> Start a Project
          </a>
          <Link to="/" className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-7 py-3 text-sm font-bold text-foreground hover:border-primary hover:text-primary transition">
            Explore Ompath Study <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
