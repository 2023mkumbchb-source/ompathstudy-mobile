import { useRef, useState, useEffect } from "react";
import { getCategoryDisplayName } from "@/lib/store";
import { SlidersHorizontal, X, Check, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface CategoryTabsProps {
  categories: string[];
  counts?: Record<string, number>;
  totalCount: number;
  selected: string | null;
  onChange: (cat: string | null) => void;
}

export default function CategoryTabs({
  categories,
  counts,
  totalCount,
  selected,
  onChange,
}: CategoryTabsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeftFade, setShowLeftFade] = useState(false);
  const [showRightFade, setShowRightFade] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const unique = [...new Set(categories)].sort((a, b) =>
    getCategoryDisplayName(a).localeCompare(getCategoryDisplayName(b))
  );

  const checkFades = () => {
    const el = scrollRef.current;
    if (!el) return;
    setShowLeftFade(el.scrollLeft > 8);
    setShowRightFade(el.scrollLeft + el.clientWidth < el.scrollWidth - 8);
  };

  useEffect(() => {
    checkFades();
    const el = scrollRef.current;
    el?.addEventListener("scroll", checkFades, { passive: true });
    window.addEventListener("resize", checkFades);
    return () => {
      el?.removeEventListener("scroll", checkFades);
      window.removeEventListener("resize", checkFades);
    };
  }, [unique.length]);

  useEffect(() => {
    if (!selected) return;
    const el = scrollRef.current;
    if (!el) return;
    const btn = el.querySelector(`[data-cat="${selected}"]`) as HTMLElement | null;
    btn?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [selected]);

  useEffect(() => {
    if (!mobileOpen) return;
    const handler = (e: MouseEvent) => {
      if (!dropdownRef.current?.contains(e.target as Node)) {
        setMobileOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [mobileOpen]);

  if (unique.length === 0) return null;

  const selectedLabel = selected ? getCategoryDisplayName(selected) : null;

  return (
    <div className="mb-7">

      {/* ── MOBILE only: Filter button + dropdown ── */}
      <div className="relative sm:hidden" ref={dropdownRef}>
        <button
          onClick={() => setMobileOpen((o) => !o)}
          className={`flex items-center gap-2 border px-4 py-2.5 text-sm font-medium transition-colors shadow-sm ${
            selected
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-card text-foreground"
          }`}
        >
          <SlidersHorizontal className="h-4 w-4 shrink-0" />
          <span className="flex-1 text-left">
            {selectedLabel ?? "All categories"}
          </span>
          {selected ? (
            <span
              onClick={(e) => { e.stopPropagation(); onChange(null); setMobileOpen(false); }}
              className="flex h-5 w-5 items-center justify-center rounded-full bg-white/25 hover:bg-white/40 transition-colors"
            >
              <X className="h-3 w-3" />
            </span>
          ) : (
            <ChevronDown className={`h-4 w-4 transition-transform ${mobileOpen ? "rotate-180" : ""}`} />
          )}
        </button>

        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.96 }}
              transition={{ duration: 0.14, ease: "easeOut" }}
              className="absolute left-0 right-0 z-50 mt-2 border-y border-border bg-card shadow-sm overflow-hidden"
            >
              {/* All */}
              <button
                onClick={() => { onChange(null); setMobileOpen(false); }}
                className={`flex w-full items-center justify-between px-4 py-3.5 text-sm transition-colors ${
                  !selected
                    ? "bg-primary/5 font-semibold text-primary"
                    : "text-foreground hover:bg-muted/40"
                }`}
              >
                <span>All categories</span>
                <span className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{totalCount}</span>
                  {!selected && <Check className="h-4 w-4 text-primary" />}
                </span>
              </button>

              <div className="mx-4 border-t border-border" />

              <div className="max-h-72 overflow-y-auto py-1">
                {unique.map((cat, i) => {
                  const label = getCategoryDisplayName(cat);
                  const count = counts?.[cat];
                  const isActive = selected === cat;
                  return (
                    <motion.button
                      key={cat}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.03 }}
                      onClick={() => { onChange(isActive ? null : cat); setMobileOpen(false); }}
                      className={`flex w-full items-center justify-between px-4 py-3 text-sm transition-colors ${
                        isActive
                          ? "bg-primary/5 font-semibold text-primary"
                          : "text-foreground hover:bg-muted/40"
                      }`}
                    >
                      <span>{label}</span>
                      <span className="flex items-center gap-2">
                        {count !== undefined && (
                          <span className={`text-xs ${isActive ? "text-primary/60" : "text-muted-foreground"}`}>
                            {count}
                          </span>
                        )}
                        {isActive && <Check className="h-4 w-4 text-primary" />}
                      </span>
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── DESKTOP only: Scrollable pill strip ── */}
      <div className="relative hidden sm:block">
        {showLeftFade && (
          <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-10 z-10 bg-gradient-to-r from-background to-transparent" />
        )}
        {showRightFade && (
          <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-10 z-10 bg-gradient-to-l from-background to-transparent" />
        )}
        <div
          ref={scrollRef}
          className="flex gap-2 overflow-x-auto pb-0.5"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          <button
            onClick={() => onChange(null)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors whitespace-nowrap ${
              !selected
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            All
            {counts && (
              <span className={`ml-1.5 text-xs ${!selected ? "opacity-80" : "opacity-50"}`}>
                {totalCount}
              </span>
            )}
          </button>

          {unique.map((cat) => {
            const label = getCategoryDisplayName(cat);
            const count = counts?.[cat];
            const isActive = selected === cat;
            return (
              <button
                key={cat}
                data-cat={cat}
                onClick={() => onChange(isActive ? null : cat)}
                className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
                {count !== undefined && (
                  <span className={`ml-1.5 text-xs ${isActive ? "opacity-80" : "opacity-50"}`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
