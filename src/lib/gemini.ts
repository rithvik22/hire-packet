import { SchemaType, type ResponseSchema } from "@google/generative-ai";
import { extractJdHeuristic } from "@/lib/extract";
import { assemblePacket, heuristicNarrative } from "@/lib/assemble";
import { callModel } from "@/lib/gemini-client";
import { logEvent } from "@/lib/log";
import { matchJob } from "@/lib/match";
import { JdExtractionSchema, NarrativeSchema } from "@/lib/schema";
import { geminiNarrativeEnabled } from "@/lib/gemini-budget";
import { wrapUntrustedJd } from "@/lib/sanitize";
import { computeScore } from "@/lib/scoring";
import type { CandidateResume, HirePacketResult, JdExtraction, PacketNarrative, RequirementMatch } from "@/lib/types";

const EXTRACT_SCHEMA: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    role: { type: SchemaType.STRING },
    requiredSkills: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    preferredSkills: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    responsibilities: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    minimumExperience: { type: SchemaType.NUMBER },
    education: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
  },
  required: ["role", "requiredSkills"],
};

const NARRATIVE_SCHEMA: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    summary: { type: SchemaType.STRING },
    whyInterview: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    interviewQuestions: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          question: { type: SchemaType.STRING },
          basedOn: { type: SchemaType.STRING, format: "enum", enum: ["evidence", "gap"] },
          context: { type: SchemaType.STRING },
        },
        required: ["question", "basedOn", "context"],
      },
    },
    recruiterPitch: { type: SchemaType.STRING },
  },
  required: ["summary", "whyInterview", "interviewQuestions", "recruiterPitch"],
};

function extractPrompt(jobDescription: string): string {
  return `Extract hiring requirements from the job description. Return JSON only.
Do not score a candidate. Do not mention any person. Do not invent requirements that are not in the JD.
Schema: { role, requiredSkills[], preferredSkills[], responsibilities[], minimumExperience, education[] }
minimumExperience is a number of years (0 if unspecified).
${wrapUntrustedJd(jobDescription)}`;
}

function narrativePrompt(extraction: JdExtraction, matches: RequirementMatch[], fitScore: number): string {
  const verified = matches.map((m) => ({
    requirement: m.requirement,
    status: m.status,
    evidence: m.evidence,
    gap: m.gap,
    transferable: m.transferable,
  }));
  return `Write recruiter-facing copy from VERIFIED MATCHES only.
Do not add employers, skills, or evidence that are not in VERIFIED MATCHES.
Do not change the fit score. It is ${fitScore} and already calculated in code.
Put [SCORE] in the recruiterPitch where the number belongs.
whyInterview: top five matching qualifications, quoting evidence strings.
interviewQuestions: five questions tied to specific evidence or gaps.
recruiterPitch: short forward-ready email starting with "Subject: ".

ROLE: ${extraction.role}

VERIFIED MATCHES:
${JSON.stringify(verified, null, 2)}`;
}

export function parseJdExtraction(raw: unknown): JdExtraction {
  const parsed = JdExtractionSchema.parse(raw);
  return {
    role: parsed.role,
    requiredSkills: parsed.requiredSkills,
    preferredSkills: parsed.preferredSkills,
    responsibilities: parsed.responsibilities,
    minimumExperience: parsed.minimumExperience,
    education: parsed.education,
  };
}

const jdExtractCache = new Map<string, { extraction: JdExtraction; mode: "gemini" | "heuristic" }>();

export async function extractJob(jobDescription: string): Promise<{
  extraction: JdExtraction;
  mode: "gemini" | "heuristic";
}> {
  const cacheKey = jobDescription.trim();
  const cached = jdExtractCache.get(cacheKey);
  if (cached) return cached;

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  let result: { extraction: JdExtraction; mode: "gemini" | "heuristic" };
  if (apiKey) {
    try {
      const raw = await callModel(apiKey, extractPrompt(jobDescription), EXTRACT_SCHEMA, 0, {
        models: ["gemini-2.0-flash"],
        maxAttempts: 1,
      });
      result = { extraction: parseJdExtraction(raw), mode: "gemini" };
    } catch {
      result = { extraction: extractJdHeuristic(jobDescription), mode: "heuristic" };
    }
  } else {
    result = { extraction: extractJdHeuristic(jobDescription), mode: "heuristic" };
  }
  jdExtractCache.set(cacheKey, result);
  return result;
}

export function packetForResume(
  extraction: JdExtraction,
  resume: CandidateResume,
  mode: "gemini" | "heuristic"
): HirePacketResult {
  const buckets = matchJob(extraction, resume);
  const fitScore = computeScore(buckets).total;
  const flat = Object.values(buckets).flat();
  const narrative = heuristicNarrative(extraction, flat, fitScore, resume);
  return assemblePacket(extraction, buckets, narrative, mode, resume);
}

export async function generateHirePacket(
  jobDescription: string,
  resume: CandidateResume
): Promise<HirePacketResult> {
  const { extraction, mode: extractMode } = await extractJob(jobDescription);
  const buckets = matchJob(extraction, resume);
  const fitScore = computeScore(buckets).total;
  const flat = Object.values(buckets).flat();

  let narrative: PacketNarrative = heuristicNarrative(extraction, flat, fitScore, resume);
  let mode: "gemini" | "heuristic" = extractMode;
  const apiKey = process.env.GEMINI_API_KEY?.trim();

  if (apiKey && extractMode === "gemini" && geminiNarrativeEnabled()) {
    try {
      const raw = await callModel(apiKey, narrativePrompt(extraction, flat, fitScore), NARRATIVE_SCHEMA, 0.3, {
        models: ["gemini-2.0-flash"],
        maxAttempts: 1,
      });
      narrative = NarrativeSchema.parse(raw);
      mode = "gemini";
    } catch {
      logEvent("narrative_fallback", { ok: true });
    }
  }

  const packet = assemblePacket(extraction, buckets, narrative, mode, resume);
  logEvent("packet_generated", {
    mode: packet.mode,
    score: packet.fitScore,
    slug: packet.slug,
    reqCount: packet.requirements.length,
  });
  return packet;
}

export async function generateHirePackets(
  jobDescription: string,
  resumes: CandidateResume[],
  confirmed?: JdExtraction
): Promise<{ role: string; mode: "gemini" | "heuristic"; packets: HirePacketResult[]; extraction: JdExtraction }> {
  const extracted = confirmed
    ? { extraction: confirmed, mode: "heuristic" as const }
    : await extractJob(jobDescription);
  const { extraction, mode } = extracted;
  const packets = resumes.map((resume) => {
    const packet = packetForResume(extraction, resume, mode);
    logEvent("packet_generated", {
      mode: packet.mode,
      score: packet.fitScore,
      slug: packet.slug,
      reqCount: packet.requirements.length,
    });
    return packet;
  });
  return { role: extraction.role, mode, packets, extraction };
}
