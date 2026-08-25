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
