import type { JdExtraction } from "@/lib/types";

function section(jd: string, start: RegExp, stop: RegExp): string {
  const from = jd.search(start);
  if (from < 0) return "";
  const rest = jd.slice(from);
  const cut = rest.slice(1).search(stop);
  return cut >= 0 ? rest.slice(0, cut + 1) : rest;
}

function bullets(block: string): string[] {
  return block
    .split(/\n|•|\*/)
    .map((l) => l.replace(/^[-–]\s*/, "").trim())
    .filter((l) => l.length > 8 && l.length < 200 && !/^(required|preferred|nice to have|education|about)\b/i.test(l))
    .slice(0, 8);
}

function years(jd: string): number {
  const match = jd.match(/(\d+)\+?\s*years/i);
  if (!match) return 0;
  return Math.min(20, Number(match[1]));
}

export function extractJdHeuristic(jobDescription: string): JdExtraction {
  const jd = jobDescription.trim();
  const required = bullets(
    section(jd, /required|must[- ]have|qualifications/i, /nice to have|preferred|benefits|education|how we hire/i) || jd
  );
  const preferred = bullets(section(jd, /nice to have|preferred/i, /benefits|education|how we hire|about the company/i));
  const responsibilities = bullets(
    section(jd, /what you will do|responsibilities|you will/i, /required|qualifications|nice to have|education/i)
  );
  const education = bullets(section(jd, /education|certification|degree|bachelor|master/i, /benefits|how we hire/i));

  const roleLine = jd.split("\n").map((l) => l.trim()).find((l) => l.length > 8 && l.length < 80) || "Software Engineer";

  return {
    role: roleLine.replace(/\s+/g, " ").slice(0, 80),
    requiredSkills: required.slice(0, 8),
    preferredSkills: preferred.slice(0, 6),
    responsibilities: responsibilities.slice(0, 6),
    minimumExperience: years(jd),
    education: education.slice(0, 4),
  };
}
