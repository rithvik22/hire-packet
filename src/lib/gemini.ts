import { GoogleGenerativeAI, SchemaType, type ResponseSchema } from "@google/generative-ai";
import { extractJdHeuristic } from "@/lib/extract";
import { assemblePacket, heuristicNarrative } from "@/lib/assemble";
import { logEvent } from "@/lib/log";
import { matchJob } from "@/lib/match";
import { JdExtractionSchema, NarrativeSchema } from "@/lib/schema";
import { wrapUntrustedJd } from "@/lib/sanitize";
import { computeScore } from "@/lib/scoring";
import type { HirePacketResult, JdExtraction, PacketNarrative, RequirementMatch } from "@/lib/types";

const MODELS = ["gemini-2.0-flash", "gemini-2.5-flash", "gemini-flash-latest"];
const MAX_ATTEMPTS = 3;

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

function extractJson(text: string): unknown {
  const cleaned = text.replace(/```json|```/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
    throw new Error("Model did not return valid JSON");
  }
}

async function callModel(
  apiKey: string,
  prompt: string,
  schema: ResponseSchema,
  temperature: number
): Promise<unknown> {
  let lastError: unknown;
  for (const modelName of MODELS) {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig: {
            temperature,
            responseMimeType: "application/json",
            responseSchema: schema,
          },
        });
        const suffix =
          attempt > 1 ? `\nPrevious output failed validation. Return JSON that matches the schema exactly.` : "";
        const result = await model.generateContent(prompt + suffix);
        return extractJson(result.response.text());
      } catch (err) {
        lastError = err;
        logEvent("gemini_retry", { attempt, ok: false });
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error("gemini_failed");
}

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

export async function generateHirePacket(jobDescription: string): Promise<HirePacketResult> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  let extraction: JdExtraction;
  let extractMode: "gemini" | "heuristic" = "heuristic";

  if (apiKey) {
    try {
      const raw = await callModel(apiKey, extractPrompt(jobDescription), EXTRACT_SCHEMA, 0);
      extraction = parseJdExtraction(raw);
      extractMode = "gemini";
    } catch {
      extraction = extractJdHeuristic(jobDescription);
    }
  } else {
    extraction = extractJdHeuristic(jobDescription);
  }

  const buckets = matchJob(extraction);
  const fitScore = computeScore(buckets).total;
  const flat = Object.values(buckets).flat();

  let narrative: PacketNarrative = heuristicNarrative(extraction, flat, fitScore);
  let mode: "gemini" | "heuristic" = extractMode;

  if (apiKey && extractMode === "gemini") {
    try {
      const raw = await callModel(apiKey, narrativePrompt(extraction, flat, fitScore), NARRATIVE_SCHEMA, 0.3);
      narrative = NarrativeSchema.parse(raw);
      mode = "gemini";
    } catch {
      logEvent("narrative_fallback", { ok: true });
    }
  }

  const packet = assemblePacket(extraction, buckets, narrative, mode);
  logEvent("packet_generated", {
    mode: packet.mode,
    score: packet.fitScore,
    slug: packet.slug,
    reqCount: packet.requirements.length,
  });
  return packet;
}
