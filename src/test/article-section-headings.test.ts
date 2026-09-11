import { describe, expect, it } from "vitest";
import { isLikelyStandaloneSectionHeading } from "@/lib/blog-content";

describe("imported article section headings", () => {
  it("promotes isolated medical section labels", () => {
    expect(isLikelyStandaloneSectionHeading("The Heart", "", "The heart is a four chambered pump.")).toBe(true);
    expect(isLikelyStandaloneSectionHeading("CARDIAC OUTPUT", "", "The five basic mechanisms are:")).toBe(true);
    expect(isLikelyStandaloneSectionHeading("Functions of the Circulatory System", "", "1) Transportation")).toBe(true);
  });

  it("keeps captions, prose, and list items out of the heading hierarchy", () => {
    expect(isLikelyStandaloneSectionHeading("Figure 2: The Heart", "", "")).toBe(false);
    expect(isLikelyStandaloneSectionHeading("Blood carries hormones", "Previous paragraph", "")).toBe(false);
    expect(isLikelyStandaloneSectionHeading("1) Transportation", "", "")).toBe(false);
    expect(isLikelyStandaloneSectionHeading("This is a complete sentence.", "", "")).toBe(false);
  });
});
