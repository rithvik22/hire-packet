import { formatResumeEvidence } from "@/data/resume";
import {
  buildEmbeddingIndex,
  flattenResumeEvidence,
  formatRankedEvidence,
  retrieveEvidence,
  retrieveEvidenceEmbedded,
  resumeRelevance,
  resumeRelevanceFromRanked,
  type RankedEvidence,
} from "@/lib/retrieve";
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
  opensearch: ["opensearch", "elasticsearch"],
  elasticsearch: ["elasticsearch", "opensearch"],
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

/** Specific products named in a JD line. Close cousins stay partial, not strong. */
type ToolFamily = {
  id: string;
  pattern: RegExp;
  aliases: string[];
  adjacent: RegExp;
  transfer: string;
};

const NAMED_TOOLS: ToolFamily[] = [
  {
    id: "dbt",
    pattern: /\bdbt\b/i,
    aliases: ["dbt"],
    adjacent: /a^/,
    transfer: "No dbt on the resume; SQL / Postgres modeling is the closest analog.",
  },
  {
    id: "warehouse",
    pattern: /snowflake|bigquery|redshift/i,
    aliases: ["snowflake", "bigquery", "redshift"],
    adjacent: /\b(sql|postgres|postgresql|mysql)\b/i,
    transfer: "No Snowflake / BigQuery / Redshift; resume SQL is on Postgres / MySQL.",
  },
  {
    id: "orchestrator",
    pattern: /\b(airflow|dagster|prefect)\b/i,
    aliases: ["airflow", "dagster", "prefect"],
    adjacent: /\b(kafka|lambda|pipeline)\b/i,
    transfer: "No Airflow / Dagster / Prefect; orchestration on the resume is Kafka / Lambda pipelines.",
  },
  {
    id: "observability",
    pattern: /datadog|prometheus|grafana/i,
    aliases: ["datadog", "prometheus", "grafana"],
    adjacent: /\b(sentry|kubernetes|k8s|monitor)\b/i,
    transfer: "No Datadog / Prometheus / Grafana listed; closest ops signal is Sentry / Kubernetes.",
  },
  {
    id: "search",
    pattern: /elasticsearch|opensearch/i,
    aliases: ["elasticsearch", "opensearch"],
    adjacent: /\b(rag|embeddings|bedrock|vector)\b/i,
    transfer: "No Elasticsearch / OpenSearch on the resume; RAG / embeddings work is adjacent.",
  },
  {
    id: "ltr",
    pattern: /lightgbm|xgboost|learning-to-rank|learning to rank/i,
    aliases: ["lightgbm", "xgboost"],
    adjacent: /\b(rag|embeddings|openai|bedrock)\b/i,
    transfer: "No LightGBM / XGBoost ranker on the resume; retrieval / embeddings work is adjacent.",
  },
  {
    id: "rrf",
    pattern: /\brrf\b|reciprocal rank fusion/i,
    aliases: ["rrf", "reciprocal rank fusion"],
    adjacent: /\b(rag|opensearch|embeddings|hybrid)\b/i,
    transfer: "No RRF listed; hybrid lexical + vector retrieval is the closest analog.",
  },
  {
    id: "eval",
    pattern: /recall@|ndcg|\bmrr\b/i,
    aliases: ["ndcg", "mrr", "recall@k", "recall@"],
    adjacent: /\b(rag|embeddings|opensearch)\b/i,
    transfer: "No recall@k / NDCG / MRR listed; production RAG is adjacent, not an eval harness.",
  },
  {
    id: "vecdb",
    pattern: /\bfaiss\b|\bscann\b|pgvector/i,
    aliases: ["faiss", "scann", "pgvector"],
    adjacent: /\b(opensearch|elasticsearch|embeddings|rag)\b/i,
    transfer: "No FAISS / ScaNN / pgvector; OpenSearch / embeddings is the listed vector store.",
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

function hasAlias(hay: string, aliases: string[]): boolean {
  const n = normalize(hay);
  return aliases.some((alias) => n.includes(normalize(alias)));
}

function namedFamilies(requirement: string): ToolFamily[] {
  return NAMED_TOOLS.filter((family) => family.pattern.test(requirement));
}

/**
 * If the JD names a specific product, Strong requires that product (or a declared alias).
 * Adjacent work becomes Partial with a transferable note — not a full hit.
 */
function applyNamedToolGate(
  requirement: string,
  resume: CandidateResume,
  match: RequirementMatch
): RequirementMatch {
  const families = namedFamilies(requirement);
  if (!families.length) return match;

  const hay = resumeHaystack(resume);
  const missing = families.filter((family) => !hasAlias(hay, family.aliases));
  if (!missing.length) return match;

  const transfer = missing[0]?.transfer ?? transferableFor(requirement, resume) ?? "No direct production experience.";
  const canPartial = missing.every((family) => family.adjacent.test(hay));

  if (match.status === "gap" && !canPartial) {
    return { ...match, transferable: match.transferable ?? transfer, gap: match.gap ?? transfer };
  }

  return {
    ...match,
    status: canPartial ? "partial_match" : "gap",
    evidence: canPartial ? match.evidence : [],
    gap: canPartial ? null : transfer,
    transferable: transfer,
  };
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
  resume: CandidateResume,
  rankedOverride?: RankedEvidence[]
): RequirementMatch {
  const keywords = keywordsIn(requirement, resume);
  const listed = keywords.filter((k) => resume.skills.some((s) => mentions(s, k)));
  const transfer = transferableFor(requirement, resume);

  const lexicalHits = flattenResumeEvidence(resume).filter((row) => {
    if (keywords.length === 0) {
      const tokens = normalize(requirement)
        .split(" ")
        .filter((t) => t.length > 4);
      return tokens.some((t) => normalize(row.text).includes(t));
    }
    return keywords.some((k) => mentions(row.text, k));
  });

  const ranked = rankedOverride ?? retrieveEvidence(requirement, resume, 5);
  const semanticHits = ranked.filter((row) => row.score >= 0.18);
  const relevance = rankedOverride
    ? resumeRelevanceFromRanked(ranked, requirement, resume)
    : resumeRelevance(requirement, resume);

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

  return applyNamedToolGate(
    requirement,
    resume,
    enforceNoStrongWithoutEvidence({
      requirement,
      status,
      evidence: status === "gap" ? [] : evidence,
      gap: status === "gap" ? transfer ?? "No direct production experience." : null,
      transferable: status === "gap" ? transfer : null,
      category,
    })
  );
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

function yearsExperienceMatch(extraction: JdExtraction, resume: CandidateResume): RequirementMatch | null {
  if (extraction.minimumExperience <= 0) return null;
  const enough = resume.yearsExperience >= extraction.minimumExperience;
  return enforceNoStrongWithoutEvidence({
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
  });
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
  const years = yearsExperienceMatch(extraction, resume);
  if (years) experience.push(years);

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

/** Same matching rules, but ranks evidence with Gemini embeddings when available. */
export async function matchJobAsync(
  extraction: JdExtraction,
  resume: CandidateResume
): Promise<Record<ScoreCategory, RequirementMatch[]>> {
  const reqLists = {
    requiredSkills: uniqueReqs(extraction.requiredSkills),
    preferredSkills: uniqueReqs(extraction.preferredSkills),
    responsibilities: uniqueReqs(extraction.responsibilities),
    education: uniqueReqs(extraction.education),
  };
  const leadReq = /lead|senior|staff/i.test(extraction.role)
    ? "Lead or senior ownership of production systems"
    : null;
  const allReqs = [
    ...reqLists.requiredSkills,
    ...reqLists.preferredSkills,
    ...reqLists.responsibilities,
    ...(reqLists.education.length ? reqLists.education : ["Bachelor's degree or equivalent"]),
    ...(leadReq ? [leadReq] : []),
  ];

  const index = await buildEmbeddingIndex(allReqs, resume);
  const rankedFor = async (requirement: string) => {
    if (!index) return retrieveEvidenceEmbedded(requirement, resume, 5);
    return retrieveEvidenceEmbedded(requirement, resume, 5, {
      query: index.queries.get(requirement) ?? null,
      docs: index.docs,
    });
  };

  const requiredSkills = await Promise.all(
    reqLists.requiredSkills.map(async (req) => matchRequirement(req, "requiredSkills", resume, await rankedFor(req)))
  );
  const preferredSkills = await Promise.all(
    reqLists.preferredSkills.map(async (req) => matchRequirement(req, "preferredSkills", resume, await rankedFor(req)))
  );
  const responsibilities = await Promise.all(
    reqLists.responsibilities.map(async (req) =>
      matchRequirement(req, "responsibilities", resume, await rankedFor(req))
    )
  );
  const educationReqs = reqLists.education.length ? reqLists.education : ["Bachelor's degree or equivalent"];
  const education = await Promise.all(
    educationReqs.map(async (req) => matchRequirement(req, "education", resume, await rankedFor(req)))
  );

  const experience: RequirementMatch[] = [];
  const years = yearsExperienceMatch(extraction, resume);
  if (years) experience.push(years);
  if (leadReq) {
    experience.push(matchRequirement(leadReq, "experience", resume, await rankedFor(leadReq)));
  }

  return {
    requiredSkills,
    experience,
    responsibilities,
    preferredSkills,
    education: education.filter((row) => row.requirement),
  };
}
