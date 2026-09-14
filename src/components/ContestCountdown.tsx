import { useEffect, useMemo, useState } from "react";

export default function ContestCountdown({ startsAt, className = "" }: { startsAt: string; className?: string }) {
  const target = useMemo(() => new Date(startsAt).getTime(), [startsAt]);
  const [remaining, setRemaining] = useState(() => Math.max(0, target - Date.now()));
  useEffect(() => {
    const tick = () => setRemaining(Math.max(0, target - Date.now()));
    tick(); const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [target]);
  const total = Math.floor(remaining / 1000);
  const units: [number, string][] = [[Math.floor(total / 86400), "days"], [Math.floor((total % 86400) / 3600), "hours"], [Math.floor((total % 3600) / 60), "minutes"], [total % 60, "seconds"]];
  const scheduled = new Intl.DateTimeFormat("en-KE", { dateStyle: "full", timeStyle: "short", timeZone: "Africa/Nairobi" }).format(new Date(startsAt));
  return <div className={className}>
    {remaining > 0 ? <><p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-300">Contest starts in</p><div className="mt-3 grid grid-cols-4 gap-1.5 sm:gap-2">{units.map(([value, label]) => <div key={label} className="min-w-0 rounded-lg border border-white/10 bg-black/15 px-1 py-3 text-center sm:px-2"><p className="text-lg font-black tabular-nums text-white sm:text-xl">{String(value).padStart(2, "0")}</p><p className="mt-1 truncate text-[8px] uppercase tracking-tight text-white/40 sm:text-[10px]">{label}</p></div>)}</div></> : <p className="font-bold text-amber-200">Scheduled start reached — waiting for the moderator to open the round.</p>}
    <p className="mt-3 text-xs text-white/55">{scheduled} (East Africa Time)</p>
  </div>;
}
