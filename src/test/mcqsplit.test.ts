import { describe, it, expect } from "vitest";
import { preprocessContent } from "@/lib/blog-content";
describe("mcq preprocessing", () => {
  it("preserves standalone markdown image URLs exactly", () => {
    const image = "![Blood film](https://cdn.example.org/path/image-one.jpg)";
    expect(preprocessContent(image)).toBe(image);
  });

  it("separates an image glued between a question heading and its answer", () => {
    const input = "## Q1: Identify the organelle![Rough ER](https://cdn.example.org/q1.jpg)**Answer:**\n- Protein synthesis";
    expect(preprocessContent(input).split("\n").filter(Boolean)).toEqual([
      "## Q1: Identify the organelle",
      "![Rough ER](https://cdn.example.org/q1.jpg)",
      "**Answer:**",
      "- Protein synthesis",
    ]);
  });

  it("repairs imported line breaks inside image alt text", () => {
    const input = "## Q2: Name A and B![Mitochondrion (\nA) and rough ER (B)](https://cdn.example.org/q2.jpg)**Answer:**\n- A — mitochondrion";
    expect(preprocessContent(input)).toContain(
      "\n![Mitochondrion ( A) and rough ER (B)](https://cdn.example.org/q2.jpg)\n**Answer:**",
    );
  });

  it("splits glued choice runs with inline (a)/(b) references", () => {
    expect(preprocessContent("Entner pathway is NOT found in: A. Aerobic prokaryotesB. Anaerobic prokaryotesC. Both (a) and (b)D. Eukaryotes E. Atypical").split("\n"))
      .toEqual(["Entner pathway is NOT found in", "A) Aerobic prokaryotes", "B) Anaerobic prokaryotes", "C) Both (a) and (b)", "D) Eukaryotes", "E) Atypical"]);
  });

  it("splits lowercase choices glued directly to the previous choice", () => {
    const input = "a) They directly activate T cellsb) They recognize mediatorsc) They release cytokinesd) They form antibodiese) They suppress inflammation";
    expect(preprocessContent(input).split("\n")).toEqual([
      "A) They directly activate T cells",
      "B) They recognize mediators",
      "C) They release cytokines",
      "D) They form antibodies",
      "E) They suppress inflammation",
    ]);
  });

  it("normalizes imported Unicode bullets", () => {
    expect(preprocessContent("• Inspect the conjunctiva\n◦ Check hydration").split("\n")).toEqual([
      "- Inspect the conjunctiva",
      "- Check hydration",
    ]);
  });
  it("leaves medical prose alone", () => {
    const prose = "Spores of B. subtilis and C. tetani were compared in the assay.";
    expect(preprocessContent(prose).trim()).toBe(prose);
  });
});
