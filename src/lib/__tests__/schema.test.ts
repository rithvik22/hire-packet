import { describe, expect, it } from "vitest";
import { assemblePacket, heuristicNarrative } from "@/lib/assemble";
import { MOCK_JD_EXTRACTION } from "@/lib/mocks/gemini";
import { enforceNoStrongWithoutEvidence, matchJob, matchRequirement } from "@/lib/match";
import { JdExtractionSchema } from "@/lib/schema";
import { computeScore } from "@/lib/scoring";

describe("Zod JD extraction schema", () => {
  it("accepts the mock Gemini JD payload", () => {
    const parsed = JdExtractionSchema.parse(MOCK_JD_EXTRACTION);
    expect(parsed.role).toMatch(/Full-Stack/);
    expect(parsed.minimumExperience).toBe(4);
  });

  it("rejects an empty requiredSkills list", () => {
    expect(() =>
      JdExtractionSchema.parse({
        ...MOCK_JD_EXTRACTION,
        requiredSkills: [],
      })
    ).toThrow();
  });
});

describe("requirement matching", () => {
  it("attaches exact Healthvice evidence to Node.js", () => {
    const match = matchRequirement("Node.js APIs", "requiredSkills");
    expect(match.status).toBe("strong_match");
    expect(match.evidence.join(" ")).toMatch(/Healthvice/);
    expect(match.evidence.join(" ")).toMatch(/Node/);
  });

  it("cannot mark strong_match without evidence", () => {
    const demoted = enforceNoStrongWithoutEvidence({
      requirement: "COBOL",
      status: "strong_match",
      evidence: [],
      gap: null,
      transferable: null,
      category: "requiredSkills",
    });
    expect(demoted.status).toBe("gap");
  });

  it("treats telephony as a gap with transferable real-time proof", () => {
    const match = matchRequirement("Telephony / SIP / Twilio", "preferredSkills");
    expect(match.status).toBe("gap");
    expect(match.evidence).toHaveLength(0);
    expect(match.transferable).toMatch(/Socket\.IO/);
  });
});

describe("assemblePacket", () => {
  it("computes the score in code from verified matches", () => {
    const buckets = matchJob(MOCK_JD_EXTRACTION);
    const score = computeScore(buckets).total;
    const packet = assemblePacket(
      MOCK_JD_EXTRACTION,
      buckets,
      heuristicNarrative(MOCK_JD_EXTRACTION, Object.values(buckets).flat(), score),
      "heuristic"
    );
    expect(packet.fitScore).toBe(score);
    expect(packet.recommendation).toMatch(/fit/);
    expect(packet.requirements.find((r) => r.status === "strong_match")?.evidence.length).toBeGreaterThan(0);
    expect(packet.gaps.transferable.map((g) => `${g.requirement} ${g.note}`).join(" ")).toMatch(/telephony/i);
    expect(packet.sharePath).toBe("/rithvik/retell-full-stack");
  });
});
