import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const SITE = "https://www.ompathstudy.com";

const PRIVATE_PREFIXES = [
  "/admin",
  "/account",
  "/notifications",
  "/my-revision",
  "/revision-planner",
  "/source-library",
  "/submit-story",
  "/contests/",
];

const PUBLIC_META: Record<string, { title: string; description: string }> = {
  "/": {
    title: "OmpathStudy | Medical Notes, MCQs, Flashcards & Exams",
    description: "Free medical notes, MCQs, flashcards and timed exams for MBChB, clinical medicine, nursing and health students in Kenya, Africa and worldwide.",
  },
  "/blog": {
    title: "Medical Blog | OmpathStudy",
    description: "Medical study articles, revision notes and educational resources for students in Kenya and Africa.",
  },
  "/mcqs": {
    title: "Medical MCQs & Question Banks | OmpathStudy",
    description: "Practice medical multiple-choice questions and question banks across anatomy, physiology, pathology, pharmacology and other medical subjects.",
  },
  "/exams": {
    title: "Medical Exams & Past Papers | OmpathStudy",
    description: "Practice timed medical exams, past papers and revision questions for medical students.",
  },
  "/flashcards": {
    title: "Medical Flashcards | OmpathStudy",
    description: "Study medical flashcards for MBChB and health sciences with focused revision resources.",
  },
  "/essays": {
    title: "Medical Essays | OmpathStudy",
    description: "Medical essay questions and study resources for MBChB and health sciences students.",
  },
  "/stories": {
    title: "Medical Student Stories | OmpathStudy",
    description: "Stories, experiences and contributions from medical and health sciences students.",
  },
  "/about": {
    title: "About OmpathStudy",
    description: "Learn about OmpathStudy and its medical study resources for students in Kenya, Africa and worldwide.",
  },
  "/updates": {
    title: "OmpathStudy Updates",
    description: "Latest OmpathStudy platform updates and new features.",
  },
};

function isPrivatePath(pathname: string) {
  return PRIVATE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix));
}

function upsertMeta(name: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("name", name);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function upsertCanonical(href: string) {
  let link = document.head.querySelector<HTMLLinkElement>("link[rel=\"canonical\"]");
  if (!link) {
    link = document.createElement("link");
    link.setAttribute("rel", "canonical");
    document.head.appendChild(link);
  }
  link.setAttribute("href", href);
}

export default function RouteSEO() {
  const { pathname } = useLocation();

  useEffect(() => {
    const cleanPath = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
    const privatePage = isPrivatePath(cleanPath);
    const base = PUBLIC_META[cleanPath] ?? PUBLIC_META["/"];
    const isDynamic = /^\/(blog|mcqs|exams|flashcards|essays|stories|year)\//.test(cleanPath);

    document.title = privatePage
      ? "OmpathStudy"
      : isDynamic
        ? `${cleanPath.split("/").filter(Boolean).pop()?.replace(/[-_]/g, " ")} | OmpathStudy`
        : base.title;

    upsertMeta("description", base.description);
    upsertMeta("robots", privatePage ? "noindex, nofollow" : "index, follow, max-image-preview:large");

    const canonical = `${SITE}${cleanPath === "/" ? "/" : cleanPath}`;
    upsertCanonical(canonical);

    const ogUrl = document.head.querySelector<HTMLMetaElement>('meta[property="og:url"]');
    if (ogUrl) ogUrl.setAttribute("content", canonical);
  }, [pathname]);

  return null;
}
