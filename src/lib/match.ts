import { formatResumeEvidence } from "@/data/resume";
import { flattenResumeEvidence, formatRankedEvidence, retrieveEvidence, resumeRelevance } from "@/lib/retrieve";
import type { CandidateResume, JdExtraction, RequirementMatch, ScoreCategory } from "@/lib/types";

const ALIASES: Record<string, string[]> = {
  javascript: ["js", "javascript"],
  typescript: ["ts", "typescript"],
  "node.js": ["node", "nodejs", "node.js"],
  nestjs: ["nest", "nestjs"],
  "spring boot": ["spring", "springboot", "spring boot"],
  react: ["react", "reactjs"],
  "next.js": ["next", "nextjs", "next.js"],
  postgresql: ["postgres", "postgresql"],
  mongodb: ["mongo", "mongodb"],
  kubernetes: ["k8s", "kubernetes"],
  openai: ["openai", "gpt", "llm"],
  rag: ["rag", "retrieval", "embeddings"],
  aws: ["aws", "ec2", "s3", "lambda", "rds"],
  azure: ["azure", "aks"],
  graphql: ["graphql"],
  docker: ["docker"],
  kafka: ["kafka"],
  "socket.io": ["socket.io", "websocket", "real-time", "realtime"],
  oauth: ["oauth", "jwt"],
};

type TransferRule = {
  pattern: RegExp;
  adjacent: RegExp;
  withAdjacent: string;
  without: string;
};

const TRANSFERABLE: TransferRule[] = [
  {
    pattern: /telephon|sip\b|twilio|pstn|ivr|voice ai|call center/i,
    adjacent: /socket\.io|websocket|real-?time|kafka|webhook/i,
    withAdjacent:
      "No direct telephony experience, but has worked with real-time systems, webhooks, Socket.IO and event-driven workflows.",
    without: "No direct telephony experience listed on the resume.",
  },
  {
    pattern: /golang|\bgo\b|rust\b/i,
    adjacent: /\b(java|node\.js|nestjs|python|typescript)\b/i,
    withAdjacent: "No production Go/Rust on the resume; backend depth is in the listed stack.",
    without: "No production Go/Rust listed on the resume.",
  },
  {
    pattern: /salesforce|sap\b/i,
    adjacent: /rbac|oauth|rest|integration/i,
    withAdjacent: "No CRM platform tenure; has shipped RBAC, REST integrations, and domain workflows that transfer.",
    without: "No Salesforce/SAP tenure listed on the resume.",
  },
];

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9.+#]+/g, " ");
}

function aliasesFor(skill: string): string[] {
  const key = skill.toLowerCase();
  return ALIASES[key] || [key];
}

function mentions(haystack: string, skill: string): boolean {
  const h = normalize(haystack);
  return aliasesFor(skill).some((alias) => {
    if (alias.length <= 2) return new RegExp(`\\b${alias}\\b`, "i").test(haystack);
    return h.includes(normalize(alias));
  });
}

function resumeHaystack(resume: CandidateResume): string {
  return [
    ...resume.skills,
    ...resume.education,
    ...resume.certifications,
    ...resume.experience.flatMap((job) => [job.company, job.role, ...job.evidence]),
    ...resume.projects.flatMap((project) => [project.name, project.summary, ...project.tech]),
  ].join(" \n ");
}

function keywordsIn(requirement: string, resume: CandidateResume): string[] {
  return resume.skills.filter((skill) => mentions(requirement, skill));
}

function transferableFor(requirement: string, resume: CandidateResume): string | null {
  const hay = resumeHaystack(resume);
  const rule = TRANSFERABLE.find((item) => item.pattern.test(requirement));
  if (!rule) return null;
  return rule.adjacent.test(hay) ? rule.withAdjacent : rule.without;
}

export function enforceNoStrongWithoutEvidence(match: RequirementMatch): RequirementMatch {
  if (match.status === "strong_match" && match.evidence.length === 0) {
    return {
      ...match,
      status: "gap",
      gap: match.gap ?? "No direct production experience.",
    };
  }
  return match;
}

export function matchRequirement(
  requirement: string,
  category: ScoreCategory,
  resume: CandidateResume
): RequirementMatch {
  const keywords = keywordsIn(requirement, resume);
  const listed = keywords.filter((k) => resume.skills.some((s) => mentions(s, k)));
  const transfer = transferableFor(requirement, resume);

  // Lexical hits (exact / alias) — keep as primary proof when present.
  const lexicalHits = flattenResumeEvidence(resume).filter((row) => {
    if (keywords.length === 0) {
      const tokens = normalize(requirement)
        .split(" ")
        .filter((t) => t.length > 4);
      return tokens.some((t) => normalize(row.text).includes(t));
    }
    return keywords.some((k) => mentions(row.text, k));
  });

  // Semantic retrieval ranks the best supporting bullets (related wording still counts).
  const ranked = retrieveEvidence(requirement, resume, 5);
  const semanticHits = ranked.filter((row) => row.score >= 0.18);
  const relevance = resumeRelevance(requirement, resume);

  const credentialHits = [...resume.education, ...resume.certifications].filter((line) => {
    const tokens = normalize(requirement)
      .split(" ")
      .filter((t) => t.length > 4);
    return tokens.some((t) => normalize(line).includes(t)) || keywords.some((k) => mentions(line, k));
  });

  const lexicalEvidence = lexicalHits.slice(0, 3).map(formatResumeEvidence);
  const semanticEvidence = formatRankedEvidence(semanticHits.slice(0, 3));
  const evidence = [...new Set([...lexicalEvidence, ...semanticEvidence, ...credentialHits.slice(0, 2)])].slice(
    0,
    4
  );

  let status: RequirementMatch["status"];
  if (evidence.length > 0 && (keywords.length === 0 || listed.length > 0)) {
    status = "strong_match";
  } else if (evidence.length > 0 || listed.length > 0 || relevance >= 0.28) {
    status = "partial_match";
    if (evidence.length === 0 && relevance >= 0.28 && semanticHits.length > 0) {
      evidence.push(...formatRankedEvidence(semanticHits.slice(0, 2)));
    }
  } else {
    status = "gap";
  }

  if (status === "partial_match" && evidence.length === 0 && listed.length > 0) {
    evidence.push(`Listed skill on verified resume: ${listed.slice(0, 3).join(", ")}`);
  }

  return enforceNoStrongWithoutEvidence({
    requirement,
    status,
    evidence: status === "gap" ? [] : evidence,
    gap: status === "gap" ? transfer ?? "No direct production experience." : null,
    transferable: status === "gap" ? transfer : null,
    category,
  });
}

function uniqueReqs(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const key = item.toLowerCase();
    if (seen.has(key) || item.trim().length < 2) continue;
    seen.add(key);
    out.push(item.trim());
  }
  return out;
}

export function matchJob(
  extraction: JdExtraction,
  resume: CandidateResume
): Record<ScoreCategory, RequirementMatch[]> {
  const requiredSkills = uniqueReqs(extraction.requiredSkills).map((req) =>
    matchRequirement(req, "requiredSkills", resume)
  );
  const preferredSkills = uniqueReqs(extraction.preferredSkills).map((req) =>
    matchRequirement(req, "preferredSkills", resume)
  );
  const responsibilities = uniqueReqs(extraction.responsibilities).map((req) =>
    matchRequirement(req, "responsibilities", resume)
  );
  const education = uniqueReqs(extraction.education).map((req) => matchRequirement(req, "education", resume));

  if (education.length === 0) {
    education.push(matchRequirement("Bachelor's degree or equivalent", "education", resume));
  }

  const experience: RequirementMatch[] = [];
  if (extraction.minimumExperience > 0) {
    const enough = resume.yearsExperience >= extraction.minimumExperience;
    experience.push(
      enforceNoStrongWithoutEvidence({
        requirement: `At least ${extraction.minimumExperience}+ years of professional experience`,
        status: enough ? "strong_match" : "partial_match",
        evidence: enough
          ? [
              `${resume.experience[0]?.role || "Experience"} at ${resume.experience[0]?.company || resume.candidate}; ~${resume.yearsExperience} years across ${resume.experience.map((e) => e.company).join(", ") || "listed roles"}.`,
            ]
          : [],
        gap: enough ? null : `Resume shows about ${resume.yearsExperience} years.`,
        transferable: null,
        category: "experience",
      })
    );
  }

  if (/lead|senior|staff/i.test(extraction.role)) {
    experience.push(matchRequirement("Lead or senior ownership of production systems", "experience", resume));
  }

  return {
    requiredSkills,
    experience,
    responsibilities,
    preferredSkills,
    education: education.filter((row) => row.requirement),
  };
}
