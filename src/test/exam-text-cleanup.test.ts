import { describe, expect, it } from "vitest";
import { cleanExamText } from "@/lib/mcq-normalization";

describe("cleanExamText", () => {
  it("removes visible LaTeX delimiters while preserving scientific meaning", () => {
    expect(cleanExamText("Vitamin $\\text{B}_1$ and $\\alpha$-ketoglutarate"))
      .toBe("Vitamin B_1 and α-ketoglutarate");
    expect(cleanExamText("$\\text{H}_2\\text{PO}_4^-$"))
      .toBe("H_2PO_4^-");
  });
});
