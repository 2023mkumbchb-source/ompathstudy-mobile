import { useState, useEffect, useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { BookOpen, Phone, MessageCircle, Download, Mail, Heart } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useSiteSettings } from "@/lib/site-settings";

const studyLinks = [
  { to: "/year/1", label: "Year 1" },
  { to: "/year/2", label: "Year 2" },
  { to: "/year/3", label: "Year 3" },
  { to: "/year/4", label: "Year 4" },
  { to: "/year/5", label: "Year 5" },
  { to: "/year/6", label: "Year 6" },
];

export default function SiteFooter() {
  const location = useLocation();
  const { isAdmin } = useAuth();
  const { founderPageVisible } = useSiteSettings();

  const exploreLinks = useMemo(() => {
    const base = [
      { to: "/", label: "Home" },
      { to: "/stories", label: "Stories" },
      { to: "/exams", label: "Weekly Exams" },
    ];
    if (founderPageVisible || isAdmin) base.push({ to: "/about", label: "About the Founder" });
    if (isAdmin) {
      base.push({ to: "/admin", label: "Dashboard" });
    }
    return base;
  }, [isAdmin, founderPageVisible]);

  if (/^\/exams\/[^/]+\/start/.test(location.pathname)) return null;

  return (
    <footer className="mt-16 min-h-[380px] border-t border-border bg-gradient-to-b from-card/40 to-card/80">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-1">
            <Link to="/" className="flex items-center gap-2 text-base font-semibold text-foreground">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
                <BookOpen className="h-5 w-5" />
              </span>
              <span className="font-serif text-lg">Ompath Study</span>
            </Link>
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
              Concise, evidence-based study notes and MCQs for medical students — Years 1 through 6.
            </p>
            <div className="mt-4 flex items-center gap-2">
              <a href="tel:+254115475543" className="flex h-9 w-9 items-center justify-center border border-border text-muted-foreground hover:text-primary hover:border-primary transition-colors" aria-label="Call us">
                <Phone className="h-4 w-4" />
              </a>
              <a href="https://wa.me/254115475543" target="_blank" rel="noopener noreferrer" className="flex h-9 w-9 items-center justify-center border border-border text-muted-foreground hover:text-primary hover:border-primary transition-colors" aria-label="WhatsApp">
                <MessageCircle className="h-4 w-4" />
              </a>
              <a href="mailto:hello@ompathstudy.com" className="flex h-9 w-9 items-center justify-center border border-border text-muted-foreground hover:text-primary hover:border-primary transition-colors" aria-label="Email us">
                <Mail className="h-4 w-4" />
              </a>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">Study Notes</h3>
            <ul className="mt-4 space-y-2 text-sm">
              {studyLinks.map((l) => (
                <li key={l.to}>
                  <Link to={l.to} className="text-muted-foreground hover:text-primary transition-colors">{l.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">Explore</h3>
            <ul className="mt-4 space-y-2 text-sm">
              {exploreLinks.map((l) => (
                <li key={l.to}>
                  <Link to={l.to} className="text-muted-foreground hover:text-primary transition-colors">{l.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">Get the App</h3>
            <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
              Install Ompath Study for offline reading and a faster experience.
            </p>
            <div className="mt-3"><InstallAppButton /></div>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} Ompath Study. All rights reserved.</p>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            Made with <Heart className="h-3 w-3 fill-primary text-primary" /> for medical students
          </p>
        </div>
      </div>
    </footer>
  );
}

function InstallAppButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      setDeferredPrompt(null);
    }
  };

  return (
    <button
      onClick={handleInstall}
      className="inline-flex items-center gap-1.5 border border-border bg-background px-3 py-2 text-xs font-medium text-foreground hover:border-primary hover:text-primary transition-colors"
      aria-label="Install app"
    >
      <Download className="h-3.5 w-3.5" />
      Install App
    </button>
  );
}
