export type ContestStage = "concept" | "registration" | "live" | "completed";

export interface ContestPreview {
  slug: string;
  title: string;
  subtitle: string;
  stage: ContestStage;
  subjects: string[];
  years: number[];
  format: string;
  teams: string;
}

export const FLAGSHIP_CONTEST: ContestPreview = {
  slug: "inter-university-medical-challenge",
  title: "Inter-University Medical Challenge",
  subtitle: "A national knowledge arena for Kenya's next generation of clinicians.",
  stage: "concept",
  subjects: ["Anatomy", "Physiology", "Pathology", "Microbiology"],
  years: [1, 2, 3],
  format: "Qualifiers → Semifinal → Grand final",
  teams: "University teams and individual representatives",
};

export const CONTEST_RULES = [
  "Use one verified OmpathStudy account and represent only one institution.",
  "Remain in fullscreen during a protected round unless a moderator instructs otherwise.",
  "Tab changes, fullscreen exits and connection events are logged for review.",
  "An integrity alert is not automatic proof of misconduct; moderators review the event log.",
  "Contest questions are locked before the round and scored from an immutable answer key.",
  "Qualification and elimination thresholds are published before each contest begins.",
];

export const UNIVERSITY_LEADERS = [
  { position: 1, name: "Awaiting inaugural champion", points: "—" },
  { position: 2, name: "The first season will establish the table", points: "—" },
  { position: 3, name: "No university has been ranked yet", points: "—" },
];
