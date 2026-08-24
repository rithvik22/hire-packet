import { candidate } from "@/data/candidate";
import { resume } from "@/data/resume";
import { slugify } from "@/lib/slug";
import { computeScore, recommendationFromScore } from "@/lib/scoring";
import type {
  HirePacketResult,
  JdExtraction,
  PacketNarrative,
  RequirementMatch,
  ScoreCategory,
} from "@/lib/types";
import { AI_DISCLOSURE } from "@/lib/types";

const CATEGORY_ORDER: ScoreCategory[] = [
  "requiredSkills",
  "experience",
  "responsibilities",
  "preferredSkills",
  "education",
];

export function heuristicNarrative(
  extraction: JdExtraction,
  matches: RequirementMatch[],
  fitScore: number
): PacketNarrative {
  const strong = matches.filter((m) => m.status === "strong_match");
  const gaps = matches.filter((m) => m.status === "gap");
  const whyInterview = strong.slice(0, 5).map((m) => m.evidence[0] || m.requirement);
  while (whyInterview.length < 3) {
    whyInterview.push(`${resume.experience[0]?.role} at ${resume.experience[0]?.company}.`);
  }

  const questions = [
    {
      question: `Walk through this evidence: ${strong[0]?.evidence[0] ?? "your WellFed architecture"}. What did you own?`,
      basedOn: "evidence" as const,
      context: strong[0]?.requirement ?? "ownership",
    },
    {
      question: "How did you put production RAG or LLM workflows behind auth and evals?",
      basedOn: "evidence" as const,
      context: "AI workflows",
    },
    {
      question: "Describe an event-driven flow you shipped (Kafka, Socket.IO, or webhooks) and how it failed safely.",
      basedOn: "evidence" as const,
      context: "real-time",
    },
    gaps[0]
      ? {
          question: `The JD asks for ${gaps[0].requirement}. ${gaps[0].transferable ?? "How would you ramp in 30 days?"}`,
          basedOn: "gap" as const,
          context: gaps[0].requirement,
        }
      : {
          question: "Which JD requirements would you stress-test in week one?",
          basedOn: "evidence" as const,
          context: "90-day plan",
        },
    {
      question: "How do you approach OWASP hardening and RBAC on a new customer-facing API?",
      basedOn: "evidence" as const,
      context: "auth",
    },
  ];

  return {
    summary: `${candidate.name} is a ${extraction.role} candidate with verified proof on ${strong
      .slice(0, 4)
      .map((s) => s.requirement)
      .join(", ") || "core full-stack work"}. Fit score ${fitScore}/100 was calculated in code from weighted categories. Gaps are listed honestly.`,
    whyInterview: whyInterview.slice(0, 5),
    interviewQuestions: questions,
    recruiterPitch: `Subject: ${candidate.name} for ${extraction.role}\n\nHi — sharing a hire packet for ${candidate.name}. Fit score [SCORE]/100, calculated in code (required 35 / experience 25 / responsibilities 20 / preferred 10 / education 10).\n\nEvery strong match cites a frozen resume bullet. Gemini did not invent employers. Gaps include transferable notes where adjacent experience exists.\n\nHappy to intro.`,
  };
}

export function assemblePacket(
  extraction: JdExtraction,
  buckets: Record<ScoreCategory, RequirementMatch[]>,
  narrative: PacketNarrative,
  mode: "gemini" | "heuristic"
): HirePacketResult {
  const scoreBreakdown = computeScore(buckets);
  const fitScore = scoreBreakdown.total;
  const recommendation = recommendationFromScore(fitScore);
  const slug = /retell/i.test(extraction.role)
    ? "retell-full-stack"
    : slugify(extraction.role, "full-stack");

  const requirements: RequirementMatch[] = [];
  const seen = new Set<string>();
  for (const category of CATEGORY_ORDER) {
    for (const row of buckets[category]) {
      const key = row.requirement.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      requirements.push(row);
    }
  }

  const missing = requirements
    .filter((r) => r.status === "gap" && !r.transferable)
    .map((r) => ({ requirement: r.requirement, note: r.gap || "No direct production experience." }));
  const transferable = requirements
    .filter((r) => r.status === "gap" && r.transferable)
    .map((r) => ({ requirement: r.requirement, note: r.transferable as string }));
  const discuss = transferable.slice(0, 4).map((g) => ({
    requirement: g.requirement,
    note: "Worth a 10-minute probe: closest analog on the resume and a 30-day ramp.",
  }));

  const pitch = narrative.recruiterPitch.split("[SCORE]").join(String(fitScore));

  return {
    fitScore,
    scoreBreakdown,
    recommendation,
    summary: narrative.summary,
    roleGuess: extraction.role,
    seniority: /senior|lead|staff/i.test(extraction.role) ? "Senior / Lead" : "Mid–Senior",
    slug,
    requirements,
    gaps: { missing: missing.slice(0, 6), transferable: transferable.slice(0, 6), discuss },
    interviewQuestions: narrative.interviewQuestions.slice(0, 5),
    whyInterview: narrative.whyInterview.slice(0, 5),
    recruiterPitch: pitch,
    mode,
    disclosure: AI_DISCLOSURE,
    generatedAt: new Date().toISOString(),
    sharePath: `/rithvik/${slug}`,
  };
}
