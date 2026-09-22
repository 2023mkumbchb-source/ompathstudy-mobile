import { Helmet } from "react-helmet-async";
import { Link, Navigate } from "react-router-dom";
import { ChevronLeft, LayoutDashboard, Loader2 } from "lucide-react";
import NotificationAdmin from "@/components/NotificationAdmin";
import { useAuth } from "@/hooks/useAuth";

export default function AdminNotifications() {
  const { isAdmin, loading } = useAuth();

  if (loading) {
    return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }
  if (!isAdmin) return <Navigate to="/login" replace />;

  return (
    <div className="mx-auto max-w-5xl px-3 sm:px-6 py-4 sm:py-8">
      <Helmet>
        <title>Notification Studio | Admin | Ompath Study</title>
        <meta name="robots" content="noindex" />
      </Helmet>

      {/* Header & Back Link */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/admin"
          className="inline-flex items-center gap-1.5 border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          <span>Back to Dashboard</span>
        </Link>

        <Link
          to="/admin"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
        >
          <LayoutDashboard className="h-3.5 w-3.5" />
          <span>All Admin Tools</span>
        </Link>
      </div>

      <NotificationAdmin />
    </div>
  );
}
