import { describe, expect, it } from "vitest";
import { getResourceSection } from "@/lib/store";

const row = (overrides: Record<string, string | undefined>) => ({
  title: "Medical resource",
  category: "Year 3: Pathology",
  content_kind: "notes",
  content_type: "Notes",
  exam_type: undefined,
  ...overrides,
});

describe("canonical resource sections", () => {
  it("keeps ordinary notes in Library", () => {
    expect(getResourceSection(row({ title: "Medical Parasitology Revision Notes" }))).toBe("notes");
  });

  it("prioritizes assessment metadata over stale imported kinds", () => {
    expect(getResourceSection(row({ title: "Paper Two", content_kind: "notes", exam_type: "Past Paper" }))).toBe("exam");
    expect(getResourceSection(row({ title: "Continuous Assessment", content_type: "CAT" }))).toBe("cat");
  });

  it("puts practice banks in MCQs", () => {
    expect(getResourceSection(row({ title: "Haematology MCQs", content_type: "MCQ Bank", content_kind: "mcq" }))).toBe("mcq");
  });
});
