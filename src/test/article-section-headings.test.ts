import { describe, expect, it } from "vitest";
import { isDuplicateArticleHeading, isLikelyStandaloneSectionHeading, preprocessContent } from "@/lib/blog-content";

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

  it("removes import notices and preserves decimal section headings", () => {
    const result = preprocessContent("*This complete cardiovascular guide is split into 3 parts for easier reading.*\nAll 72 source pages were processed. Internal note.\n### 1.0 Introduction\nThe circulatory system is a continuous circuit.");
    expect(result).not.toContain("split into 3 parts");
    expect(result).not.toContain("source pages were processed");
    expect(result).toContain("### 1.0 Introduction");
  });

  it("recognizes a body title that repeats the article title", () => {
    expect(isDuplicateArticleHeading(
      "Cardiovascular System Examination — Complete Study Guide",
      "Cardiovascular System Examination — Anatomy, Physiology & History Taking — Notes",
    )).toBe(true);
    expect(isDuplicateArticleHeading("Topic 1: Review of Anatomy", "Cardiovascular System Examination")).toBe(false);
  });
});
