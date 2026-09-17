import { SITE_URL } from "./seo";

const PRIVATE_PREFIXES = [
  "/admin",
  "/account",
  "/notifications",
  "/my-revision",
  "/revision-planner",
  "/source-library",
  "/submit-story",
  "/contests/",
  "/search",
  "/login",
  "/auth/callback",
  "/supplementary-revision",
];

const PUBLIC_PREFIXES = [
  "/",
  "/year/",
  "/blog",
  "/mcqs",
  "/exams",
  "/flashcards",
  "/essays",
  "/stories",
  "/revision-index",
  "/about",
  "/updates",
];

const TITLES: Record<string, { title: string; description: string }> = {
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
  "/revision-index": {
    title: "Medical Revision Index | OmpathStudy",
    description: "Organized medical revision resources, notes, MCQs, flashcards and exams for health sciences students.",
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

function cleanPath(pathname: string) {
  if (!pathname || pathname === "/") return "/";
  return pathname.replace(/\/+$/, "") || "/";
}

function matchesPrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(prefix.endsWith("/") ? prefix : `${prefix}/`);
}

function isPrivate(pathname: string) {
  return PRIVATE_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix));
}

function isPublic(pathname: string) {
  return PUBLIC_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix));
}

function upsertMeta(name: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.name = name;
    document.head.appendChild(el);
  }
  el.content = content;
}

function upsertProperty(property: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[property="${property}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("property", property);
    document.head.appendChild(el);
  }
  el.content = content;
}

function upsertCanonical(href: string) {
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!link) {
    link = document.createElement("link");
    link.rel = "canonical";
    document.head.appendChild(link);
  }
  link.href = href;
}

function applyRouteSEO() {
  const path = cleanPath(window.location.pathname);
  const privatePage = isPrivate(path) || !isPublic(path);
  const canonical = `${SITE_URL}${path === "/" ? "/" : path}`;
  const exact = TITLES[path];
  const dynamic = /^\/(blog|mcqs|exams|flashcards|essays|stories|year)\//.test(path);

  if (privatePage) {
    document.title = "OmpathStudy";
    upsertMeta("robots", "noindex, nofollow");
  } else {
    document.title = exact?.title || (dynamic
      ? `${path.split("/").filter(Boolean).pop()?.replace(/[-_]/g, " ")} | OmpathStudy`
      : "OmpathStudy | Medical Study Resources");
    upsertMeta("robots", "index, follow, max-image-preview:large");
    upsertMeta("description", exact?.description || "Medical study resources, notes, MCQs, flashcards and exams for health sciences students.");
  }

  upsertCanonical(canonical);
  upsertProperty("og:url", canonical);
  upsertProperty("og:title", document.title);
  upsertProperty("og:type", dynamic && /^\/(blog|essays|stories)\//.test(path) ? "article" : "website");

  // Filter/query URLs use the clean path as their canonical URL.
  // Search and authenticated pages are explicitly excluded from indexing.
  if (window.location.search) {
    upsertCanonical(canonical);
  }
}

applyRouteSEO();

window.addEventListener("popstate", applyRouteSEO);

const originalPushState = history.pushState;
const originalReplaceState = history.replaceState;

history.pushState = function (...args) {
  const result = originalPushState.apply(this, args);
  window.dispatchEvent(new Event("ompath:routechange"));
  return result;
};

history.replaceState = function (...args) {
  const result = originalReplaceState.apply(this, args);
  window.dispatchEvent(new Event("ompath:routechange"));
  return result;
};

window.addEventListener("ompath:routechange", applyRouteSEO);
