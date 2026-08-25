import { describe, expect, it } from "vitest";
import { sampleCandidateResume } from "@/data/resume";
import { assemblePacket, heuristicNarrative } from "@/lib/assemble";
import { MOCK_JD_EXTRACTION } from "@/lib/mocks/gemini";
import { enforceNoStrongWithoutEvidence, matchJob, matchRequirement } from "@/lib/match";
import { CandidateResumeSchema, JdExtractionSchema } from "@/lib/schema";
import { computeScore } from "@/lib/scoring";
import type { CandidateResume } from "@/lib/types";

const sample = sampleCandidateResume();

function designerResume(): CandidateResume {
  return {
    candidate: "Alex Rivera",
    headline: "Product Designer",
    location: "Austin, TX",
    email: "alex@example.com",
    phone: "",
    linkedin: "",
    github: "",
    portfolio: "",
    yearsExperience: 6,
    skills: ["Figma", "User research", "Prototyping"],
    experience: [
      {
        company: "Northwind",
        role: "Product Designer",
        location: "Austin",
        start: "2020",
        end: "Present",
        evidence: ["Shipped Figma design systems and user-research studies for a B2B dashboard."],
      },
    ],
    education: ["BFA, Graphic Design — RISD (2018)"],
    certifications: [],
    projects: [],
  };
}

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
    const match = matchRequirement("Node.js APIs", "requiredSkills", sample);
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
    const match = matchRequirement("Telephony / SIP / Twilio", "preferredSkills", sample);
    expect(match.status).toBe("gap");
    expect(match.evidence).toHaveLength(0);
    expect(match.transferable).toMatch(/Socket\.IO/);
  });

  it("does not reuse the sample resume when matching another candidate", () => {
    const match = matchRequirement("Node.js APIs", "requiredSkills", designerResume());
    expect(match.status).toBe("gap");
    expect(match.evidence.join(" ")).not.toMatch(/Healthvice/);
  });
});

describe("assemblePacket", () => {
  it("computes the score in code from verified matches", () => {
    const buckets = matchJob(MOCK_JD_EXTRACTION, sample);
    const score = computeScore(buckets).total;
    const packet = assemblePacket(
      MOCK_JD_EXTRACTION,
      buckets,
      heuristicNarrative(MOCK_JD_EXTRACTION, Object.values(buckets).flat(), score, sample),
      "heuristic",
      sample
    );
    expect(packet.fitScore).toBe(score);
    expect(packet.candidate.name).toBe(sample.candidate);
    expect(packet.recommendation).toMatch(/fit/);
    expect(packet.requirements.find((r) => r.status === "strong_match")?.evidence.length).toBeGreaterThan(0);
    expect(packet.gaps.transferable.map((g) => `${g.requirement} ${g.note}`).join(" ")).toMatch(/telephony/i);
    expect(packet.sharePath).toBe("/p/retell-full-stack");
  });
});

describe("CandidateResumeSchema", () => {
  it("accepts the sample candidate", () => {
    const parsed = CandidateResumeSchema.parse(sample);
    expect(parsed.candidate).toMatch(/Rithvik/);
    expect(parsed.experience.length).toBeGreaterThan(0);
  });
});
