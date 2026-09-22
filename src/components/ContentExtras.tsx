import { useEffect, useMemo, useState } from "react";
import { Lock, Timer } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { sanitizeEmbed } from "@/components/PublishingSettings";

export interface ExtrasData {
  countdown?: { enabled: boolean; label?: string; start_datetime?: string; end_datetime?: string; target_datetime?: string; display_style: "banner" | "inline" | "floating" } | null;
  html_embed?: { position: "top" | "bottom" | "both"; code: string } | null;
  password_protected?: boolean;
  access_password?: string;
  toc_enabled?: boolean;
  reading_time_minutes?: number;
}

function useCountdown(start?: string, end?: string) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!start && !end) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [start, end]);
  const startMs = start ? new Date(start).getTime() : NaN;
  const endMs = end ? new Date(end).getTime() : NaN;
  const target = Number.isFinite(startMs) && now < startMs ? startMs : Number.isFinite(endMs) ? endMs : startMs;
  if (!Number.isFinite(target)) return null;
  const diff = Math.max(0, target - now);
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  const seconds = Math.floor((diff % 60_000) / 1000);
  const phase = Number.isFinite(startMs) && now < startMs ? "before" : Number.isFinite(endMs) && now <= endMs ? "active" : "ended";
  return { days, hours, minutes, seconds, phase, expired: phase === "ended" };
}

export function Countdown({ data }: { data: ExtrasData["countdown"] }) {
  const c = data;
  const start = c?.start_datetime || c?.target_datetime;
  const end = c?.end_datetime;
  const cd = useCountdown(start, end);
  if (!c?.enabled || !cd || cd.expired) return null;
  const style = c.display_style || "banner";
  const label = cd.phase === "before" ? (c.label || "Starts in") : "Ends in";
  const inner = (
    <span className="inline-flex items-center gap-2 text-sm font-semibold">
      <Timer className="h-4 w-4" />
      {label}: {cd.days}d {cd.hours}h {cd.minutes}m {cd.seconds}s
    </span>
  );
  if (style === "floating") {
    return (
      <div className="fixed bottom-4 left-4 z-40 rounded-full border border-border bg-primary px-4 py-2 text-primary-foreground shadow-sm">
        {inner}
      </div>
    );
  }
  if (style === "inline") {
    return <div className="my-4 border border-primary/30 bg-primary/10 px-4 py-3 text-primary">{inner}</div>;
  }
  return (
    <div className="-mx-4 mb-4 bg-primary px-4 py-3 text-center text-primary-foreground sm:mx-0 sm:border">
      {inner}
    </div>
  );
}

export function HtmlEmbed({ data, position }: { data: ExtrasData["html_embed"]; position: "top" | "bottom" }) {
  if (!data?.code) return null;
  const matches = data.position === "both" || data.position === position;
  if (!matches) return null;
  const safe = sanitizeEmbed(data.code);
  return <div className="my-4 not-prose" dangerouslySetInnerHTML={{ __html: safe }} />;
}

/** Wraps children behind a password input. Unlock persists per slug in localStorage. */
export function PasswordGate({
  enabled, password, storageKey, children,
}: { enabled?: boolean; password?: string; storageKey: string; children: React.ReactNode }) {
  const key = `pwgate_${storageKey}`;
  const [unlocked, setUnlocked] = useState(() => {
    if (!enabled) return true;
    try { return localStorage.getItem(key) === "1"; } catch { return false; }
  });
  const [input, setInput] = useState("");
  const [err, setErr] = useState("");

  if (!enabled || !password) return <>{children}</>;
  if (unlocked) return <>{children}</>;

  return (
    <div className="mx-auto my-10 max-w-sm border-y border-border bg-card p-6 text-center">
      <Lock className="mx-auto mb-3 h-8 w-8 text-primary" />
      <h2 className="mb-1 font-serif text-lg font-bold text-foreground">Password protected</h2>
      <p className="mb-4 text-sm text-muted-foreground">Enter the password your tutor shared to view this content.</p>
      <Input
        type="password"
        value={input}
        onChange={(e) => { setInput(e.target.value); setErr(""); }}
        placeholder="Password"
        className="mb-2"
      />
      {err && <p className="mb-2 text-xs text-destructive">{err}</p>}
      <Button
        className="w-full"
        onClick={() => {
          if (input === password) {
            try { localStorage.setItem(key, "1"); } catch {}
            setUnlocked(true);
          } else {
            setErr("Wrong password — try again.");
          }
        }}
      >Unlock</Button>
    </div>
  );
}

/** Generates an anchored TOC from markdown content. */
export function ContentToc({ content }: { content: string }) {
  const items = useMemo(() => {
    const out: { level: number; text: string; id: string }[] = [];
    for (const line of String(content || "").split(/\r?\n/)) {
      const m = line.match(/^(#{2,3})\s+(.+)$/);
      if (m) {
        const text = m[2].trim();
        const id = text.toLowerCase().replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 80);
        out.push({ level: m[1].length, text, id });
      }
    }
    return out;
  }, [content]);
  if (!items.length) return null;
  return (
    <nav aria-label="Table of contents" className="my-6 border border-border bg-muted/40 p-4">
      <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">On this page</p>
      <ul className="space-y-1 text-sm">
        {items.map((it, i) => (
          <li key={i} className={it.level === 3 ? "pl-4" : ""}>
            <a href={`#${it.id}`} className="text-primary hover:underline">{it.text}</a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function ReadingTimeBadge({ minutes }: { minutes?: number }) {
  if (!minutes || minutes < 1) return null;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      ~{minutes} min read
    </span>
  );
}