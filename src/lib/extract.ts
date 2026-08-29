import type { JdExtraction } from "@/lib/types";
import { clipJdExtraction, JdExtractionSchema } from "@/lib/schema";
import { stripJobBoardChrome } from "@/lib/sanitize";

function headingBlock(jd: string, start: RegExp, stop: RegExp): string {
  const lines = jd.split("\n");
  const startIdx = lines.findIndex((line) => start.test(line.trim()));
  if (startIdx < 0) return "";
  const stopIdx = lines.findIndex((line, i) => i > startIdx && stop.test(line.trim()));
  return lines.slice(startIdx + 1, stopIdx < 0 ? undefined : stopIdx).join("\n");
}

function isNoise(line: string): boolean {
  if (
    /^(location|compensation|salary|about the team|about the role|about us|in this role|what you bring|what you will|bonus points|education:?$|full-time|hybrid|you will:|required qualifications|nice to have|preferred qualifications|key responsibilities|position overview|working at|why .+\??$)\b/i.test(
      line
    )
  ) {
    return true;
  }
  if (/^location:/i.test(line) || /^compensation:/i.test(line)) return true;
  if (/\$\d[\d,]*(k)?/i.test(line) && line.length < 70) return true;
  if (/^(apply|save|show match details|tailor my resume|help me stand out|create cover letter)\b/i.test(line)) {
    return true;
  }
  return false;
}

function bullets(block: string, maxLen: number): string[] {
  const lines = block
    .split("\n")
    .map((l) => l.replace(/^[-–•*]\s*/, "").trim())
    .filter((l) => l.length > 12 && l.length < 400)
    .filter((l) => !isNoise(l))
    .filter((l) => !/^(required|preferred|nice to have|education|about|bonus|benefits|why )\b/i.test(l));

  return [...new Set(lines.map((l) => l.replace(/\s+/g, " ").slice(0, maxLen)))].slice(0, 10);
}

function years(jd: string): number {
  const match = jd.match(/(\d+)\+\s*years/i) || jd.match(/minimum\s+(\d+)\s*years/i);
  if (!match) return 0;
  return Math.min(20, Number(match[1]));
}

function inlineEducation(jd: string): string[] {
  const hits = [...jd.matchAll(/^education:\s*(.+)$/gim)];
  return hits
    .map((hit) => hit[1].trim())
    .filter((line) => line.length > 8 && !/experience leading|proficiency in|knowledge of/i.test(line))
    .map((line) => line.slice(0, 160))
    .slice(0, 4);
}

export function extractJdHeuristic(jobDescription: string): JdExtraction {
  const jd = stripJobBoardChrome(jobDescription);

  const required = bullets(
    headingBlock(
      jd,
      /^(what you bring to the table|you bring to the table|required qualifications|requirements|must[- ]have|minimum qualifications)\b/i,
      /^(preferred skills|nice to have|bonus points|why |benefits|compensation|how we hire)\b/i
    ),
    160
  );

  const preferred = bullets(
    headingBlock(
      jd,
      /^(preferred skills|bonus points|nice to have|preferred qualifications)\b/i,
      /^(why |benefits|compensation|equal opportunity|how we hire|education)\b/i
    ),
    160
  );

  const responsibilities = bullets(
    headingBlock(
      jd,
      /^(key responsibilities|in this role|what you will do|responsibilities)\b/i,
      /^(what you bring|requirements|required qualifications|preferred skills|nice to have|bonus points|education)\b/i
    ),
    220
  );

  const educationHeading = bullets(
    headingBlock(jd, /^education\b/i, /^(preferred skills|benefits|how we hire|why |compensation)\b/i),
    160
  ).filter((line) => /degree|bachelor|master|computer science|certif/i.test(line));

  const education = [...inlineEducation(jd), ...educationHeading].slice(0, 4);

  const roleLine =
    jd
      .split("\n")
      .map((l) => l.trim())
      .find(
        (l) =>
          l.length > 8 &&
          l.length < 80 &&
          !isNoise(l) &&
          !/^about /i.test(l) &&
          !/clicked apply|linkedin|hybrid|full-time/i.test(l)
      ) || "Software Engineer";

  const parsed = JdExtractionSchema.parse(
    clipJdExtraction({
      role: roleLine.replace(/\s+/g, " ").slice(0, 80),
      requiredSkills: (required.length ? required : responsibilities).slice(0, 8),
      preferredSkills: preferred.slice(0, 8),
      responsibilities: responsibilities.slice(0, 8),
      minimumExperience: years(jd),
      education,
    })
  );

  return {
    role: parsed.role,
    requiredSkills: parsed.requiredSkills,
    preferredSkills: parsed.preferredSkills,
    responsibilities: parsed.responsibilities,
    minimumExperience: parsed.minimumExperience,
    education: parsed.education,
  };
}
