import { z } from "zod";

export const JD_LIMITS = {
  role: 80,
  requiredItem: 160,
  preferredItem: 160,
  responsibilityItem: 220,
  educationItem: 160,
  requiredCount: 12,
  preferredCount: 10,
  responsibilityCount: 10,
  educationCount: 6,
} as const;

function clipList(items: unknown, itemMax: number, count: number): string[] {
  if (!Array.isArray(items)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const line = String(item || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, itemMax);
    if (line.length < 1) continue;
    const key = line.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(line);
    if (out.length >= count) break;
  }
  return out;
}

/** Clip/clean a JD extract so scoring does not fail on long LinkedIn paste lines. */
export function clipJdExtraction(raw: unknown): Record<string, unknown> {
  const row = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    role: String(row.role || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, JD_LIMITS.role),
    requiredSkills: clipList(row.requiredSkills, JD_LIMITS.requiredItem, JD_LIMITS.requiredCount),
    preferredSkills: clipList(row.preferredSkills, JD_LIMITS.preferredItem, JD_LIMITS.preferredCount),
    responsibilities: clipList(row.responsibilities, JD_LIMITS.responsibilityItem, JD_LIMITS.responsibilityCount),
    minimumExperience: row.minimumExperience,
    education: clipList(row.education, JD_LIMITS.educationItem, JD_LIMITS.educationCount),
  };
}

export const JdExtractionSchema = z.object({
  role: z.string().trim().min(3).max(JD_LIMITS.role),
  requiredSkills: z.array(z.string().trim().min(1).max(JD_LIMITS.requiredItem)).min(1).max(JD_LIMITS.requiredCount),
  preferredSkills: z.array(z.string().trim().min(1).max(JD_LIMITS.preferredItem)).max(JD_LIMITS.preferredCount).default([]),
  responsibilities: z
    .array(z.string().trim().min(1).max(JD_LIMITS.responsibilityItem))
    .max(JD_LIMITS.responsibilityCount)
    .default([]),
  minimumExperience: z.coerce.number().min(0).max(20).default(0),
  education: z.array(z.string().trim().min(1).max(JD_LIMITS.educationItem)).max(JD_LIMITS.educationCount).default([]),
});

export const NarrativeSchema = z.object({
  summary: z.string().trim().min(20).max(800),
  whyInterview: z.array(z.string().trim().min(8).max(280)).min(3).max(5),
  interviewQuestions: z
    .array(
      z.object({
        question: z.string().trim().min(8).max(400),
        basedOn: z.enum(["evidence", "gap"]),
        context: z.string().trim().min(1).max(400),
      })
    )
    .min(3)
    .max(6),
  recruiterPitch: z.string().trim().min(40).max(2000),
});

export const ResumeJobSchema = z.object({
  company: z.string().trim().min(1).max(120),
  role: z.string().trim().min(1).max(120),
  location: z.string().trim().max(80).optional().default(""),
  start: z.string().trim().max(40).optional().default(""),
  end: z.string().trim().max(40).optional().default(""),
  evidence: z.array(z.string().trim().min(4).max(500)).max(12).default([]),
});

export const ResumeProjectSchema = z.object({
  name: z.string().trim().min(1).max(120),
  summary: z.string().trim().max(400).optional().default(""),
  tech: z.array(z.string().trim().min(1).max(40)).max(12).optional().default([]),
});

export const CandidateResumeSchema = z.object({
  candidate: z.string().trim().min(2).max(80),
  headline: z.string().trim().max(140).optional().default(""),
  location: z.string().trim().max(80).optional().default(""),
  email: z.string().trim().max(120).optional().default(""),
  phone: z.string().trim().max(40).optional().default(""),
  linkedin: z.string().trim().max(200).optional().default(""),
  github: z.string().trim().max(200).optional().default(""),
  portfolio: z.string().trim().max(200).optional().default(""),
  yearsExperience: z.coerce.number().min(0).max(50).optional().default(0),
  skills: z.array(z.string().trim().min(1).max(60)).max(80).optional().default([]),
  experience: z.array(ResumeJobSchema).max(14).optional().default([]),
  education: z.array(z.string().trim().min(2).max(200)).max(10).optional().default([]),
  certifications: z.array(z.string().trim().min(2).max(200)).max(16).optional().default([]),
  projects: z.array(ResumeProjectSchema).max(12).optional().default([]),
});

export type JdExtractionInput = z.infer<typeof JdExtractionSchema>;
export type NarrativeInput = z.infer<typeof NarrativeSchema>;
export type CandidateResumeInput = z.infer<typeof CandidateResumeSchema>;
