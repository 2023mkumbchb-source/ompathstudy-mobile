import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callOmniRoute, omniRouteConfig } from "../_shared/omniroute.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const UNIT_CATEGORIES = [
  "Pathology",
  "General Pathology",
  "Basic Pharmacology II",
  "Pharmacology",
  "Hematopathology",
  "Research Methodology and Proposal Writing",
  "Endocrine and Metabolic Pathology",
  "Chemical Pathology",
  "Respiratory System Pathology",
  "Junior Clerkship/Practicals in General Pathology I",
  "Gastrointestinal Pathology",
  "Female Reproductive System Pathology",
  "Cardiovascular System Pathology",
];

function cleanHeading(text: string): string {
  return text
    .replace(/^#+\s*/, "")
    .replace(/^\*+|\*+$/g, "")
    .replace(/^"|"$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function compactWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function clipNotesForModel(notes: string, maxChars = 28000): string {
  const clean = notes.trim();
  if (clean.length <= maxChars) return clean;

  const headLen = Math.floor(maxChars * 0.5);
  const midLen = Math.floor(maxChars * 0.2);
  const tailLen = maxChars - headLen - midLen;

  const head = clean.slice(0, headLen);
  const midStart = Math.floor(clean.length / 2) - Math.floor(midLen / 2);
  const mid = clean.slice(Math.max(0, midStart), Math.max(0, midStart) + midLen);
  const tail = clean.slice(-tailLen);

  return [
    head,
    "\n\n[... middle excerpt for long-note safety ...]\n\n",
    mid,
    "\n\n[... ending excerpt ...]\n\n",
    tail,
  ].join("");
}

function inferCategoryFromKeywords(notes: string): string {
  const n = notes.toLowerCase();
  if (n.includes("pharmacology") || n.includes("drug") || n.includes("dose") || n.includes("receptor")) return "Pharmacology";
  if (n.includes("hemat") || n.includes("blood film") || n.includes("anemia")) return "Hematopathology";
  if (n.includes("gastro") || n.includes("liver") || n.includes("hepatic") || n.includes("intestinal")) return "Gastrointestinal Pathology";
  if (n.includes("respir") || n.includes("lung") || n.includes("bronch") || n.includes("asthma")) return "Respiratory System Pathology";
  if (n.includes("cardio") || n.includes("heart") || n.includes("myocard") || n.includes("vascular")) return "Cardiovascular System Pathology";
  if (n.includes("endocr") || n.includes("thyroid") || n.includes("adrenal") || n.includes("pituitary")) return "Endocrine and Metabolic Pathology";
  if (n.includes("female") || n.includes("ovary") || n.includes("uter") || n.includes("cervix")) return "Female Reproductive System Pathology";
  if (n.includes("pathology") || n.includes("histopath") || n.includes("lesion")) return "Pathology";
  return "Uncategorized";
}

function normalizeArticleOutput(raw: string): { title: string; content: string } {
  const cleaned = raw.replace(/```[\s\S]*?```/g, "").trim();
  const lines = cleaned.split("\n");
  const firstNonEmpty = lines.find((l) => l.trim().length > 0) ?? "Study Article";
  const title = cleanHeading(firstNonEmpty) || "Study Article";
  const bodyStart = lines[0]?.trim() === firstNonEmpty.trim() ? 1 : 0;
  let body = lines.slice(bodyStart).join("\n").trim();
  body = body.replace(/^#\s+/gm, "## ").trim();

  const hasSummary = /^##\s+Summary\b/im.test(body);
  const hasKeyPoints = /^##\s+Key Points\b/im.test(body);
  const hasDetailed = /^##\s+Detailed Notes\b/im.test(body);
  const hasPractice = /^##\s+Practice Questions\b/im.test(body);

  if (hasSummary && hasKeyPoints && hasDetailed && hasPractice) {
    return { title, content: body };
  }

  const paragraphs = body
    .split(/\n\s*\n/)
    .map((p) => compactWhitespace(p))
    .filter(Boolean);

  const summary = paragraphs[0] || "High-yield summary not provided.";
  const keyPoints = paragraphs
    .flatMap((p) => p.split(/(?<=[.!?])\s+/))
    .map((s) => s.trim())
    .filter((s) => s.length > 25)
    .slice(0, 8)
    .map((s) => `- ${s}`);

  const detailed = paragraphs.slice(1).join("\n\n") || summary;
  const practiceQuestions = [
    `1. What is the core mechanism of ${title}? → Explain the key pathology/physiology process.`,
    `2. Which finding most strongly supports ${title} clinically? → Identify the highest-yield clue.`,
    `3. What is a key differential diagnosis for ${title}? → Contrast the differentiating features.`,
    `4. Which investigation best confirms ${title}? → State the best test and why.`,
    `5. What is first-line management principle in ${title}? → Give the priority step and rationale.`,
    `6. Which complication is most exam-relevant for ${title}? → Name it and early clues.`,
    `7. What is a frequent exam trap in ${title}? → Correct the misconception.`,
    `8. How would ${title} present in a classic vignette? → Summarize hallmark cues.`,
  ];

  const content = [
    "## Summary",
    summary,
    "",
    "## Key Points",
    ...(keyPoints.length ? keyPoints : ["- Add high-yield points for this topic."]),
    "",
    "## Detailed Notes",
    detailed,
    "",
    "## Practice Questions",
    ...practiceQuestions,
  ].join("\n");

  return { title, content };
}

function parseAndNormalizeMcqs(raw: string, expectedCount: number) {
  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error("Failed to parse MCQs from AI response");

  const parsed = JSON.parse(jsonMatch[0]);
  if (!Array.isArray(parsed)) throw new Error("MCQ response was not an array");

  const cleaned = parsed
    .map((item: any) => {
      if (!item?.question || !Array.isArray(item?.options) || item.options.length < 2) return null;
      const question = compactWhitespace(String(item.question));
      const options = item.options.slice(0, 6).map((o: any) => compactWhitespace(String(o)));
      const correct_answer = Number.isInteger(item.correct_answer) ? Math.min(Math.max(item.correct_answer, 0), options.length - 1) : 0;
      const explanation = item.explanation ? compactWhitespace(String(item.explanation)) : "";
      if (!question) return null;
      const balanced = options.map((opt: string) => opt.replace(/\s+—\s+related\s+(?:option|finding)$/i, "").slice(0, 140));
      return {
        question,
        options: balanced,
        correct_answer,
        correct_answer_text: balanced[correct_answer],
        explanation,
      };
    })
    .filter(Boolean);

  const unique: any[] = [];
  const seen = new Set<string>();
  for (const q of cleaned) {
    if (!q) continue;
    const key = q.question.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(q);
    }
  }

  // Redistribute answers to avoid consecutive same answers
  const result = unique.slice(0, expectedCount);
  for (let i = 1; i < result.length; i++) {
    if (result[i].correct_answer === result[i - 1].correct_answer) {
      // Move correct answer to a different letter so no two adjacent share a letter
      const q = result[i];
      const optCount = Array.isArray(q.options) ? q.options.length : 4;
      let newCorrect = (q.correct_answer + 1) % optCount;
      if (newCorrect === result[i - 1].correct_answer) newCorrect = (newCorrect + 1) % optCount;
      const opts = [...q.options];
      const temp = opts[q.correct_answer];
      opts[q.correct_answer] = opts[newCorrect];
      opts[newCorrect] = temp;
      result[i] = {
        ...q,
        options: opts,
        correct_answer: newCorrect,
        correct_answer_text: opts[newCorrect],
      };
    }
  }

  return result;
}

function parseEssayOutput(raw: string) {
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Failed to parse essay output from AI response");

  const parsed = JSON.parse(jsonMatch[0]);
  const saqs = Array.isArray(parsed?.saqs)
    ? parsed.saqs
        .filter((q: any) => q?.question && (q?.model_answer || q?.answer))
        .map((q: any) => ({
          question: compactWhitespace(String(q.question)),
          answer: compactWhitespace(String(q.model_answer || q.answer)),
          marks: Number.isFinite(Number(q.marks)) ? Number(q.marks) : 5,
        }))
    : [];

  const laqs = Array.isArray(parsed?.laqs)
    ? parsed.laqs
        .filter((q: any) => q?.question && (q?.model_answer || q?.answer))
        .map((q: any) => ({
          question: compactWhitespace(String(q.question)),
          answer: compactWhitespace(String(q.model_answer || q.answer)),
          marks: Number.isFinite(Number(q.marks)) ? Number(q.marks) : 20,
        }))
    : [];

  return { saqs, laqs };
}

async function callAI(messages: any[], geminiKey?: string, allKeys?: string[]): Promise<string> {
  // Prefer the OmniRoute combo (free providers) when configured; fall back to Gemini keys.
  const omni = omniRouteConfig();
  if (omni) {
    try {
      return await callOmniRoute(omni, { messages });
    } catch (e: any) {
      console.log("OmniRoute unavailable, falling back to Gemini:", e?.message || String(e));
    }
  }

  // Build list of keys to try: provided keys array > single key > env var
  const keyList: string[] = [];
  if (allKeys && allKeys.length > 0) {
    keyList.push(...allKeys.filter(k => k?.trim()));
  } else if (geminiKey?.trim()) {
    keyList.push(geminiKey.trim());
  }
  // Pull primary + numbered fallback keys from env: GEMINI_API_KEY, GEMINI_API_KEY_2..5
  for (const name of ["GEMINI_API_KEY", "GEMINI_API_KEY_2", "GEMINI_API_KEY_3", "GEMINI_API_KEY_4", "GEMINI_API_KEY_5"]) {
    const v = Deno.env.get(name);
    if (v && !keyList.includes(v)) keyList.push(v);
  }

  if (keyList.length === 0) throw new Error("No AI provider configured. Set OMNIROUTE_BASE_URL/OMNIROUTE_API_KEY secrets or save a Gemini API key in Settings.");

  const systemMsg = messages.find((m: any) => m.role === "system")?.content || "";
  const userMsg = messages.find((m: any) => m.role === "user")?.content || "";
  const prompt = `${systemMsg}\n\n${userMsg}`;

  const MAX_RETRIES = 2;
  const MODELS = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.5-flash-lite"];
  const REQUEST_TIMEOUT_MS = 45000;

  for (const apiKey of keyList) {
    for (const model of MODELS) {
      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

        try {
          const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
              signal: controller.signal,
            }
          );

          if (response.ok) {
            const data = await response.json();
            if (data.error) throw new Error(`Gemini error: ${data.error.message || JSON.stringify(data.error)}`);
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
            if (!text) throw new Error("Gemini returned an empty response.");
            return text;
          }

          const errText = await response.text();
          if (response.status === 429) {
            if (attempt < MAX_RETRIES - 1) {
              await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1500));
              continue;
            }
            // Exhausted retries for this model — try next model, then next key
            break;
          }

          if (response.status === 404) break;
          throw new Error(`Gemini API error (${response.status}): ${errText.slice(0, 300)}`);
        } catch (err) {
          if (err instanceof DOMException && err.name === "AbortError") {
            if (attempt < MAX_RETRIES - 1) continue;
            break;
          }
          throw err;
        } finally {
          clearTimeout(timeout);
        }
      }
    }
    // All models exhausted for this key — try next key
    console.log(`Key ending ...${apiKey.slice(-4)} exhausted, trying next key`);
  }

  throw new Error("All Gemini API keys are currently rate-limited. Wait a bit and retry, or add more keys in Settings.");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { notes, type, count = 20, geminiKey, geminiKeys, title: customTitle } = await req.json();
    // geminiKeys is an array of API keys for rotation; geminiKey is legacy single key
    const allKeys: string[] = Array.isArray(geminiKeys) ? geminiKeys.filter((k: string) => k?.trim()) : [];
    const cardCount = Math.min(Math.max(Number(count) || 20, 5), 100);

    if (!notes || typeof notes !== "string") {
      throw new Error("Invalid input: notes must be a non-empty string");
    }

    const safeNotes = clipNotesForModel(notes);

    if (type === "categorize") {
      const catList = `Available unit categories:\n${UNIT_CATEGORIES.join("\n")}`;
      const messages = [
        {
          role: "system",
          content: `You categorize medical notes into ONE best unit.\n${catList}\n\nReturn ONLY the exact category name, no explanation.`,
        },
        { role: "user", content: safeNotes.slice(0, 5000) },
      ];

      try {
        const category = (await callAI(messages, geminiKey, allKeys)).trim().replace(/^"|"$/g, "");
        const exact = UNIT_CATEGORIES.find((c) => c.toLowerCase() === category.toLowerCase());
        if (exact) {
          return new Response(JSON.stringify({ category: exact }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } catch {
        // fallback below
      }

      const inferred = inferCategoryFromKeywords(safeNotes);
      return new Response(JSON.stringify({ category: inferred }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (type === "essay-qa") {
      const messages = [
        {
          role: "system",
          content: `You are a medical examiner. Create exam-style written questions from content.

Return ONLY valid JSON:
{"saqs":[{"question":"...","model_answer":"...","marks":5}],"laqs":[{"question":"...","model_answer":"...","marks":20}]}

REQUIREMENTS:
- EXACTLY 6 SAQs with marks 5 each (total 30)
- EXACTLY 1 LAQ with marks 20
- Answers should be clinically structured and concise
- No markdown, no extra text`,
        },
        { role: "user", content: safeNotes },
      ];

      const text = await callAI(messages, geminiKey, allKeys);
      const result = parseEssayOutput(text);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (type === "publish-format") {
      const messages = [
        {
          role: "system",
          content: `You are a fast medical publishing formatter for Ompath Study.
Return ONLY valid JSON with this shape:
{"title":"...","content":"...","tags":["..."],"meta_title":"...","meta_description":"...","university":"Mount Kenya University","school":"School of Medicine","unit":"...","exam_type":"...","exam_year":"..."}

Rules:
- Fix FORMAT only: title hierarchy, subtitles, bullets, numbering, MCQ options, essay sections, spacing, and markdown artifacts.
- Do not rewrite the academic meaning, do not shorten, do not remove questions, and do not remove images or tables.
- Preserve Mount Kenya University / MKU whenever present; if no university is clear, use Mount Kenya University.
- Use clean markdown: ## sections, ### subtitles, - bullets, A) choices each on their own line.
- Remove stray asterisks that are not real bold emphasis.
- Tags: 4-8 concise tags including mku and the unit/topic where possible.`,
        },
        { role: "user", content: customTitle ? `Title: ${customTitle}\n\nContent:\n${safeNotes}` : safeNotes },
      ];
      const text = await callAI(messages, geminiKey, allKeys);
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        const result = normalizeArticleOutput(text);
        return new Response(JSON.stringify({ ...result, tags: ["mku"], university: "Mount Kenya University", school: "School of Medicine" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const parsed = JSON.parse(jsonMatch[0]);
      return new Response(JSON.stringify(parsed), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (type === "story-format") {
      const messages = [
        {
          role: "system",
          content: `You are a light-touch story formatter.
Return ONLY valid JSON: {"title":"...","content":"...","category":"..."}
Rules:
- Preserve the author's voice and meaning.
- Fix only necessary grammar, paragraph breaks, headings, spacing, and punctuation.
- Keep safe HTML tags if the input uses HTML; otherwise return clean markdown.
- Do not add new plot/details.`,
        },
        { role: "user", content: `Title: ${customTitle || "Untitled"}\n\nStory:\n${safeNotes.slice(0, 15000)}` },
      ];
      const text = await callAI(messages, geminiKey, allKeys);
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return new Response(JSON.stringify({ title: customTitle || "Untitled", content: notes, category: "Stories" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify(JSON.parse(jsonMatch[0])), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (type === "direct-article") {
      const messages = [
        {
          role: "system",
          content: `You are a medical content formatter. Reformat (do not rewrite or shorten) the content into this exact markdown structure:

Title only on first line (no #)
## Summary
A concise 2-3 sentence overview.

## Key Points
Use bullet points (- ) for key takeaways. Each point should be a full sentence.

## Detailed Notes
Organize into clear subsections using ### headings.
- Use paragraphs for explanations, NOT bullet lists for everything
- Use bullet points only for actual lists
- Preserve ALL tables in proper markdown format (| Header | Header |)
- Preserve ALL content from the original - do NOT truncate or skip sections
- Use **bold** for key terms

## Practice Questions
8 clinical Q→A lines in format: 1. Question → Answer

Rules:
- PRESERVE ALL original content including tables, diagrams descriptions, summaries
- Keep medical accuracy
- Output clean markdown only, no code fences
- Do NOT convert paragraphs into bullet lists
- Tables MUST be preserved in markdown table format
- If there is a summary table at the end, include it under ### Summary Table`,
        },
        { role: "user", content: customTitle ? `Title: ${customTitle}\n\nContent:\n${safeNotes}` : safeNotes },
      ];

      const text = await callAI(messages, geminiKey, allKeys);
      const result = normalizeArticleOutput(text);
      if (customTitle) result.title = customTitle;

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (type === "direct-mcqs") {
      const messages = [
        {
          role: "system",
          content: `You are a medical MCQ formatter. Parse user MCQs to JSON only.

Output ONLY valid JSON array:
[{"question":"...","options":["A","B","C","D"],"correct_answer":0,"explanation":"..."}]

Rules:
- exactly 4 options each
- convert answers to 0-based index
- all options must be comparable length; no correct answer should be obviously longest or most detailed
- keep explanations separate, never inside options
- preserve meaning
- return up to ${cardCount} questions`,
        },
        { role: "user", content: safeNotes },
      ];

      const text = await callAI(messages, geminiKey, allKeys);
      const result = parseAndNormalizeMcqs(text, cardCount);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (type === "direct-flashcards") {
      const messages = [
        {
          role: "system",
          content: `You are a flashcard formatter. Return ONLY valid JSON array: [{"question":"...","answer":"..."}]. Return up to ${cardCount} cards.`,
        },
        { role: "user", content: safeNotes },
      ];

      const text = await callAI(messages, geminiKey, allKeys);
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error("Failed to parse flashcards");
      const parsed = JSON.parse(jsonMatch[0]);
      const result = parsed
        .filter((item: any) => item?.question && item?.answer)
        .map((item: any) => ({ question: String(item.question).trim(), answer: String(item.answer).trim() }))
        .slice(0, cardCount);

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (type === "moderate-and-fix-story") {
      const messages = [
        {
          role: "system",
          content: `You are a story editor and moderator. Do TWO things:
1. Check if the text is a genuine story, narrative, reflection, or creative writing. Reject spam, gibberish, offensive content, or non-story content.
2. If approved, fix ALL grammar, spelling, and punctuation errors. Improve sentence flow while preserving the author's voice and meaning. Keep the HTML formatting intact.

Return ONLY valid JSON:
If rejected: {"rejected": true, "reason": "Brief explanation"}
If approved: {"approved": true, "category": "Stories", "title": "Improved title", "content": "The full corrected story HTML with grammar fixes"}

Rules:
- Be lenient on what counts as a story - accept reflections, medical experiences, creative writing, poems, essays
- Fix grammar thoroughly but preserve voice
- Keep all HTML tags (bold, italic, underline, lists, etc.)
- Improve the title slightly if needed`,
        },
        { role: "user", content: `Title: ${customTitle || "Untitled"}\n\nContent:\n${safeNotes.slice(0, 15000)}` },
      ];

      const text = await callAI(messages, geminiKey, allKeys);
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return new Response(JSON.stringify({ approved: true, category: "Stories", content: notes }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const parsed = JSON.parse(jsonMatch[0]);
      return new Response(JSON.stringify(parsed), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (type === "moderate-story") {
      const messages = [
        {
          role: "system",
          content: `You moderate story submissions. Determine if the text is a genuine story, narrative, reflection, or creative writing.
Reject spam, gibberish, offensive content, or non-story content (e.g. homework, code, random text).

Return ONLY valid JSON:
{"approved": true, "category": "Stories", "reason": ""} 
OR
{"rejected": true, "reason": "Brief explanation why"}

Be lenient - accept personal reflections, medical experiences, creative writing, poems, essays about life.`,
        },
        { role: "user", content: `Title: ${customTitle || "Untitled"}\n\nContent:\n${safeNotes.slice(0, 5000)}` },
      ];

      const text = await callAI(messages, geminiKey, allKeys);
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return new Response(JSON.stringify({ approved: true, category: "Stories" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const parsed = JSON.parse(jsonMatch[0]);
      return new Response(JSON.stringify(parsed), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (type === "expand-story") {
      const messages = [
        {
          role: "system",
          content: `You are a creative writing editor. Expand and improve the given story while preserving the author's voice and core message.

Rules:
- Keep the original narrative and meaning intact
- Add vivid descriptions, dialogue, and emotional depth
- Use proper markdown formatting with paragraphs
- Use ## for section breaks if the story is long
- Use > for impactful quotes or reflections
- Use *italics* for internal thoughts
- Target at least 1500 words for short stories
- Make it engaging and well-structured
- Preserve the title or improve it slightly
- Output format: first line is the title (no #), then a blank line, then the story content`,
        },
        { role: "user", content: customTitle ? `Title: ${customTitle}\n\nStory:\n${safeNotes}` : safeNotes },
      ];

      const text = await callAI(messages, geminiKey, allKeys);
      const lines = text.trim().split("\n");
      const title = cleanHeading(lines[0] || customTitle || "Untitled Story");
      const content = lines.slice(1).join("\n").trim();
      return new Response(JSON.stringify({ title, content }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }


    if (type === "categorize-timetable") {
      const messages = [
        {
          role: "system",
          content: `You are a medical curriculum organizer. Parse the given timetable/unit list into structured categories.

Output ONLY valid JSON: {"categories":["Year 1: Anatomy","Year 1: Physiology",...]}

Rules:
- Format each as "Year X: Unit Name"
- Detect year from context (Year 1, Year 2, 1st year, etc.)
- If no year is specified, use "Year 1" as default
- Include semester info as part of the unit if relevant (e.g. "Year 2: Physiology Sem 1")
- Clean up abbreviations and formatting
- Remove duplicates
- Sort by year then alphabetically`,
        },
        { role: "user", content: safeNotes.slice(0, 10000) },
      ];
      try {
        const text = await callAI(messages, geminiKey, allKeys);
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (Array.isArray(parsed.categories)) {
            return new Response(JSON.stringify(parsed), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }
      } catch {}
      // Fallback: simple line parsing
      const lines = safeNotes.split("\n").map(l => l.trim()).filter(Boolean);
      const categories = lines.map(l => l.replace(/^[-•*\d.)\]]+\s*/, "").trim()).filter(c => c.length > 2);
      return new Response(JSON.stringify({ categories }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (type === "generate-seo-meta") {
      const messages = [
        {
          role: "system",
          content: `You are a medical SEO expert. Given article info, generate optimized metadata.
Return ONLY valid JSON: {"meta_title":"...","meta_description":"...","slug":"..."}
- meta_title: max 60 chars, include key medical terms, compelling
- meta_description: max 155 chars, informative and click-worthy
- slug: lowercase, hyphens only, 3-6 words, no UUIDs`,
        },
        { role: "user", content: safeNotes.slice(0, 5000) },
      ];
      const text = await callAI(messages, geminiKey, allKeys);
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("Failed to parse SEO meta");
      const parsed = JSON.parse(jsonMatch[0]);
      return new Response(JSON.stringify(parsed), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let systemPrompt = "";
    if (type === "article") {
      systemPrompt = `You are a medical education expert. Convert notes into an exam-focused study article in markdown.

STRICT FORMAT:
- Title only on first line
- ## Summary (2-3 sentence overview)
- ## Key Points (bullet list of key takeaways)
- ## Detailed Notes (use ### subheadings, paragraphs for explanations, bullets only for real lists, preserve tables)
- ## Practice Questions (at least 8 Q→A lines)
- Use paragraphs for content, NOT bullet lists for everything
- Keep tables in proper markdown format
- No code fences`;
    } else if (type === "mcqs") {
      systemPrompt = `You are a senior medical exam writer. Create EXACTLY ${cardCount} clinically-oriented MCQs.

CRITICAL RULES:
1. The correct answers MUST be evenly distributed across A, B, C, D. NO TWO consecutive questions may share the same correct letter. Vary the correct letter for every single question.
2. ALL FOUR options for each question must have SIMILAR LENGTH (within 25% of each other in word count). Never make the correct option obviously longer or shorter than the distractors. Distractors must be plausible, of comparable specificity, and the same grammatical form as the correct answer.
3. Each option must read as a complete answer to the stem - not "All of the above" or "None of the above".

Return ONLY valid JSON array with schema:
{"question":"...","options":["A","B","C","D"],"correct_answer":0,"explanation":"..."}`;
    } else {
      systemPrompt = `You are a medical education expert. Create EXACTLY ${cardCount} high-yield flashcards.
Return ONLY valid JSON array: [{"question":"...","answer":"..."}]`;
    }

    const messages = [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content:
          type === "flashcards"
            ? `Create exactly ${cardCount} flashcards from these notes:\n\n${safeNotes}`
            : type === "mcqs"
            ? `Create exactly ${cardCount} MCQs from these notes:\n\n${safeNotes}`
            : safeNotes,
      },
    ];

    const text = await callAI(messages, geminiKey, allKeys);

    let result: any;
    if (type === "article") {
      result = normalizeArticleOutput(text);
    } else if (type === "mcqs") {
      result = parseAndNormalizeMcqs(text, cardCount);
    } else {
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error("Failed to parse flashcards");
      const parsed = JSON.parse(jsonMatch[0]);
      result = parsed
        .filter((item: any) => item?.question && item?.answer)
        .map((item: any) => ({ question: String(item.question).trim(), answer: String(item.answer).trim() }))
        .slice(0, cardCount);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Error:", e);
    const errorMsg = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMsg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
