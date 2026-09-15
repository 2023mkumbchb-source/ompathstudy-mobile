export interface NormalizedMcqQuestion {
  question: string;
  options: string[];
  correct_answer: number;
  correct_answer_text?: string;
  explanation?: string;
  [key: string]: unknown;
}

/** Convert legacy OCR/LaTeX fragments into readable plain medical text. */
export function cleanExamText(value: unknown): string {
  return String(value || "")
    .replace(/\$+/g, "")
    .replace(/\\(?:text|mathrm)\{([^{}]*)\}/g, "$1")
    .replace(/\\alpha\b/g, "α")
    .replace(/\\beta\b/g, "β")
    .replace(/\\gamma\b/g, "γ")
    .replace(/\\delta\b/g, "δ")
    .replace(/\\mu\b/g, "µ")
    .replace(/\\times\b/g, "×")
    .replace(/_\{([^{}]+)\}/g, "_$1")
    .replace(/\^\{([^{}]+)\}/g, "^$1")
    .replace(/[{}]/g, "")
    .replace(/\\([_+\-])/g, "$1")
    .replace(/\\[;,!]/g, " ")
    .replace(/\\+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function cleanMcqOption(value: unknown): string {
  return cleanExamText(value)
    .replace(/&amp;nbsp;|&nbsp;|\u00a0/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/^\s*(?:option\s*)?[A-F][.)]\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanLegacyBoundaryText(value: unknown): string {
  return cleanExamText(value)
    .replace(/\s*---\s*(?:#{1,6}\s+(?:set\b|genetics\b|ha?emat|patholog|microbi|parasit|mycolog|virolog)[\s\S]*)?$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function answerIndexFromText(text: string, options: string[]): number | undefined {
  const marker = text.match(/(?:correct\s*answer|answer)\s*[:-]\s*\(?([A-F])\)?\b/i)?.[1];
  if (!marker) return undefined;
  const index = marker.toUpperCase().charCodeAt(0) - 65;
  return index >= 0 && index < options.length ? index : undefined;
}

function splitEmbeddedExplanation(question: string, correctOption: string): { question: string; explanation?: string } {
  const colon = question.lastIndexOf(":");
  if (colon < 10) return { question };
  const stem = question.slice(0, colon).trim();
  const suffix = question.slice(colon + 1).trim();
  if (suffix.length < 24 || stem.length < 10) return { question };
  const significant = correctOption.toLowerCase().match(/[a-z][a-z-]{3,}/g) || [];
  const suffixLower = suffix.toLowerCase();
  const containsAnswerTerm = significant.some((word) => suffixLower.includes(word));
  if (!containsAnswerTerm) return { question };
  return { question: stem, explanation: cleanLegacyBoundaryText(suffix) };
}

function applyVerifiedClinicalOverride(
  question: string,
  options: string[],
  correct: number,
  explanation: string,
): { question: string; correct: number; explanation: string } {
  const isGlabrataOralAlternative = /c(?:andida)?\.?\s*glabrata/i.test(question)
    && /fluconazole[- ]resistan|resistan\w*\s+to\s+fluconazole/i.test(question)
    && /oral\s+alternative/i.test(question);
  if (!isGlabrataOralAlternative) return { question, correct, explanation };

  const posaconazole = options.findIndex((option) => /posaconazole/i.test(option));
  if (posaconazole < 0) return { question, correct, explanation };
  return {
    question: "After initial echinocandin therapy, a stable patient has fluconazole-resistant Candida glabrata candidemia whose isolate is susceptible to posaconazole. Which oral step-down option is reasonable?",
    correct: posaconazole,
    explanation: "Posaconazole tablets are an IDSA-supported oral step-down option only when the isolate is susceptible to posaconazole but not fluconazole. An echinocandin remains preferred initial therapy for invasive candidiasis.",
  };
}

function isKnownUnsafeLegacyQuestion(question: string): boolean {
  return /[:?]\s*A\)\s*\S/i.test(question)
    || /aflatoxins are a serious problem because/i.test(question)
    || /more visible symptoms of fungal infection appearing recently/i.test(question)
    || /continued options for mycetoma agents/i.test(question)
    || /all are zoophilic dermatophytes\b.*select all/i.test(question);
}

function applyVerifiedMycologyWording(
  question: string,
  options: string[],
  correct: number,
  explanation: string,
): { question: string; correct: number; explanation: string } {
  if (/^aflatoxins are produced by which fungus\?/i.test(question)) {
    const flavus = options.findIndex((option) => /^flavus$/i.test(option));
    if (flavus >= 0) options[flavus] = "Aspergillus flavus";
    return {
      question: "Which fungus is a major producer of aflatoxins?",
      correct: flavus >= 0 ? flavus : correct,
      explanation: "Aspergillus flavus is a major aflatoxin-producing mould. Aspergillus parasiticus can also produce aflatoxins.",
    };
  }

  if (/most reliable lab method for isolation of trichophyton rubrum/i.test(question)) {
    const koh = options.findIndex((option) => /skin scrapings.*KOH|KOH.*skin scrapings/i.test(option));
    if (koh < 0) return { question, correct, explanation };
    return {
      question: "Which rapid test can confirm suspected dermatophytosis by demonstrating fungal hyphae in skin scrapings?",
      correct: koh,
      explanation: "Direct microscopy of skin scrapings prepared with potassium hydroxide (KOH) can demonstrate fungal hyphae and confirm dermatophytosis. Culture or molecular testing is required when species-level identification is needed.",
    };
  }

  return { question, correct, explanation };
}

function applyVerifiedParasitologyWording(
  question: string,
  options: string[],
  correct: number,
  explanation: string,
): { question: string; correct: number; explanation: string } {
  if (/used for stage I East African sleeping sickness/i.test(question)) {
    let fexinidazole = options.findIndex((option) => /fexinidazole/i.test(option));
    if (fexinidazole < 0) {
      const replaceable = options.findIndex((option) => /^none of the above\.?$/i.test(option));
      if (replaceable >= 0) { options[replaceable] = "Fexinidazole"; fexinidazole = replaceable; }
    }
    if (fexinidazole >= 0) return {
      question: "According to current WHO guidance, which oral drug is first-line treatment for first- and second-stage East African (rhodesiense) sleeping sickness in eligible patients aged at least 6 years and weighing at least 20 kg?",
      correct: fexinidazole,
      explanation: "WHO guidance updated in 2024 recommends oral fexinidazole for eligible patients with first- or second-stage rhodesiense human African trypanosomiasis. Suramin remains an option for first-stage disease in younger or lighter children.",
    };
  }

  if (/parasite can be BEST treated with Metrifonate/i.test(question)) {
    const schistosoma = options.findIndex((option) => /Schistosoma haematobium/i.test(option));
    if (schistosoma >= 0) return {
      question: "Metrifonate was historically used primarily against infection with which parasite?",
      correct: schistosoma,
      explanation: "Metrifonate was used for urinary schistosomiasis caused by Schistosoma haematobium, but it has been withdrawn; praziquantel is the WHO-recommended treatment for schistosomiasis.",
    };
  }

  if (/which parasite can cause erosion of bones/i.test(question)) {
    const echinococcus = options.findIndex((option) => /Echinococcus granulosus/i.test(option));
    if (echinococcus >= 0) return {
      question: "Which listed parasite can cause osseous hydatid disease with destructive erosion of bone?",
      correct: echinococcus,
      explanation: "Echinococcus granulosus can rarely involve bone. Larval growth within marrow cavities and cancellous bone can cause extensive destructive erosion.",
    };
  }

  return { question, correct, explanation };
}

function applyVerifiedPathologyWording(
  question: string,
  options: string[],
  correct: number,
  explanation: string,
): { question: string; correct: number; explanation: string } {
  if (/^RB gene,\s*['“]the guardian of the genome/i.test(question)) return {
    question: "At which cell-cycle checkpoint does the RB tumour-suppressor protein principally act?",
    correct,
    explanation: "RB restrains progression from G1 into S phase by binding E2F transcription factors. The phrase ‘guardian of the genome’ refers to p53, not RB.",
  };

  if (/^A Granuloma is comprised of/i.test(question)) {
    const caseating = options.findIndex((option) => /central necrotic area.*epithelioid cells.*lymphocytes/i.test(option));
    if (caseating >= 0) return {
      question: "Which description best fits a caseating granuloma?",
      correct: caseating,
      explanation: "A caseating granuloma has central necrosis surrounded by epithelioid macrophages, often giant cells, and a peripheral lymphocytic cuff. Necrosis is not present in every granuloma.",
    };
  }

  if (/pathologic assessment of tumours/i.test(question)) {
    const grading = options.findIndex((option) => /^Grading is the degree of macroscopic and microscopic differentiation/i.test(option));
    const all = options.findIndex((option) => /^All of the above$/i.test(option));
    if (grading >= 0 && all >= 0) {
      options[grading] = "Grading assesses microscopic differentiation and other histologic features";
      return {
        question: "Which statement is true regarding the pathologic assessment of tumours?",
        correct: all,
        explanation: "Tumour grade is based on microscopic appearance and differentiation, whereas stage describes tumour extent and spread. TNM/AJCC systems are widely used for staging malignant tumours.",
      };
    }
  }

  return { question, correct, explanation };
}

function applyVerifiedHaematologyWording(
  question: string,
  options: string[],
  correct: number,
  explanation: string,
): { question: string; correct: number; explanation: string } {
  if (/32 weeks gestation.*schistocytic anemia.*ADAMTS13 is 45%/i.test(question)) {
    const hellp = options.findIndex((option) => /HELLP/i.test(option));
    if (hellp >= 0) return {
      question: "A 28-year-old woman at 32 weeks' gestation has severe hypertension, proteinuria, schistocytic haemolytic anaemia, platelets of 72,000/µL, AST 180 U/L, normal coagulation studies, and ADAMTS13 activity of 45%. What is the most likely diagnosis?",
      correct: hellp,
      explanation: "HELLP syndrome requires haemolysis, elevated liver enzymes, and low platelets. Severe hypertension and proteinuria support the associated pre-eclamptic picture. ADAMTS13 activity without severe deficiency makes immune TTP less likely, while normal coagulation studies make overt DIC less likely.",
    };
  }
  return { question, correct, explanation };
}

function applyVerifiedImmunohaematologyWording(
  question: string,
  options: string[],
  correct: number,
  explanation: string,
): { question: string; correct: number; explanation: string } {
  if (/warm autoimmune hemolytic anemia \(WAIH$/i.test(question)) {
    const continuation = options.findIndex((option) => /pan-reactive antibody screen/i.test(option));
    if (continuation >= 0) options.splice(continuation, 1);
    const allogeneic = options.findIndex((option) => /allogeneic adsorption/i.test(option));
    if (allogeneic >= 0) return {
      question: "In a recently transfused patient with warm autoimmune haemolytic anaemia and a pan-reactive antibody screen, which method is used to detect underlying alloantibodies?",
      correct: allogeneic,
      explanation: "Allogeneic adsorption using appropriately selected phenotype-matched reagent red cells removes the warm autoantibody so underlying alloantibodies can be investigated. Autologous adsorption is unsuitable after a recent transfusion because circulating donor red cells may be present.",
    };
  }

  if (/prevent Transfusion-Associated Graft-versus-Host Disease/i.test(question)) {
    const continuation = options.findIndex((option) => /immunocompromised bone marrow transplant recipient/i.test(option));
    if (continuation >= 0) options.splice(continuation, 1);
    const irradiation = options.findIndex((option) => /^irradiation$/i.test(option));
    if (irradiation >= 0) return {
      question: "Which blood-component modification is required to prevent transfusion-associated graft-versus-host disease (TA-GVHD) in an immunocompromised bone-marrow transplant recipient?",
      correct: irradiation,
      explanation: "Irradiation inactivates viable donor T lymphocytes and prevents their engraftment and proliferation in a susceptible recipient. Leukoreduction alone does not reliably prevent TA-GVHD.",
    };
  }

  if (/TRALI/i.test(question)) {
    const hlaHna = options.findIndex((option) => /HLA or Human Neutrophil Antigens/i.test(option));
    if (hlaHna >= 0) {
      options[hlaHna] = "HLA or human neutrophil antigens (HNA)";
      correct = hlaHna;
      if (!explanation) explanation = "Donor antibodies against recipient HLA or human neutrophil antigens can activate neutrophils in the pulmonary microvasculature and contribute to TRALI.";
    }
  }

  if (/open system.*red blood cells|red blood cells.*open system/i.test(question)) {
    const twentyFourHours = options.findIndex((option) => /^24 hours?$/i.test(option));
    if (twentyFourHours >= 0) return {
      question: "After a red-blood-cell unit is prepared or entered using an open system, how long may it be stored at 1–6°C?",
      correct: twentyFourHours,
      explanation: "An open system increases contamination risk, so the refrigerated red-cell component must be used within 24 hours. The four-hour limit applies when a component is kept outside controlled storage for transfusion, not to refrigerated open-system storage.",
    };
  }

  return { question, correct, explanation };
}

/**
 * Repairs legacy MCQ JSON without guessing clinical facts. Duplicate options
 * are removed, the original answer index is remapped, and an invalid index is
 * recovered only from an explicit answer-letter marker. Ambiguous questions
 * are withheld from exam mode for manual review.
 */
export function sanitizeMcqQuestions(raw: unknown): NormalizedMcqQuestion[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item: any) => {
    let question = cleanLegacyBoundaryText(item?.question);
    let explanation = cleanLegacyBoundaryText(item?.explanation);
    const sourceOptions = Array.isArray(item?.options) ? item.options : [];
    const options: string[] = [];
    const oldToNew = new Map<number, number>();
    sourceOptions.forEach((value: unknown, oldIndex: number) => {
      const option = cleanMcqOption(value);
      if (!option) return;
      const key = option.toLocaleLowerCase();
      let newIndex = options.findIndex((saved) => saved.toLocaleLowerCase() === key);
      if (newIndex < 0) newIndex = options.push(option) - 1;
      oldToNew.set(oldIndex, newIndex);
    });
    // WordPress quiz exports sometimes duplicated True/False and then appended
    // part of the explanation as choices C/D. A genuine boolean item has one
    // True and one False option only.
    const trueIndex = options.findIndex((option) => /^true$/i.test(option));
    const falseIndex = options.findIndex((option) => /^false$/i.test(option));
    if (trueIndex >= 0 && falseIndex >= 0) {
      const booleanOptions = [options[trueIndex], options[falseIndex]];
      const booleanMap = new Map<number, number>();
      oldToNew.forEach((mapped, oldIndex) => {
        if (mapped === trueIndex) booleanMap.set(oldIndex, 0);
        if (mapped === falseIndex) booleanMap.set(oldIndex, 1);
      });
      options.splice(0, options.length, ...booleanOptions);
      oldToNew.clear();
      booleanMap.forEach((mapped, oldIndex) => oldToNew.set(oldIndex, mapped));
    }
    if (!question || options.length < 2 || isKnownUnsafeLegacyQuestion(question)) return [];
    const sourceCorrect = Number(item?.correct_answer);
    const savedCorrectText = cleanMcqOption(item?.correct_answer_text);
    let correct = savedCorrectText
      ? options.findIndex((option) => option.toLocaleLowerCase() === savedCorrectText.toLocaleLowerCase())
      : undefined;
    if (correct === -1) correct = undefined;
    if (correct === undefined && Number.isInteger(sourceCorrect)) correct = oldToNew.get(sourceCorrect);
    if (correct === undefined) correct = answerIndexFromText(explanation, options);
    if (correct === undefined) return [];
    if (!explanation) {
      const split = splitEmbeddedExplanation(question, options[correct]);
      question = split.question;
      explanation = split.explanation || "";
    }
    ({ question, correct, explanation } = applyVerifiedClinicalOverride(question, options, correct, explanation));
    ({ question, correct, explanation } = applyVerifiedMycologyWording(question, options, correct, explanation));
    ({ question, correct, explanation } = applyVerifiedParasitologyWording(question, options, correct, explanation));
    ({ question, correct, explanation } = applyVerifiedPathologyWording(question, options, correct, explanation));
    ({ question, correct, explanation } = applyVerifiedHaematologyWording(question, options, correct, explanation));
    ({ question, correct, explanation } = applyVerifiedImmunohaematologyWording(question, options, correct, explanation));
    const normalized = {
      ...item,
      question,
      options,
      correct_answer: correct,
      explanation: explanation || undefined,
    };
    if (Object.prototype.hasOwnProperty.call(item, "correct_answer_text")) {
      normalized.correct_answer_text = options[correct];
    }
    return [normalized];
  });
}
