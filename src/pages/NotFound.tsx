import "@/styles/workspace.css";
import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { ArrowLeft, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Helmet } from "react-helmet-async";

export default function NotFound() {
  const location = useLocation();
  const ogUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}${location.pathname}${location.search}`
      : location.pathname;
  const title = "Page Not Found | OmpathStudy Kenya";
  const description =
    "We couldn’t find that page on OmpathStudy. Browse notes, flashcards, MCQs, exams and stories for Kenyan medical and health students.";
  const keywords =
    "OmpathStudy, 404, page not found, medical education Kenya, study notes, flashcards, MCQs, exams";

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-5">
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={description} />
        <meta name="keywords" content={keywords} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={ogUrl} />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <div className="text-center max-w-md">
        <div className="mb-6 inline-flex h-20 w-20 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Search className="h-10 w-10" />
        </div>
        <h1 className="mb-2 font-serif text-4xl font-bold text-foreground">404</h1>
        <p className="mb-6 text-muted-foreground leading-relaxed">
          The page you're looking for doesn't exist or may have been moved.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button asChild>
            <Link to="/"><ArrowLeft className="mr-2 h-4 w-4" /> Home</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/blog">Browse Articles</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/stories">Read Stories</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
