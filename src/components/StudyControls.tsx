import { useEffect, useState } from "react";
import { Bookmark, BookmarkCheck, CalendarPlus, Check, Flag, MoreHorizontal, TriangleAlert, Printer } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { getBookmarks, getProgress, setProgress, toggleBookmark, logActivity } from "@/lib/study";
import type { ResourceType } from "@/lib/academic";
import ReportIssueDialog from "./ReportIssueDialog";

interface Props {
  resourceType: ResourceType;
  resourceId: string;
  title: string;
  compact?: boolean;
}

export default function StudyControls({ resourceType, resourceId, title, compact }: Props) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [saved, setSaved] = useState(false);
  const [status, setStatus] = useState<string>("in_progress");
  const [reportOpen, setReportOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [bookmarks, progress] = await Promise.all([getBookmarks(userId), getProgress(userId)]);
      if (!alive) return;
      setSaved(bookmarks.some((b) => b.resource_type === resourceType && b.resource_id === resourceId));
      const p = progress.find((x) => x.resource_type === resourceType && x.resource_id === resourceId);
      if (p) {
        setStatus(p.status);
      } else {
        // First time this resource has ever been opened — start tracking it.
        // Deliberately does NOT run when a progress row already exists, so
        // re-opening an article you already marked completed/difficult/revisit
        // (e.g. to revise it again) never silently resets that status back to
        // "in progress".
        setStatus("in_progress");
        void setProgress(userId, resourceType, resourceId, { status: "in_progress" });
      }
      void logActivity(userId, "open", { resource_type: resourceType, resource_id: resourceId });
    })();
    return () => { alive = false; };
  }, [userId, resourceType, resourceId]);

  const onSave = async () => {
    const next = !saved;
    setSaved(next);
    try {
      await toggleBookmark(userId, resourceType, resourceId, next);
      toast({ description: next ? "Saved to your library" : "Removed from saved" });
    } catch {
      setSaved(!next);
      toast({ description: "Could not update your saved items. Please try again.", variant: "destructive" });
    }
  };

  const mark = async (next: "completed" | "difficult" | "revisit") => {
    const previous = status;
    setStatus(next);
    try {
      await setProgress(userId, resourceType, resourceId, { status: next, progress_percent: next === "completed" ? 100 : undefined });
      await logActivity(userId, next, { resource_type: resourceType, resource_id: resourceId });
      toast({
        description:
          next === "completed" ? "Marked as studied" : next === "difficult" ? "Marked as difficult — it will show in My Revision" : "Added to continue later",
      });
    } catch {
      setStatus(previous);
      toast({ description: "Could not save your progress. Please try again.", variant: "destructive" });
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant={saved ? "default" : "outline"}
          size="sm"
          onClick={onSave}
          aria-pressed={saved}
          aria-label={saved ? `Remove ${title} from saved` : `Save ${title}`}
          className="min-h-[40px]"
        >
          {saved ? <BookmarkCheck className="mr-1.5 h-4 w-4" /> : <Bookmark className="mr-1.5 h-4 w-4" />}
          {saved ? "Saved" : "Save"}
        </Button>

        <Button
          type="button"
          variant={status === "completed" ? "default" : "outline"}
          size="sm"
          onClick={() => mark("completed")}
          aria-pressed={status === "completed"}
          className="min-h-[40px]"
        >
          <Check className="mr-1.5 h-4 w-4" />
          {status === "completed" ? "Studied" : "Mark as studied"}
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => window.print()}
          aria-label="Export or print as PDF"
          className="min-h-[40px] text-xs font-semibold gap-1.5"
        >
          <Printer className="h-4 w-4 text-muted-foreground" />
          <span>Save PDF</span>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" size="sm" className="min-h-[40px]" aria-label="More study actions">
              <MoreHorizontal className="h-4 w-4" />
              {!compact && <span className="ml-1.5">More</span>}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onClick={() => mark("difficult")}>
              <TriangleAlert className="mr-2 h-4 w-4" /> Mark as difficult
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => mark("revisit")}>
              <CalendarPlus className="mr-2 h-4 w-4" /> Continue later
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <a href="/revision-planner">
                <CalendarPlus className="mr-2 h-4 w-4" /> Add to revision plan
              </a>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setReportOpen(true)}>
              <Flag className="mr-2 h-4 w-4" /> Report a problem
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ReportIssueDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        resourceType={resourceType}
        resourceId={resourceId}
      />
    </>
  );
}
