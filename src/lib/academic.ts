import { supabase } from "@/integrations/supabase/client";
import { dedupeResourceSummaries, isPublicMcqSet, isPublicStudyTitle } from "@/lib/content-policy";

export type ResourceType = "article" | "mcq" | "flashcard" | "exam" | "story";

export const CONTENT_TYPES = [
  "Notes",
  "CAT",
  "Past Paper",
  "MCQ Bank",
  "Course Outline",
  "Revision Guide",
  "Flashcards",
  "Timed Exam",
  "Clinical Story",
] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];

export interface AcademicYear {
  id: string;
  year_number: number;
  title: string;
  description: string | null;
  published: boolean;
}

export interface Unit {
  id: string;
  academic_year_id: string;
  semester_id: string | null;
  name: string;
  slug: string;
  short_name: string | null;
  course_code: string | null;
  description: string | null;
  learning_objectives: string | null;
  exam_information: string | null;
  legacy_category: string | null;
  display_order: number;
  published: boolean;
  icon: string | null;
  color: string | null;
}

export interface SyllabusTopic {
  id: string;
  unit_id: string;
  parent_topic_id: string | null;
  title: string;
  description: string | null;
  learning_objectives: string | null;
  display_order: number;
  importance: string;
}

export interface UnitResource {
  id: string;
  title: string;
  slug: string | null;
  category: string;
  content_type: string | null;
  created_at: string;
  updated_at: string | null;
  verification_status?: string | null;
  completeness_status?: string | null;
  exam_year?: string | null;
  kind: ResourceType;
}

const cache = new Map<string, { at: number; value: unknown }>();
const TTL = 5 * 60 * 1000;

async function cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.value as T;
  const value = await fn();
  cache.set(key, { at: Date.now(), value });
  return value;
}

export function clearAcademicCache() {
  cache.clear();
}

export async function getAcademicYears(): Promise<AcademicYear[]> {
  return cached("years", async () => {
    const { data } = await supabase
      .from("academic_years")
      .select("id, year_number, title, description, published")
      .order("display_order");
    return (data as AcademicYear[]) || [];
  });
}

export interface Semester {
  id: string;
  academic_year_id: string;
  semester_number: number;
  title: string;
  description: string | null;
}

export async function getSemestersForYear(yearNumber: number): Promise<Semester[]> {
  return cached(`semesters:${yearNumber}`, async () => {
    const years = await getAcademicYears();
    const year = years.find((y) => y.year_number === yearNumber);
    if (!year) return [];
    const { data } = await supabase
      .from("semesters")
      .select("id,academic_year_id,semester_number,title,description")
      .eq("academic_year_id", year.id)
      .order("semester_number");
    return (data as Semester[]) || [];
  });
}

export async function getUnitsForYearSemester(yearNumber: number, semesterNumber: number): Promise<Unit[]> {
  const [units, semesters] = await Promise.all([
    getUnitsForYear(yearNumber),
    getSemestersForYear(yearNumber),
  ]);
  const semester = semesters.find((s) => s.semester_number === semesterNumber);
  if (!semester) return [];
  return units.filter((u) => u.semester_id === semester.id);
}

export async function getUnitsForYear(yearNumber: number): Promise<Unit[]> {
  return cached(`units:${yearNumber}`, async () => {
    const years = await getAcademicYears();
    const year = years.find((y) => y.year_number === yearNumber);
    if (!year) return [];
    const { data } = await supabase
      .from("units")
      .select("id,academic_year_id,semester_id,name,slug,short_name,course_code,description,learning_objectives,exam_information,legacy_category,display_order,published,icon,color")
      .eq("academic_year_id", year.id)
      .order("display_order")
      .order("name");
    return (data as Unit[]) || [];
  });
}

export async function getUnitBySlug(yearNumber: number, slug: string): Promise<Unit | null> {
  const units = await getUnitsForYear(yearNumber);
  return units.find((u) => u.slug === slug) || null;
}

export function unitPath(yearNumber: number, slug: string) {
  return `/year/${yearNumber}/unit/${slug}`;
}

export async function getTopicsForUnit(unitId: string): Promise<SyllabusTopic[]> {
  const { data } = await supabase
    .from("syllabus_topics")
    .select("id,unit_id,parent_topic_id,title,description,learning_objectives,display_order,importance")
    .eq("unit_id", unitId)
    .order("display_order");
  return (data as SyllabusTopic[]) || [];
}

/** Resource lists for a unit. Only summary columns are fetched. */
export async function getUnitResources(unit: Unit): Promise<UnitResource[]> {
  const category = unit.legacy_category;
  const filter = category ? `unit_id.eq.${unit.id},category.eq.${category}` : `unit_id.eq.${unit.id}`;

  const [articles, mcqs, flashcards] = await Promise.all([
    supabase
      .from("articles")
      .select("id, title, slug, category, content_type, created_at, updated_at, verification_status, completeness_status, exam_year")
      .eq("published", true)
      .is("deleted_at", null)
      .or(filter)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("mcq_sets")
      .select("id, title, slug, category, content_type, created_at, updated_at")
      .eq("published", true)
      .is("deleted_at", null)
      .or(filter)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("flashcard_sets")
      .select("id, title, slug, category, content_type, created_at, updated_at")
      .eq("published", true)
      .is("deleted_at", null)
      .or(filter)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  return [
    ...(articles.data || []).filter((r) => isPublicStudyTitle(r.title)).map((r) => ({ ...r, kind: "article" as const })),
    ...dedupeResourceSummaries((mcqs.data || []).filter(isPublicMcqSet)).map((r) => ({ ...r, kind: "mcq" as const })),
    ...(flashcards.data || []).map((r) => ({ ...r, kind: "flashcard" as const })),
  ];
}

export function resourcePath(r: UnitResource): string {
  // MCQ sets power the timed exam flow directly (see ExamStart.tsx, which
  // resolves this same slug-or-id against the mcq_sets table) -- link there
  // instead of a fuzzy title search on the blog.
  if (r.kind === "mcq") return `/mcqs/${r.slug || r.id}`;
  if (r.kind === "flashcard") return `/flashcards/${r.slug || r.id}`;
  return `/blog/${r.slug || r.id}`;
}

export function classifyContentType(r: UnitResource): ContentType {
  if (r.content_type && (CONTENT_TYPES as readonly string[]).includes(r.content_type)) {
    return r.content_type as ContentType;
  }
  if (r.kind === "mcq") return "MCQ Bank";
  if (r.kind === "flashcard") return "Flashcards";
  const t = r.title.toLowerCase();
  if (/course outline/.test(t)) return "Course Outline";
  if (/\bcat\b|continuous assessment/.test(t)) return "CAT";
  if (/past paper|end of year|eoy|mid semester|exam 20/.test(t)) return "Past Paper";
  if (/revision guide|study guide/.test(t)) return "Revision Guide";
  return "Notes";
}
