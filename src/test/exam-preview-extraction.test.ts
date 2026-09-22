import { describe, expect, it } from "vitest";
import { extractExamQuestions } from "@/lib/blog-content";

describe("exam preview extraction", () => {
  it("extracts papers where Question N is on its own line", () => {
    const result = extractExamQuestions(`
Question 1
Fish are second intermediate hosts of?

A. Echinostoma ilocaanum
B. Faciola hepatica
C. Fasciolopsis buski
D. Hymenolepis nana
E. Clonorchis sinensis

**Answer:
E. Clonorchis sinensis**
Explanation: Fish serve as the second intermediate host.

Question 2
Which of the following secretes defensive secretions to cause irritation on human skin?

A. Millipedes
B. Centipedes
C. Necator americanus
D. Enterobius vermicularis
E. All of the above
`);

    expect(result.mcqs.length).toBe(2);
    expect(result.mcqs[0]).toEqual(expect.objectContaining({
      stem: "Fish are second intermediate hosts of?",
      opts: expect.arrayContaining(["Echinostoma ilocaanum", "Clonorchis sinensis"]),
    }));
    expect(result.mcqs[1].stem).toContain("defensive secretions");
  });

  it("does not return the empty-preview state for a numbered essay paper", () => {
    const result = extractExamQuestions(`
Question 1
Discuss the life cycle and medical importance of ticks.

Question 2
Describe the prevention of mosquito-borne disease.
`);

    expect(result.mcqs).toHaveLength(0);
    expect(result.essays).toHaveLength(2);
  });
});
