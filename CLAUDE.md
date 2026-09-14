# Compact Instructionsn

This project is mid-way through extracting the "Aponeurosis 01 (Limb SPOT)" PDF
(`scratch/Aponeurosis 01(Limb SPOT).pdf`, 1508 pages) into study Q&A content merged
into three live Supabase `articles` rows, per the manifest at
`scratch/aponeurosis-manifest.json` (17 papers in the first-half scope, pages 0-753).

Status as of 2026-08-07: Papers 1-10 are done — transcribed, images cropped and
uploaded to R2, merged into the three live published banks, confirmed live via direct
Supabase query. Papers 11-17 are not started (no crop scripts, no R2 mappings, no
drafts exist for any of them yet). Do not restart or redo papers 1-10.

The three target Supabase `articles` rows (table `articles`, published, live):
- slug `aponeurosis-anatomy-question-bank`   (category "Year 1: Anatomy")
- slug `aponeurosis-histology-question-bank` (category "Year 1: Histology")
- slug `aponeurosis-embryology-question-bank`(category "Year 1: Embryology")
Local mirrors: `content-drafts/merged/aponeurosis-{anatomy,histology,embryology}.md`
— keep these in sync with whatever gets pushed live (write back after every update,
like `append-p10.mjs` does).

Work directly in this folder (`C:\Users\LENOVO\Desktop\OMPATHSTUDY`) — it has its own
`.env` with the Supabase credentials used by all the insert-p*.mjs / append-p*.mjs
scripts, and publishing is a direct Supabase write, not a site-repo change. There is
no separate "story-weave-box scratchpad clone" needed for this task.

When compacting context, always preserve:
- The full list of the 17 papers from `scratch/aponeurosis-manifest.json`, with which
  are already published (with slugs) and which are still pending.
- For the paper currently in progress: which question images have been viewed,
  which answer-key pages have been read, and any answers already transcribed but
  not yet written to a markdown draft.
- The crop rectangle / script already tuned for the current paper's slide template
  (e.g. `scratch/crop-p9.mjs`), if one exists.
- Do not restart or redo any paper that has already been published.

When resuming after a compact, on a "continue" instruction: pick up the current
paper exactly where transcription/cropping/uploading left off, rather than
re-deriving the whole plan from scratch.
