import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  BookOpen,
  GraduationCap,
  Home,
  LayoutDashboard,
  Menu,
  Trophy,
  ChevronRight,
  UserRound,
  Target,
  Database,
  ListChecks,
  Clock,
  Info,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import ThemeToggle from "./ThemeToggle";
import HeaderSearch from "./HeaderSearch";
import ompathLogo from "@/assets/ompath-logo.webp";
import { useAuth } from "@/hooks/useAuth";

const YEAR_OPTIONS = [1, 2, 3, 4, 5, 6] as const;
const STORAGE_KEY = "nav_year_filter";

const YEAR_SECTIONS = [
  { label: "Blog", path: "blog", icon: BookOpen },
  { label: "Flashcards", path: "flashcards", icon: GraduationCap },
  { label: "Exams", path: "exams", icon: Trophy },
];

function getActiveYear(pathname: string, search: string): number | null {
  const yearRoute = pathname.match(/^\/year\/(\d)$/);
  if (yearRoute) return Number(yearRoute[1]);
  const qp = new URLSearchParams(search).get("year");
  if (qp) {
    const m = qp.match(/Year\s(\d)/);
    if (m) return Number(m[1]);
  }
  const stored = sessionStorage.getItem(STORAGE_KEY);
  if (stored && stored !== "All") {
    const m = stored.match(/Year\s(\d)/);
    if (m) return Number(m[1]);
  }
  return null;
}

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedYear, setExpandedYear] = useState<number | null>(null);
  const [hidden, setHidden] = useState(false);

  // Desktop horizontal links
  const links = useMemo(() => {
    const base = [
      { to: "/", label: "Home", icon: Home },
      { to: "/my-revision", label: "My Revision", icon: Target },
      { to: "/revision-index", label: "Exam Revision", icon: ListChecks },
      { to: "/contests", label: "Mega Contest", icon: Trophy },
      { to: "/account", label: "Account", icon: UserRound },
    ];
    if (isAdmin) {
      base.push({ to: "/admin", label: "Dashboard", icon: LayoutDashboard });
      base.push({ to: "/admin/study-system", label: "Study System", icon: Database });
      base.push({ to: "/admin/contests", label: "Contest Admin", icon: Trophy });
    }
    return base;
  }, [isAdmin]);

  // Mobile drawer links: exclude Home & Account (already in bottom nav!) and focus on study tools
  const mobileDrawerLinks = useMemo(() => {
    const base = [
      { to: "/revision-index", label: "Exam Revision Bank", icon: ListChecks },
      { to: "/my-revision", label: "My Revision Planner", icon: Target },
      { to: "/exams", label: "Timed Weekly Exams", icon: Clock },
      { to: "/contests", label: "Mega Contests", icon: Trophy },
      { to: "/stories", label: "Medical Stories", icon: BookOpen },
      { to: "/about", label: "About & Medical Sources", icon: Info },
    ];
    if (isAdmin) {
      base.push({ to: "/admin", label: "Admin Dashboard", icon: LayoutDashboard });
      base.push({ to: "/admin/study-system", label: "Study System", icon: Database });
      base.push({ to: "/admin/contests", label: "Contest Admin", icon: Trophy });
    }
    return base;
  }, [isAdmin]);

  const isExamPage = /^\/exams\/[^/]+\/start/.test(location.pathname);

  const activeYear = useMemo(
    () => getActiveYear(location.pathname, location.search),
    [location.pathname, location.search]
  );

  useEffect(() => {
    if (activeYear) setExpandedYear(activeYear);
  }, [activeYear]);

  useEffect(() => {
    if (activeYear) {
      sessionStorage.setItem(STORAGE_KEY, `Year ${activeYear}`);
    }
  }, [activeYear]);

  useEffect(() => {
    let lastY = Math.max(0, window.scrollY);
    let direction: "up" | "down" | null = null;
    let distance = 0;
    let ticking = false;

    const updateHeader = () => {
      const nextY = Math.max(0, window.scrollY);
      const delta = nextY - lastY;
      const nextDirection = delta > 0 ? "down" : delta < 0 ? "up" : direction;

      if (nextY <= 32 || sidebarOpen) {
        setHidden(false);
        distance = 0;
      } else if (nextDirection) {
        if (nextDirection !== direction) distance = 0;
        direction = nextDirection;
        distance += Math.abs(delta);

        // Accumulate small touch/trackpad movements instead of requiring one
        // unusually large scroll frame. This also filters out mobile jitter.
        if (distance >= 12) {
          setHidden(direction === "down");
          distance = 0;
        }
      }

      lastY = nextY;
      ticking = false;
    };

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(updateHeader);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [sidebarOpen]);

  const selectYear = (yr: number | null) => {
    if (!yr) {
      sessionStorage.setItem(STORAGE_KEY, "All");
      navigate("/");
    } else {
      sessionStorage.setItem(STORAGE_KEY, `Year ${yr}`);
      navigate(`/year/${yr}`);
    }
  };

  const activeSection = useMemo(() => {
    for (const s of YEAR_SECTIONS) {
      if (location.pathname.startsWith(`/${s.path}`)) return s.path;
    }
    if (location.pathname.match(/^\/blog\//)) return "blog";
    return null;
  }, [location.pathname]);

  const isActive = (to: string) => location.pathname === to || location.pathname.startsWith(`${to}/`);

  if (isExamPage) return null;

  return (
    <>
      <nav className={`sticky top-0 z-40 border-b border-border bg-[hsl(174,62%,22%)] text-white transition-transform duration-200 ease-out will-change-transform ${hidden ? "-translate-y-full" : "translate-y-0"}`}>
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-2.5 sm:px-6">
          <Link to="/" className="flex items-center gap-2 text-lg font-bold text-white">
            <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-md bg-white/10 p-1">
              <img src={ompathLogo} alt="Ompath Study logo" width="32" height="32" className="h-full w-full object-contain" decoding="async" fetchPriority="high" />
            </div>
            <span className="font-serif">Ompath Study</span>
          </Link>

          <div className="hidden items-center gap-1 md:flex">
            <div className="mr-2 flex items-center gap-0.5 rounded-lg bg-white/10 p-0.5">
              {YEAR_OPTIONS.map((yr) => (
                <button
                  key={yr}
                  onClick={() => selectYear(activeYear === yr ? null : yr)}
                  className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-all ${
                    activeYear === yr
                      ? "bg-white text-[hsl(174,62%,22%)] shadow-sm"
                      : "text-white/70 hover:text-white hover:bg-white/10"
                  }`}
                >
                  Y{yr}
                </button>
              ))}
            </div>

            <HeaderSearch variant="desktop" />

            {links.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  isActive(l.to) ? "bg-white/20" : "text-white/70 hover:text-white hover:bg-white/10"
                }`}
              >
                {l.label}
              </Link>
            ))}
            <ThemeToggle />
          </div>

          <div className="flex items-center gap-1.5 md:hidden">
            <ThemeToggle />
            <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
              <SheetTrigger asChild>
                <button className="p-1 text-white" aria-label="Open menu">
                  <Menu className="h-5 w-5" />
                </button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 bg-[hsl(174,62%,16%)] border-r-0 p-0 text-white [&>button]:text-white">
                <div className="flex items-center justify-between border-b border-white/10 px-4 py-4">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-md bg-white/10 p-1">
                      <img src={ompathLogo} alt="Ompath Study logo" width="32" height="32" className="h-full w-full object-contain" decoding="async" />
                    </div>
                    <div>
                      <span className="font-serif text-lg font-bold block leading-tight">Ompath Study</span>
                      <span className="text-[10px] text-white/60">Medical Study App</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col overflow-y-auto h-[calc(100%-65px)]">
                  <div className="border-b border-white/10 px-3 py-3">
                    <HeaderSearch variant="mobile" onNavigate={() => setSidebarOpen(false)} />
                  </div>

                  {/* Deep Study Hubs (No Home/Account duplicate!) */}
                  <div className="border-b border-white/10 px-3 py-3">
                    <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-wider text-white/40">Study Hubs</p>
                    {mobileDrawerLinks.map((l) => (
                      <Link
                        key={l.to}
                        to={l.to}
                        onClick={() => setSidebarOpen(false)}
                        className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                          isActive(l.to)
                            ? "bg-white/15 text-white"
                            : "text-white/70 hover:text-white hover:bg-white/10"
                        }`}
                      >
                        <l.icon className="h-4 w-4" />
                        {l.label}
                      </Link>
                    ))}
                  </div>

                  <div className="px-3 py-3">
                    <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-wider text-white/40">Academic Years</p>
                    {YEAR_OPTIONS.map((yr) => {
                      const isExpanded = expandedYear === yr;
                      const isYearActive = activeYear === yr;
                      return (
                        <div key={yr} className="mb-1">
                          <button
                            onClick={() => {
                              if (isExpanded) {
                                setExpandedYear(null);
                              } else {
                                setExpandedYear(yr);
                                selectYear(yr);
                              }
                            }}
                            className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${
                              isYearActive
                                ? "bg-white/15 text-white"
                                : "text-white/70 hover:text-white hover:bg-white/10"
                            }`}
                          >
                            <span>Year {yr}</span>
                            <ChevronRight
                              className={`h-4 w-4 transition-transform duration-200 ${
                                isExpanded ? "rotate-90" : ""
                              }`}
                            />
                          </button>

                          {isExpanded && (
                              <div className="overflow-hidden">
                                <div className="ml-3 border-l border-white/10 pl-3 py-1">
                                  {YEAR_SECTIONS.map((s) => {
                                    const to = `/${s.path}?year=${encodeURIComponent(`Year ${yr}`)}`;
                                    const active = activeSection === s.path && activeYear === yr;
                                    return (
                                      <Link
                                        key={s.path}
                                        to={to}
                                        onClick={() => setSidebarOpen(false)}
                                        className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] font-medium transition-colors ${
                                          active
                                            ? "bg-white/15 text-white"
                                            : "text-white/60 hover:text-white hover:bg-white/10"
                                        }`}
                                      >
                                        <s.icon className="h-3.5 w-3.5" />
                                        {s.label}
                                      </Link>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>

        {activeYear && (
            <div className="hidden md:block overflow-hidden border-t border-white/10 bg-[hsl(174,62%,18%)]">
              <div className="no-scrollbar mx-auto flex max-w-6xl items-center gap-1 overflow-x-auto px-4 py-1.5 sm:px-6" style={{ scrollbarWidth: "none" }}>
                <span className="mr-2 shrink-0 text-xs font-bold text-white/50">Year {activeYear}</span>
                {YEAR_SECTIONS.map((s) => {
                  const to = `/${s.path}?year=${encodeURIComponent(`Year ${activeYear}`)}`;
                  const active = activeSection === s.path;
                  return (
                    <Link
                      key={s.path}
                      to={to}
                      className={`flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                        active
                          ? "bg-white/20 text-white"
                          : "text-white/60 hover:text-white hover:bg-white/10"
                      }`}
                    >
                      <s.icon className="h-3.5 w-3.5" />
                      {s.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
      </nav>
    </>
  );
}
