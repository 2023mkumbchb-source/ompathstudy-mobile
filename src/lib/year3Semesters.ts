// Static Year 3 subunit -> semester lookup, confirmed against the MKU Human
// Pathology course outline and the September-December 2026 Trimester 1
// teaching timetable. The outline explicitly defines three semesters.
// Only non-course documents (exam timetables, department admin docs) are
// deliberately left unmapped — they get a separate "Reference" link instead
// of a fake semester.
export const YEAR3_SEMESTER: Record<string, 1 | 2 | 3> = {
  // Canonical course-level catalogue (September 2026 consolidation).
  "Medical Microbiology I — Bacteriology & Parasitology": 1,
  "Systemic Pathology I": 2,
  "Hematology II": 2,
  "Systemic Pathology II": 3,
  "Hematology & Blood Transfusion III": 3,
  "Medical Microbiology II — Virology & Mycology": 3,
  "Clinical Techniques": 3,
  "Pathology Practical": 1,

  // Legacy aliases remain readable for old links and unpublished drafts.
  "General Pathology": 1,
  "Oncopathology": 1,
  "Genetic Disorders": 1,
  "Histopathology & Cytopathology": 1,
  "Bacteriology": 1,
  "Parasitology": 1,
  "Nutrition and Dietetics": 1,
  "Basic Pharmacology I": 1,
  "Chemical Pathology I": 1,

  "Cardiovascular System Pathology": 2,
  "Respiratory System Pathology": 2,
  "Gastrointestinal Pathology": 2,
  "Female Reproductive System Pathology": 2,
  "Head & Neck Pathology": 2,
  "Endocrine and Metabolic Pathology": 2,
  "Research Methodology and Proposal Writing": 2,
  "Basic Pharmacology II": 2,
  "Chemical Pathology II": 2,
  "Hematopathology": 2,
  "Hematopathology II": 2,

  "Neuropathology": 3,
  "Bone and Soft Tissue Pathology": 3,
  "Breast Pathology": 3,
  "Dermatopathology": 3,
  "Male Reproductive and Urinary System Pathology": 3,
  "Immunopathology": 1,
  "Medical Mycology": 3,
  "Medical Virology": 3,
  "Introduction to Clinical Techniques": 3,
  "Spot/Practical Examination": 3,
  "Community Health": 3,
  "Basic Pharmacology III": 3,
  "Hematopathology III": 3,
  "Blood Transfusion": 3,
  "Pathology Practical Revision Guide": 3,
};

export function getYear3Semester(subunitName: string): 1 | 2 | 3 | null {
  return YEAR3_SEMESTER[subunitName] ?? null;
}

export const OTHER_UNITS_LABEL = "Reference";

/** Sort key so "Semester 1" < "Semester 2" < "Other Units". */
export function semesterGroupSortKey(label: string): number {
  const m = label.match(/^Semester (\d)$/);
  if (m) return Number(m[1]);
  return 99;
}
