import { BookOpen } from "lucide-react";
import { useTopicThumbnail } from "@/lib/topicThumbnail";

/**
 * Quiet unit tile. Instead of a coloured gradient block it uses a real topic
 * photograph sourced from Wikipedia (free, no generation) with a neutral
 * placeholder while it resolves, plus a plain label slab underneath.
 */
export default function UnitTile({
  title,
  count,
  active,
  onClick,
  hint,
}: {
  title: string;
  count?: number;
  active?: boolean;
  onClick: () => void;
  hint?: string;
}) {
  const cover = useTopicThumbnail(title, undefined, true, title);
  return (
    <button
      onClick={onClick}
      className={`group flex h-full min-w-0 w-full flex-col overflow-hidden border bg-card text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/50 hover:bg-muted/40 ${
        active ? "border-primary ring-2 ring-primary/20" : "border-border"
      }`}
    >
      <span className="relative block aspect-[16/9] w-full shrink-0 overflow-hidden bg-muted">
        {cover ? (
          <img
            src={cover}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover grayscale-[35%] transition-transform duration-500 group-hover:scale-[1.04] group-hover:grayscale-0"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-muted-foreground/50">
            <BookOpen className="h-5 w-5" />
          </span>
        )}
      </span>
      <span className="flex min-h-[4.5rem] flex-1 flex-col px-3.5 py-3">
        <span className="line-clamp-2 text-[13px] font-semibold leading-snug text-foreground transition-colors group-hover:text-primary sm:text-sm">
          {title}
        </span>
        <span className="mt-auto block pt-1.5 text-[11px] text-muted-foreground">
          {hint ?? (count != null ? `${count} ${count === 1 ? "note" : "notes"}` : "")}
        </span>
      </span>
    </button>
  );
}
