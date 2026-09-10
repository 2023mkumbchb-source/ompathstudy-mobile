import { supabase } from "@/integrations/supabase/client";
import type { ContestPreview, ContestStage } from "@/lib/contest";

export interface ContestUniversity {
  id: string;
  name: string;
  slug: string;
  abbreviation: string | null;
  verified: boolean;
}

export interface ContestRecord extends ContestPreview {
  id: string;
}

export async function loadContestPlatform(): Promise<{ contests: ContestRecord[]; universities: ContestUniversity[] }> {
  const [{ data: contestRows, error: contestError }, { data: universityRows, error: universityError }] = await Promise.all([
    (supabase as any).from("contests").select("id,slug,title,subtitle,status,subjects,eligible_years,competition_format").eq("published", true).order("created_at"),
    (supabase as any).from("contest_universities").select("id,name,slug,abbreviation,verified").eq("active", true).order("name"),
  ]);
  if (contestError) throw contestError;
  if (universityError) throw universityError;
  return {
    contests: (contestRows || []).map((row: any) => ({
      id: row.id, slug: row.slug, title: row.title, subtitle: row.subtitle,
      stage: row.status as ContestStage, subjects: row.subjects || [], years: row.eligible_years || [],
      format: row.competition_format || "", teams: "University teams and individual representatives",
    })),
    universities: (universityRows || []) as ContestUniversity[],
  };
}
