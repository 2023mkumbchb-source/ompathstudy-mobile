import { CalendarPlus, Download } from "lucide-react";

type Props = { title: string; startsAt: string; endsAt?: string | null; details?: string; location?: string; className?: string };
const compactUtc = (value: string) => new Date(value).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const escapeIcs = (value: string) => value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");

export default function ContestCalendarActions({ title, startsAt, endsAt, details = "Open Ompath Study before the scheduled contest begins.", location = "https://www.ompathstudy.com/contests", className = "" }: Props) {
  const start = new Date(startsAt);
  const end = endsAt ? new Date(endsAt) : new Date(start.getTime() + 60 * 60 * 1000);
  const google = new URL("https://calendar.google.com/calendar/render");
  google.searchParams.set("action", "TEMPLATE"); google.searchParams.set("text", title); google.searchParams.set("dates", `${compactUtc(start.toISOString())}/${compactUtc(end.toISOString())}`); google.searchParams.set("details", details); google.searchParams.set("location", location);

  function downloadCalendar() {
    const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Ompath Study//Contest//EN", "BEGIN:VEVENT", `UID:${crypto.randomUUID()}@ompathstudy.com`, `DTSTAMP:${compactUtc(new Date().toISOString())}`, `DTSTART:${compactUtc(start.toISOString())}`, `DTEND:${compactUtc(end.toISOString())}`, `SUMMARY:${escapeIcs(title)}`, `DESCRIPTION:${escapeIcs(details)}`, `LOCATION:${escapeIcs(location)}`, "BEGIN:VALARM", "TRIGGER:-P1D", "ACTION:DISPLAY", "DESCRIPTION:Ompath Study contest starts tomorrow", "END:VALARM", "BEGIN:VALARM", "TRIGGER:-PT1H", "ACTION:DISPLAY", "DESCRIPTION:Ompath Study contest starts in one hour", "END:VALARM", "END:VEVENT", "END:VCALENDAR"].join("\r\n");
    const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = "ompath-study-contest.ics"; link.click(); URL.revokeObjectURL(url);
  }

  return <div className={`grid gap-2 sm:grid-cols-2 ${className}`}>
    <a href={google.toString()} target="_blank" rel="noreferrer" className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-teal-300 px-4 text-sm font-bold text-[#071315]"><CalendarPlus className="h-4 w-4" /> Add to Google Calendar</a>
    <button type="button" onClick={downloadCalendar} className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-teal-200/30 px-4 text-sm font-bold text-teal-200"><Download className="h-4 w-4" /> Other calendar</button>
  </div>;
}
