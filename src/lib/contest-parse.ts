export interface ParsedContestQuestion {
  stem: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
}

const LETTERS = "ABCDEFGH";

function cleanLine(line: string) {
  return line.replace(/\s+/g, " ").trim();
}

/**
 * Turns pasted exam / past-paper / MCQ text into contest question objects.
 * Supported shapes:
 *   1. Question stem text?
 *   A. option one
 *   B) option two *
 *   Answer: B
 *   Explanation: because ...
 * A correct option can be flagged either with a trailing asterisk or an Answer line.
 */
export function parseContestQuestions(raw: string): { questions: ParsedContestQuestion[]; warnings: string[] } {
  const warnings: string[] = [];
  const lines = raw.replace(/\r/g, "").split("\n");
  const questions: ParsedContestQuestion[] = [];

  let stem = "";
  let options: string[] = [];
  let correctIndex = -1;
  let explanation = "";
  let answerLetter = "";

  const flush = () => {
    if (!stem) { stem = ""; options = []; correctIndex = -1; explanation = ""; answerLetter = ""; return; }
    let index = correctIndex;
    if (index < 0 && answerLetter) {
      const letterIndex = LETTERS.indexOf(answerLetter.toUpperCase());
      if (letterIndex >= 0 && letterIndex < options.length) index = letterIndex;
    }
    if (options.length < 2) warnings.push(`"${stem.slice(0, 60)}" was skipped: fewer than two options.`);
    else if (index < 0) warnings.push(`"${stem.slice(0, 60)}" was skipped: no answer marked.`);
    else questions.push({ stem, options: options.slice(0, 8), correctIndex: Math.min(index, 7), explanation: explanation || undefined });
    stem = ""; options = []; correctIndex = -1; explanation = ""; answerLetter = "";
  };

  for (const rawLine of lines) {
    const line = cleanLine(rawLine);
    if (!line) continue;

    const answerMatch = line.match(/^(?:answer|ans|correct answer)\s*[:.\-–]\s*([A-Ha-h])\b/i);
    if (answerMatch) { answerLetter = answerMatch[1]; continue; }

    const explanationMatch = line.match(/^(?:explanation|rationale|because)\s*[:.\-–]\s*(.+)$/i);
    if (explanationMatch) { explanation = explanationMatch[1]; continue; }

    const optionMatch = line.match(/^\(?([A-Ha-h])[).:\]]\s+(.+)$/);
    if (optionMatch && stem) {
      let text = optionMatch[2].trim();
      let flagged = false;
      if (/\s*\*+$/.test(text) || /^\*+\s*/.test(text)) { flagged = true; text = text.replace(/^\*+\s*/, "").replace(/\s*\*+$/, "").trim(); }
      if (/\s*\((?:correct|answer)\)$/i.test(text)) { flagged = true; text = text.replace(/\s*\((?:correct|answer)\)$/i, "").trim(); }
      if (!text) continue;
      if (flagged) correctIndex = options.length;
      options.push(text);
      continue;
    }

    const stemMatch = line.match(/^(?:q(?:uestion)?\s*)?(\d{1,3})\s*[).:\-–]\s*(.+)$/i);
    if (stemMatch) {
      flush();
      stem = stemMatch[2].trim();
      continue;
    }

    if (!stem) { stem = line; continue; }
    if (options.length) continue; // stray text after options is ignored
    stem = `${stem} ${line}`.trim();
  }
  flush();

  return { questions, warnings };
}
