import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SUPABASE_URL = "https://dekyjrfwvavtoivqivno.supabase.co";
const SUPABASE_KEY = "sb_publishable_jOXeiFMWJj1z_M-zShimXA_cG9f2QxL";

const client = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  console.log("Fetching published content from Supabase for offline seed bundle...");

  // 1. Fetch summaries
  const { data: summaries, error: sumErr } = await client
    .from("articles")
    .select("id, title, category, created_at, updated_at, published, slug, meta_description, og_image_url, tags, featured_image, content_kind, content_type, semester_number")
    .eq("published", true)
    .eq("is_raw", false)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });

  if (sumErr) throw sumErr;
  console.log(`Fetched ${summaries?.length || 0} article summaries.`);

  // 2. Fetch all full articles
  const { data: articles, error: artErr } = await client
    .from("articles")
    .select("id, title, content, original_notes, category, created_at, updated_at, published, is_raw, slug, meta_title, meta_description, og_image_url, tags, featured_image, reading_time_minutes, content_kind, content_type, semester_number")
    .eq("published", true)
    .eq("is_raw", false)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });

  if (artErr) throw artErr;
  console.log(`Fetched ${articles?.length || 0} full articles.`);

  // 3. Fetch MCQ sets
  const { data: mcqSets, error: mcqErr } = await client
    .from("mcq_sets")
    .select("*")
    .eq("published", true)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });

  if (mcqErr) throw mcqErr;
  console.log(`Fetched ${mcqSets?.length || 0} MCQ sets.`);

  // 4. Fetch flashcard sets
  const { data: flashcards, error: fcErr } = await client
    .from("flashcard_sets")
    .select("*")
    .eq("published", true)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });

  if (fcErr) throw fcErr;
  console.log(`Fetched ${flashcards?.length || 0} flashcard sets.`);

  const bundle = {
    generated_at: new Date().toISOString(),
    version: 1,
    summaries: summaries || [],
    articles: articles || [],
    mcq_sets: mcqSets || [],
    flashcard_sets: flashcards || [],
  };

  const outputPath = path.resolve(__dirname, "../public/offline-seed.json");
  const jsonStr = JSON.stringify(bundle);
  fs.writeFileSync(outputPath, jsonStr, "utf-8");

  const sizeMb = (Buffer.byteLength(jsonStr) / (1024 * 1024)).toFixed(2);
  console.log(`Successfully generated ${outputPath} (${sizeMb} MB)`);
}

main().catch((err) => {
  console.error("Error generating offline seed:", err);
  process.exit(1);
});
