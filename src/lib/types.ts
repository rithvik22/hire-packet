export type MatchStatus = "strong_match" | "partial_match" | "gap";

export type ScoreCategory =
  | "requiredSkills"
  | "experience"
  | "responsibilities"
  | "preferredSkills"
  | "education";

export type Recommendation = "strong_fit" | "possible_fit" | "weak_fit";

export type JdExtraction = {
  role: string;
  requiredSkills: string[];
  preferredSkills: string[];
  responsibilities: string[];
  minimumExperience: number;
  education: string[];
};

export type RequirementMatch = {
  requirement: string;
  status: MatchStatus;
  evidence: string[];
  gap: string | null;
  transferable: string | null;
  category: ScoreCategory;
};

export type InterviewQuestion = {
  question: string;
  basedOn: "evidence" | "gap";
  context: string;
};

export type PacketNarrative = {
  summary: string;
  whyInterview: string[];
  interviewQuestions: InterviewQuestion[];
  recruiterPitch: string;
};

export type CategoryScore = {
  earned: number;
  max: number;
  na: boolean;
};

export type ScoreBreakdown = Record<ScoreCategory, CategoryScore> & {
  total: number;
};

export type HirePacketResult = {
  fitScore: number;
  scoreBreakdown: ScoreBreakdown;
  recommendation: Recommendation;
  summary: string;
  roleGuess: string;
  seniority: string;
  slug: string;
  requirements: RequirementMatch[];
  gaps: {
    missing: { requirement: string; note: string }[];
    transferable: { requirement: string; note: string }[];
    discuss: { requirement: string; note: string }[];
  };
  interviewQuestions: InterviewQuestion[];
  whyInterview: string[];
  recruiterPitch: string;
  mode: "gemini" | "heuristic";
  disclosure: string;
  generatedAt: string;
  sharePath: string;
};

export const SCORE_WEIGHTS: Record<ScoreCategory, number> = {
  requiredSkills: 35,
  experience: 25,
  responsibilities: 20,
  preferredSkills: 10,
  education: 10,
};

export const CATEGORY_LABELS: Record<ScoreCategory, string> = {
  requiredSkills: "Required skills",
  experience: "Relevant experience",
  responsibilities: "Responsibilities",
  preferredSkills: "Preferred skills",
  education: "Education / certifications",
};

export const RECOMMENDATION_LABELS: Record<Recommendation, string> = {
  strong_fit: "Strong fit",
  possible_fit: "Possible fit",
  weak_fit: "Weak fit",
};

export const AI_DISCLOSURE =
  "AI-assisted packet. Evidence is copied from a frozen resume JSON file Gemini cannot edit. The fit score is calculated in code (35 / 25 / 20 / 10 / 10). This is not a hiring decision.";
