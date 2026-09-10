import { describe, expect, it } from "vitest";
import { rebalanceMcqAnswerLetters } from "@/lib/store";

describe("MCQ answer-position balancing", () => {
  const bank = Array.from({ length: 20 }, (_, index) => ({
    question: `Question ${index + 1}`,
    options: [`wrong-${index}-a`, `correct-${index}`, `wrong-${index}-c`, `wrong-${index}-d`, `wrong-${index}-e`],
    correct_answer: 1,
  }));

  it("spreads answers evenly without adjacent repeats or changing the answer", () => {
    const balanced = rebalanceMcqAnswerLetters(bank);
    const counts = [0, 0, 0, 0, 0];

    balanced.forEach((question, index) => {
      counts[question.correct_answer] += 1;
      expect(question.options[question.correct_answer]).toBe(`correct-${index}`);
      expect(question.correct_answer_text).toBe(`correct-${index}`);
      if (index > 0) expect(question.correct_answer).not.toBe(balanced[index - 1].correct_answer);
    });

    expect(counts).toEqual([4, 4, 4, 4, 4]);
    expect(rebalanceMcqAnswerLetters(bank)).toEqual(balanced);
  });

  it("keeps answer identity across repeated balancing", () => {
    const once = rebalanceMcqAnswerLetters(bank);
    const twice = rebalanceMcqAnswerLetters(once);

    twice.forEach((question, index) => {
      expect(question.options[question.correct_answer]).toBe(`correct-${index}`);
      expect(question.correct_answer_text).toBe(`correct-${index}`);
    });
  });

  it("uses answer text as the authority when the stored index is stale", () => {
    const [balanced] = rebalanceMcqAnswerLetters([{
      question: "Which organism causes diphtheria?",
      options: ["Streptococcus pyogenes", "Corynebacterium diphtheriae", "Neisseria meningitidis"],
      correct_answer: 0,
      correct_answer_text: "Corynebacterium diphtheriae",
    }]);

    expect(balanced.options[balanced.correct_answer]).toBe("Corynebacterium diphtheriae");
    expect(balanced.correct_answer_text).toBe("Corynebacterium diphtheriae");
  });

  it("leaves essay and malformed items untouched", () => {
    const items = [{ question: "Essay", type: "essay" }, { question: "Broken", options: ["A"], correct_answer: 0 }];
    expect(rebalanceMcqAnswerLetters(items)).toEqual(items);
  });
});
