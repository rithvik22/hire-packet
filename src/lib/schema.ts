import { z } from "zod";

export const JdExtractionSchema = z.object({
  role: z.string().trim().min(3).max(80),
  requiredSkills: z.array(z.string().trim().min(1).max(160)).min(1).max(12),
  preferredSkills: z.array(z.string().trim().min(1).max(160)).max(10).default([]),
  responsibilities: z.array(z.string().trim().min(1).max(220)).max(10).default([]),
  minimumExperience: z.coerce.number().min(0).max(20).default(0),
  education: z.array(z.string().trim().min(1).max(160)).max(6).default([]),
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

export type JdExtractionInput = z.infer<typeof JdExtractionSchema>;
export type NarrativeInput = z.infer<typeof NarrativeSchema>;
