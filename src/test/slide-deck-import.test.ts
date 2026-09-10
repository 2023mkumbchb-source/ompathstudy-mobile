import { describe, expect, it } from "vitest";
import { parseSlideDeck } from "@/components/SlideDeck";

describe("legacy question-bank deck parsing", () => {
  it("keeps glued pictures and answers in their matching reveal cards", () => {
    const content = [1, 2, 3]
      .map(
        (number) =>
          `## Q${number}: Identify structure ${number}![Plate ${number}](https://cdn.example.org/q${number}.jpg)**Answer:**\n- Structure ${number}\n- Key feature ${number}`,
      )
      .join("\n\n---\n");

    const deck = parseSlideDeck(content);

    expect(deck?.slides).toHaveLength(3);
    expect(deck?.slides[0]).toMatchObject({
      number: "1",
      prompt: "Identify structure 1",
      image: "https://cdn.example.org/q1.jpg",
      alt: "Plate 1",
    });
    expect(deck?.slides[0].rows.map((row) => row.term)).toEqual([
      "Structure 1",
      "Key feature 1",
    ]);
  });
});
