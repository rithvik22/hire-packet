import { describe, expect, it } from "vitest";
import { computeScore, pointsForStatus, recommendationFromScore, scoreCategory } from "@/lib/scoring";
import type { RequirementMatch } from "@/lib/types";

const row = (status: RequirementMatch["status"]): RequirementMatch => ({
  requirement: "x",
  status,
  evidence: status === "gap" ? [] : ["proof"],
  gap: status === "gap" ? "none" : null,
  transferable: null,
  category: "requiredSkills",
});

const strong = (n: number) => Array.from({ length: n }, () => row("strong_match"));
const gap = (n: number) => Array.from({ length: n }, () => row("gap"));
const mixed = [row("strong_match"), row("partial_match"), row("gap")];

describe("pointsForStatus", () => {
  it("maps strong_match / partial_match / gap", () => {
    expect(pointsForStatus("strong_match")).toBe(1);
    expect(pointsForStatus("partial_match")).toBe(0.5);
    expect(pointsForStatus("gap")).toBe(0);
  });
});

describe("scoreCategory", () => {
  it("gives full points when every item is a strong match", () => {
    expect(scoreCategory(strong(4), 35)).toBe(35);
  });

  it("gives zero when every item is a gap", () => {
    expect(scoreCategory(gap(3), 25)).toBe(0);
  });

  it("averages strong, partial, and gap", () => {
    expect(scoreCategory(mixed, 30)).toBe(15);
  });
});

describe("computeScore", () => {
  it("returns 100 when every present category is all-strong", () => {
    const result = computeScore({
      requiredSkills: strong(3),
      experience: strong(2),
      responsibilities: strong(2),
      education: strong(1),
      preferredSkills: strong(2),
    });
    expect(result.total).toBe(100);
    expect(result.requiredSkills.earned).toBe(35);
  });

  it("returns 0 when every present category is all-gap", () => {
    const result = computeScore({
      requiredSkills: gap(3),
      experience: gap(1),
      responsibilities: gap(1),
      education: gap(1),
      preferredSkills: gap(1),
    });
    expect(result.total).toBe(0);
  });
});

describe("recommendationFromScore", () => {
  it("uses Strong / Possible / Weak fit", () => {
    expect(recommendationFromScore(90)).toBe("strong_fit");
    expect(recommendationFromScore(60)).toBe("possible_fit");
    expect(recommendationFromScore(20)).toBe("weak_fit");
  });
});
