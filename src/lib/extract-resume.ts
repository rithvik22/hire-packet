import { callModel } from "@/lib/gemini-client";
import { logEvent } from "@/lib/log";
import { CandidateResumeSchema } from "@/lib/schema";
import { wrapUntrustedResume } from "@/lib/sanitize";
import type { CandidateResume, ResumeJob, ResumeProject } from "@/lib/types";

const SKILL_LEXICON = [
  "Java",
  "JavaScript",
  "TypeScript",
  "Python",
  "Go",
  "Rust",
  "SQL",
  "React",
  "Next.js",
  "Angular",
  "Vue",
  "React Native",
  "Node.js",
  "NestJS",
  "Spring Boot",
  "Django",
  "Flask",
  "Express",
  "GraphQL",
  "REST",
  "PostgreSQL",
  "MongoDB",
  "MySQL",
  "Redis",
  "Kafka",
  "Docker",
  "Kubernetes",
  "AWS",
  "Azure",
  "GCP",
  "Terraform",
  "CI/CD",
  "OpenAI",
  "RAG",
  "Socket.IO",
  "OAuth",
  "JWT",
  "Python",
  "C#",
  "C++",
  "PHP",
  "Ruby",
  "Swift",
  "Kotlin",
  "Scala",
  "HTML",
  "CSS",
  "Tailwind",
  "Svelte",
  "Redux",
  "Prisma",
  "TypeORM",
  "Hibernate",
  "Elasticsearch",
  "Snowflake",
  "Spark",
  "Airflow",
  "Jenkins",
  "GitHub Actions",
  "Linux",
  "Figma",
  "Salesforce",
];

function emptyResume(): CandidateResume {
  return {
    candidate: "Candidate",
    headline: "",
    location: "",
    email: "",
    phone: "",
    linkedin: "",
    github: "",
    portfolio: "",
    yearsExperience: 0,
    skills: [],
    experience: [],
    education: [],
    certifications: [],
    projects: [],
  };
}

export function parseCandidateResume(raw: unknown): CandidateResume {
  const parsed = CandidateResumeSchema.parse(raw);
  return {
    candidate: parsed.candidate,
    headline: parsed.headline,
    location: parsed.location,
    email: parsed.email,
    phone: parsed.phone,
    linkedin: parsed.linkedin,
    github: parsed.github,
    portfolio: parsed.portfolio,
    yearsExperience: parsed.yearsExperience,
    skills: unique(parsed.skills.filter((skill) => !/^(technical skills|skills|languages|frameworks|tools|technologies)$/i.test(skill))),
    experience: parsed.experience
      .filter((job) => job.company.trim() && job.role.trim())
      .map((job) => ({
      company: job.company,
      role: job.role,
      location: job.location,
      start: job.start,
      end: job.end,
      evidence: unique(job.evidence),
    })),
    education: unique(parsed.education),
    certifications: unique(parsed.certifications),
    projects: parsed.projects
      .filter((project) => project.name.trim())
      .map((project) => ({
      name: project.name,
      summary: project.summary,
      tech: unique(project.tech),
    })),
  };
}

function unique(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const key = item.toLowerCase();
    if (!item.trim() || seen.has(key)) continue;
    seen.add(key);
    out.push(item.trim());
  }
  return out;
}

const TITLE_WORD =
  /\b(developer|engineer|designer|manager|analyst|architect|scientist|intern|consultant|founder|director|specialist|lead)\b/i;
const PROSE_START =
  /^(architected|built|implemented|developed|designed|delivered|owned|provisioned|created|led|progressed|experienced|strong in|and\b)/i;
const SKILL_NOISE =
  /^(technical skills|skills|languages|frameworks|tools|technologies|libraries|soft skills|experience|education)$/i;
const YEAR_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
};

function linesOf(text: string): string[] {
  return text
    .split(/\r?\n/)
    .flatMap((chunk) => {
      const trimmed = chunk.replace(/^[-•*\u2022]+\s*/, "").trim();
      if (!trimmed) return [];
      if (trimmed.length < 140) return [trimmed];
      return trimmed.split(/(?<=\.)\s+(?=[A-Z])/).map((part) => part.trim()).filter(Boolean);
    })
    .filter(Boolean);
}

function firstUrl(text: string, pattern: RegExp): string {
  const match = text.match(pattern)?.[0] ?? "";
  return match.replace(/[.,;]+$/, "");
}

function withHttps(url: string): string {
  if (!url) return "";
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

function wordBoundary(text: string, max: number): string {
  const clipped = text.trim();
  if (clipped.length <= max) return clipped;
  const slice = clipped.slice(0, max);
  const lastSpace = slice.lastIndexOf(" ");
  return (lastSpace > 40 ? slice.slice(0, lastSpace) : slice).trim();
}

function estimateYears(text: string, jobs: ResumeJob[]): number {
  const numeric = text.match(/(\d+)\+?\s*years?(?:\s+of)?(?:\s+(?:professional\s+)?experience)?/i);
  if (numeric) return Math.min(40, Number(numeric[1]));
  const spoken = text.match(
    /\b(one|two|three|four|five|six|seven|eight|nine|ten)\s+years?(?:\s+of)?(?:\s+(?:professional\s+)?experience)?/i
  );
  if (spoken) return YEAR_WORDS[spoken[1].toLowerCase()] ?? 0;

  const years = jobs
    .flatMap((job) => [job.start, job.end])
    .map((value) => value.match(/(19|20)\d{2}/)?.[0])
    .filter(Boolean)
    .map(Number);
  if (years.length >= 2) return Math.min(40, Math.max(1, Math.max(...years) - Math.min(...years)));
  return jobs.length ? Math.min(40, Math.max(1, jobs.length)) : 0;
}

function splitSection(text: string, start: RegExp, stop: RegExp): string {
  const from = text.search(start);
  if (from < 0) return "";
  const rest = text.slice(from);
  const cut = rest.slice(1).search(stop);
  return cut >= 0 ? rest.slice(0, cut + 1) : rest;
}

function parseDates(line: string): { start: string; end: string } | null {
  const match = line.match(
    /((?:0?[1-9]|1[0-2])\/(?:19|20)\d{2}|(?:19|20)\d{2})\s*[-–—to]+\s*((?:0?[1-9]|1[0-2])\/(?:19|20)\d{2}|present|current)/i
  );
  if (!match) return null;
  return { start: match[1], end: /present|current/i.test(match[2]) ? "Present" : match[2] };
}

function companyName(raw: string): string {
  const stopped = raw.split(/,|\s+leading\b|\s+where\b/i)[0]?.trim() ?? "";
  const words = stopped.split(/\s+/).slice(0, 6);
  return words.join(" ").replace(/[.,;:]+$/, "").trim();
}

function roleName(raw: string): string {
  const match = raw.match(
    /((?:Lead |Senior |Staff |Principal |Java |Full-Stack |Full Stack )?(?:Developer|Engineer|Designer|Manager|Analyst|Architect)(?:\s*\([^)]+\))?)/i
  );
  if (match) return match[1].trim();
  return wordBoundary(raw.replace(/[.,;:]+$/, ""), 60);
}

function isJobHeader(line: string): boolean {
  if (line.length < 8 || line.length > 90) return false;
  if (PROSE_START.test(line)) return false;
  return TITLE_WORD.test(line) || /\b(inc\.?|llc|ltd|corp|solutions|labs|studios)\b/i.test(line);
}

function jobFromHeader(line: string, dates: { start: string; end: string } | null): ResumeJob | null {
  if (!isJobHeader(line)) return null;

  const at = line.match(/^(.{3,50}?)\s+at\s+(.+)$/i);
  if (at && TITLE_WORD.test(at[1])) {
    return {
      company: companyName(at[2]),
      role: roleName(at[1]),
      location: "",
      start: dates?.start ?? "",
      end: dates?.end ?? "",
      evidence: [],
    };
  }

  const dash = line.match(/^(.{3,50}?)\s+[—–-]\s+(.{3,50})$/);
  if (dash) {
    const left = dash[1].trim();
    const right = dash[2].trim();
    const leftTitle = TITLE_WORD.test(left);
    const rightTitle = TITLE_WORD.test(right);
    if (leftTitle !== rightTitle) {
      return {
        company: companyName(leftTitle ? right : left),
        role: roleName(leftTitle ? left : right),
        location: "",
        start: dates?.start ?? "",
        end: dates?.end ?? "",
        evidence: [],
      };
    }
  }

  return null;
}

function cleanJob(job: ResumeJob): ResumeJob {
  return {
    ...job,
    company: companyName(job.company),
    role: roleName(job.role),
    evidence: job.evidence.filter((line) => line.length > 24 && !isJobHeader(line)).slice(0, 8),
  };
}

function extractJobs(block: string): ResumeJob[] {
  const lines = linesOf(block);
  const jobs: ResumeJob[] = [];
  let current: ResumeJob | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const dates = parseDates(line) || (lines[i + 1] ? parseDates(lines[i + 1]) : null);
    const header = jobFromHeader(line, dates);
    if (header && header.company && header.role) {
      if (current) jobs.push(current);
      current = header;
      continue;
    }
    if (current && parseDates(line)) {
      if (!current.start) current.start = parseDates(line)?.start ?? "";
      if (!current.end) current.end = parseDates(line)?.end ?? "";
      continue;
    }
    if (current && line.length > 28 && !/^(experience|education|skills|projects)\b/i.test(line)) {
      current.evidence.push(line.slice(0, 400));
    }
  }
  if (current) jobs.push(current);

  const cleaned = jobs.map(cleanJob).filter((job) => job.company.length > 1 && job.role.length > 2 && job.company.split(" ").length <= 6);
  if (cleaned.length) return cleaned.slice(0, 8);

  const scanned: ResumeJob[] = [];
  const atJobs = block.matchAll(
    /((?:Lead |Senior |Staff |Java |Full-Stack |Full Stack )?[\w+/ #-]{3,40}?)\s+at\s+([A-Z][A-Za-z0-9.&'’-]*?(?:\s+[A-Z][A-Za-z0-9.&'’-]*){0,4})(?=,|\.|$|\s+leading)/g
  );
  for (const match of atJobs) {
    if (!TITLE_WORD.test(match[1]) || PROSE_START.test(match[1])) continue;
    scanned.push(
      cleanJob({
        company: companyName(match[2]),
        role: roleName(match[1]),
        location: "",
        start: "",
        end: "",
        evidence: [],
      })
    );
  }
  return scanned.slice(0, 8);
}

export function extractResumeHeuristic(text: string): CandidateResume {
  const blob = text.replace(/\u0000/g, " ");
  const lines = linesOf(blob);
  const email = blob.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? "";
  const phone = blob.match(/(\+\d{1,2}[\s.-]?)?(\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}/)?.[0] ?? "";
  const linkedin = withHttps(firstUrl(blob, /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[^\s)]+/i));
  const github = withHttps(firstUrl(blob, /(?:https?:\/\/)?(?:www\.)?github\.com\/[^\s)/]+/i));
  const portfolio = withHttps(firstUrl(blob, /https?:\/\/[^\s)]+/i));
  const location =
    blob.match(/\b([A-Z][a-z]+(?:\s[A-Z][a-z]+)?,\s*(?:TX|TN|GA|AR|CA|NY|WA|IL|India))\b/)?.[0] ?? "";
  const nameLine =
    lines.find(
      (line) =>
        line.length > 3 &&
        line.length < 60 &&
        !line.includes("@") &&
        !/^https?:/i.test(line) &&
        !/skills|experience|education|summary|objective|technical/i.test(line)
    ) || "Candidate";

  const skillHits = SKILL_LEXICON.filter((skill) => {
    const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`\\b${escaped}\\b`, "i").test(blob);
  });
  const skillBlock = splitSection(
    blob,
    /\bskills\b|\btechnical skills\b|\btechnologies\b/i,
    /\bexperience\b|\beducation\b|\bprojects\b|\bcertifications\b/i
  );
  const listedSkills = linesOf(skillBlock)
    .join(",")
    .split(/[,|/•]/)
    .map((item) => item.trim())
    .filter((item) => item.length > 1 && item.length < 40 && !SKILL_NOISE.test(item))
    .slice(0, 40);

  const experienceBlock = splitSection(
    blob,
    /\b(experience|employment|work history)\b/i,
    /\b(education|projects|certifications)\b/i
  );
  let usableJobs = extractJobs(experienceBlock || blob);
  if (usableJobs.length === 0) {
    usableJobs = extractJobs(blob);
  }

  const education = linesOf(
    splitSection(blob, /\beducation\b/i, /\b(experience|projects|skills|certifications)\b/i)
  )
    .filter((line) => /bachelor|master|b\.s|m\.s|b\.tech|m\.tech|phd|university|college|degree/i.test(line))
    .slice(0, 6);
  const certifications = linesOf(
    splitSection(blob, /\bcertifications?\b/i, /\b(experience|education|projects|skills)\b/i)
  )
    .filter((line) => line.length > 8 && !/^certifications?$/i.test(line))
    .slice(0, 8);

  const projectLines = linesOf(splitSection(blob, /\bprojects?\b/i, /\b(experience|education|skills|certifications)\b/i));
  const projects: ResumeProject[] = [];
  for (const line of projectLines.slice(0, 8)) {
    if (line.length < 8 || /^projects?$/i.test(line)) continue;
    projects.push({ name: wordBoundary(line, 80), summary: wordBoundary(line, 300), tech: [] });
  }

  const headlineSource =
    lines.find(
      (line) =>
        /engineer|developer|designer|manager|analyst|lead|full-stack/i.test(line) &&
        line.length >= 20 &&
        !PROSE_START.test(line) &&
        !/healthvice, leading/i.test(line)
    ) || "";

  return {
    ...emptyResume(),
    candidate: nameLine.slice(0, 80),
    headline: wordBoundary(headlineSource, 140),
    location,
    email,
    phone: phone.trim(),
    linkedin,
    github,
    portfolio: portfolio === linkedin || portfolio === github ? "" : portfolio,
    yearsExperience: estimateYears(blob, usableJobs),
    skills: unique([...listedSkills, ...skillHits]).slice(0, 50),
    experience: usableJobs,
    education: unique(education),
    certifications: unique(certifications),
    projects: projects.slice(0, 6),
  };
}

function extractPrompt(resumeText: string): string {
  return `Extract a structured resume JSON. Return JSON only.
Copy evidence bullets from the resume text. Do not invent employers, schools, dates, or skills.
If a field is missing, use "" or [].
yearsExperience is an integer (0 if unknown).
evidence[] must be short factual bullets from the resume, not paraphrased marketing.
Schema: { candidate, headline, location, email, phone, linkedin, github, portfolio, yearsExperience, skills[], experience[{company, role, location, start, end, evidence[]}], education[], certifications[], projects[{name, summary, tech[]}] }
${wrapUntrustedResume(resumeText)}`;
}

export async function extractStructuredResume(
  resumeText: string,
  options?: { allowGemini?: boolean }
): Promise<{
  resume: CandidateResume;
  mode: "gemini" | "heuristic";
}> {
  const fallback = extractResumeHeuristic(resumeText);
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || options?.allowGemini === false) return { resume: fallback, mode: "heuristic" };

  try {
    const raw = await callModel(apiKey, extractPrompt(resumeText.slice(0, 12000)), null, 0, {
      models: ["gemini-2.0-flash", "gemini-flash-latest"],
      maxAttempts: 1,
    });
    const resume = parseCandidateResume(raw);
    if (!resume.candidate || resume.candidate === "Candidate") {
      resume.candidate = fallback.candidate;
    }
    if (!resume.skills.length) resume.skills = fallback.skills;
    if (!resume.experience.length) resume.experience = fallback.experience;
    if (!resume.yearsExperience) resume.yearsExperience = fallback.yearsExperience;
    return { resume, mode: "gemini" };
  } catch {
    logEvent("resume_extract_fallback", { ok: true });
    return { resume: fallback, mode: "heuristic" };
  }
}
