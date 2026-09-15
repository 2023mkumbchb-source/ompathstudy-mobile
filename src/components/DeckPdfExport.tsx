import { Download } from "lucide-react";
import type { SlideDeck } from "@/components/SlideDeck";

const escapeHtml = (s: string) =>
  (s || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));

/**
 * Deliberately abridged, watermarked handout.
 *
 * Anti-leak criteria (kept in one place so it is easy to tune):
 *  - only every other plate is exported (about half the paper)
 *  - the extra teaching notes under each answer are stripped
 *  - reader-verified corrections are never exported
 *  - every page carries a diagonal site watermark plus the buyer's pass code
 *    so a shared copy is traceable
 */
export function buildDeckHandout(
  deck: SlideDeck,
  opts: { title: string; university?: string; passCode?: string; ratio?: number },
) {
  const ratio = opts.ratio ?? 0.5;
  const step = Math.max(2, Math.round(1 / ratio));
  const included = deck.slides.filter((_, i) => i % step === 0);
  const stamp = opts.passCode ? `Pass ${opts.passCode}` : "www.ompathstudy.com";

  const body = included
    .map(
      (s, index) => `
      <section class="plate">
        <h2>${index + 1}. ${escapeHtml(s.prompt || "")}</h2>
        ${s.image ? `<img src="${escapeHtml(s.image)}" alt="${escapeHtml(s.alt || s.prompt || "")}" />` : ""}
        ${
          s.rows.length
            ? `<table>${s.rows
                .map(
                  (r, i) =>
                    `<tr><td class="k">${escapeHtml(r.label || `${i + 1}.`)}</td><td>${escapeHtml(r.term || "")}</td></tr>`,
                )
                .join("")}</table>`
            : ""
        }
      </section>`,
    )
    .join("");

  return `<!doctype html><html><head><meta charset="utf-8" />
  <title>${escapeHtml(opts.title)} — abridged handout</title>
  <style>
    @page { margin: 16mm; }
    body { font-family: Georgia, "Times New Roman", serif; color: #111; margin: 0; padding: 24px; position: relative; }
    .wm { position: fixed; inset: 0; z-index: 0; pointer-events: none; display: flex; align-items: center; justify-content: center; }
    .wm span { transform: rotate(-32deg); font-size: 46px; font-weight: 700; letter-spacing: 6px; color: rgba(17,17,17,0.08); white-space: nowrap; text-align: center; line-height: 2.4; }
    header { border-bottom: 2px solid #111; padding-bottom: 14px; margin-bottom: 22px; text-align: center; position: relative; z-index: 1; }
    header .uni { font-size: 11px; letter-spacing: 3px; text-transform: uppercase; font-weight: 700; }
    header h1 { font-size: 22px; margin: 10px 0 4px; }
    header p { font-size: 11px; color: #555; margin: 4px 0 0; font-style: italic; }
    .plate { page-break-inside: avoid; margin-bottom: 26px; position: relative; z-index: 1; }
    .plate h2 { font-size: 14px; margin: 0 0 8px; }
    .plate img { max-width: 62%; display: block; margin: 0 auto 8px; border: 1px solid #ddd; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    td { border-bottom: 1px solid #eee; padding: 4px 6px; vertical-align: top; }
    td.k { width: 70px; font-weight: 700; color: #666; }
    footer { margin-top: 26px; border-top: 1px solid #ccc; padding-top: 10px; font-size: 10px; color: #555; text-align: center; position: relative; z-index: 1; }
    .final-page { page-break-before: always; min-height: 85vh; display: flex; align-items: center; justify-content: center; text-align: center; position: relative; z-index: 1; }
    .final-page h2 { font-size: 24px; margin-bottom: 10px; }
    .final-page p { font-size: 14px; color: #444; }
  </style></head>
  <body>
    <div class="wm"><span>${escapeHtml(stamp)}<br/>ompathstudy.com<br/>${escapeHtml(stamp)}</span></div>
    <header>
      ${opts.university ? `<p class="uni">${escapeHtml(opts.university)}</p>` : ""}
      <h1>${escapeHtml(opts.title)}</h1>
      <p>Abridged study handout — ${included.length} of ${deck.slides.length} plates. Full verified key, reader corrections and
      zoomable images at www.ompathstudy.com</p>
    </header>
    ${body}
    <section class="final-page">
      <div><h2>Continue revising with Ompath Study</h2><p>For more study files, questions and verified answers, kindly visit <strong>www.ompathstudy.com</strong>.</p></div>
    </section>
    <footer>
      &copy; Ompath Study — licensed to ${escapeHtml(stamp)}. Not for redistribution. Sharing this file is traceable to the pass above.
    </footer>
    <script>window.onload = function(){ setTimeout(function(){ window.print(); }, 600); };<\/script>
  </body></html>`;
}

export function DeckDownloadButton({
  deck, title, university, passCode, disabled,
}: { deck: SlideDeck; title: string; university?: string; passCode?: string; disabled?: boolean }) {
  const run = () => {
    window.dispatchEvent(new CustomEvent("ompath:open-pdf-preview"));
  };

  return (
    <button
      type="button"
      onClick={run}
      disabled={disabled}
      title={disabled ? "Included with a downloadable pass" : "Download an abridged, watermarked handout"}
      className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:border-primary/40 hover:text-primary disabled:opacity-50"
    >
      <Download className="h-3.5 w-3.5" /> PDF
    </button>
  );
}
