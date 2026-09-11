// Static Year 3 subunit -> semester lookup, confirmed against the MKU course
// September-December 2026 teaching timetable. The catalogue uses two
// semesters; the previous three-way split was not supported by the timetable.
// Only non-course documents (exam timetables, department admin docs) are
// deliberately left unmapped — they get a separate "Reference" link instead
// of a fake semester.
export const YEAR3_SEMESTER: Record<string, 1 | 2> = {
  // Canonical course-level catalogue (September 2026 consolidation).
  "Medical Microbiology I — Bacteriology & Parasitology": 1,
  "Systemic Pathology I": 2,
  "Hematology II": 2,
  "Systemic Pathology II": 2,
  "Hematology & Blood Transfusion III": 2,
  "Medical Microbiology II — Virology & Mycology": 2,
  "Clinical Techniques": 2,
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

  "Neuropathology": 2,
  "Bone and Soft Tissue Pathology": 2,
  "Breast Pathology": 2,
  "Dermatopathology": 2,
  "Male Reproductive and Urinary System Pathology": 2,
  "Immunopathology": 1,
  "Medical Mycology": 2,
  "Medical Virology": 2,
  "Introduction to Clinical Techniques": 2,
  "Spot/Practical Examination": 1,
  "Community Health": 2,
  "Basic Pharmacology III": 2,
  "Hematopathology III": 2,
  "Blood Transfusion": 2,
  "Pathology Practical Revision Guide": 1,
};

export function getYear3Semester(subunitName: string): 1 | 2 | null {
  return YEAR3_SEMESTER[subunitName] ?? null;
}

export const OTHER_UNITS_LABEL = "Reference";

/** Sort key so "Semester 1" < "Semester 2" < "Other Units". */
export function semesterGroupSortKey(label: string): number {
  const m = label.match(/^Semester (\d)$/);
  if (m) return Number(m[1]);
  return 99;
}
