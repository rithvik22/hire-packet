import { formatResumeEvidence } from "@/data/resume";
import { cosineSimilarity, embedDocuments, embedTexts, embeddingsEnabled } from "@/lib/embed";
import type { CandidateResume, ResumeEvidence } from "@/lib/types";

/** Related terms expand a JD line so wording mismatches still retrieve the right bullets. */
const CONCEPTS: Record<string, string[]> = {
  kubernetes: ["k8s", "container", "orchestration", "cluster", "aks", "eks"],
  docker: ["container", "containerization", "image"],
  terraform: ["iac", "infrastructure", "provision"],
  kafka: ["event", "streaming", "pubsub", "queue", "async", "messaging"],
  sqs: ["queue", "async", "messaging", "event"],
  sns: ["pubsub", "messaging", "notification", "event"],
  webhook: ["callback", "event", "integration"],
  oauth: ["auth", "authentication", "authorization", "identity", "sso"],
  jwt: ["auth", "token", "authentication"],
  rbac: ["authorization", "permissions", "access control", "roles"],
  postgres: ["postgresql", "sql", "relational", "rdbms"],
  postgresql: ["postgres", "sql", "relational"],
  mongodb: ["mongo", "document", "nosql"],
  redis: ["cache", "caching", "in-memory"],
  aws: ["cloud", "ec2", "s3", "lambda", "rds", "bedrock"],
  azure: ["cloud", "aks"],
  nestjs: ["node", "nodejs", "typescript", "api", "backend"],
  "node.js": ["node", "nodejs", "javascript", "backend", "api"],
  "spring boot": ["java", "spring", "microservices", "api", "backend"],
  react: ["frontend", "ui", "spa", "javascript"],
  "next.js": ["react", "frontend", "ssr"],
  graphql: ["api", "query", "schema"],
  rest: ["api", "http", "endpoint"],
  microservices: ["distributed", "service", "backend"],
  rag: ["retrieval", "embeddings", "vector", "llm", "openai", "bedrock"],
  embeddings: ["vector", "semantic", "retrieval", "rag"],
  openai: ["llm", "gpt", "ai", "generative"],
  bedrock: ["llm", "aws", "ai", "generative"],
  cicd: ["ci", "cd", "pipeline", "jenkins", "deploy"],
  "ci/cd": ["cicd", "pipeline", "jenkins", "deploy"],
  observability: ["monitoring", "metrics", "tracing", "logging", "sentry"],
  ranking: ["relevance", "score", "retrieval", "search"],
  search: ["retrieval", "index", "opensearch", "elasticsearch", "ranking"],
  opensearch: ["elasticsearch", "search", "index", "vector"],
  elasticsearch: ["opensearch", "search", "index"],
};

const STOP = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "of",
  "to",
  "in",
  "for",
  "with",
  "on",
  "at",
  "by",
  "from",
  "as",
  "is",
  "are",
  "be",
  "this",
  "that",
  "your",
  "our",
  "using",
  "use",
  "used",
  "experience",
  "strong",
  "ability",
  "knowledge",
  "including",
  "etc",
  "plus",
  "years",
  "year",
]);

export type RankedEvidence = ResumeEvidence & {
  score: number;
  reasons: string[];
};

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9.+#/]+/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 1 && !STOP.has(t));
}

function expandTerms(terms: string[]): string[] {
  const out = new Set(terms);
  for (const term of terms) {
    const related = CONCEPTS[term];
    if (related) related.forEach((r) => tokenize(r).forEach((t) => out.add(t)));
    for (const [key, values] of Object.entries(CONCEPTS)) {
      if (values.some((v) => tokenize(v).includes(term) || v === term)) {
        out.add(key);
        tokenize(key).forEach((t) => out.add(t));
        values.forEach((v) => tokenize(v).forEach((t) => out.add(t)));
      }
    }
  }
  return [...out];
}

function termFreq(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  for (const t of tokens) tf.set(t, (tf.get(t) || 0) + 1);
  return tf;
}

function cosine(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (const [k, av] of a) {
    na += av * av;
    const bv = b.get(k);
    if (bv) dot += av * bv;
  }
  for (const bv of b.values()) nb += bv * bv;
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

function weightedVector(tokens: string[], idf: Map<string, number>): Map<string, number> {
  const tf = termFreq(tokens);
  const vec = new Map<string, number>();
  for (const [term, count] of tf) {
    const weight = (1 + Math.log(count)) * (idf.get(term) ?? 1);
    vec.set(term, weight);
  }
  return vec;
}

export function flattenResumeEvidence(resume: CandidateResume): ResumeEvidence[] {
  const jobs = resume.experience.flatMap((job) =>
    job.evidence.map((text) => ({ company: job.company, role: job.role, text }))
  );
  const projects = resume.projects
    .map((project) => ({
      company: project.name,
      role: "Project",
      text: [project.summary, project.tech.join(", ")].filter(Boolean).join(" — "),
    }))
    .filter((row) => row.text.trim().length > 8);
  return [...jobs, ...projects];
}

function buildIdf(docs: string[][]): Map<string, number> {
  const df = new Map<string, number>();
  const n = Math.max(docs.length, 1);
  for (const doc of docs) {
    for (const term of new Set(doc)) df.set(term, (df.get(term) || 0) + 1);
  }
  const idf = new Map<string, number>();
  for (const [term, count] of df) {
    idf.set(term, Math.log(1 + n / count));
  }
  return idf;
}

/**
 * Rank resume bullets against a JD requirement using expanded terms + TF-IDF cosine.
 * Deterministic. No network. Evidence text is never invented.
 */
export function retrieveEvidence(
  requirement: string,
  resume: CandidateResume,
  topK = 3
): RankedEvidence[] {
  return retrieveEvidenceLexical(requirement, resume, topK);
}

function retrieveEvidenceLexical(
  requirement: string,
  resume: CandidateResume,
  topK = 3
): RankedEvidence[] {
  const corpus = flattenResumeEvidence(resume);
  if (corpus.length === 0) return [];

  const queryTokens = expandTerms(tokenize(requirement));
  const skillBoost = new Set(
    resume.skills.flatMap((skill) => expandTerms(tokenize(skill))).filter((t) => queryTokens.includes(t))
  );

  const docTokens = corpus.map((row) => expandTerms(tokenize(`${row.company} ${row.role} ${row.text}`)));
  const idf = buildIdf([queryTokens, ...docTokens]);
  const queryVec = weightedVector(queryTokens, idf);

  const ranked: RankedEvidence[] = corpus.map((row, i) => {
    const docVec = weightedVector(docTokens[i], idf);
    let score = cosine(queryVec, docVec);

    const reasons: string[] = [];
    const overlap = [...skillBoost].filter((t) => docTokens[i].includes(t));
    if (overlap.length) {
      score += Math.min(0.18, overlap.length * 0.04);
      reasons.push(`skill overlap: ${overlap.slice(0, 4).join(", ")}`);
    }

    const rawHits = tokenize(requirement).filter(
      (t) => t.length > 3 && tokenize(row.text).includes(t)
    );
    if (rawHits.length) {
      score += Math.min(0.12, rawHits.length * 0.03);
      reasons.push(`term hit: ${rawHits.slice(0, 3).join(", ")}`);
    }

    return { ...row, score: Math.round(score * 1000) / 1000, reasons };
  });

  return ranked
    .filter((row) => row.score >= 0.12)
    .sort((a, b) => b.score - a.score || a.text.localeCompare(b.text))
    .slice(0, topK);
}

/**
 * Hybrid retrieval: Gemini embeddings + lexical TF-IDF.
 * Falls back to lexical-only when embeddings are off or fail.
 * Never invents evidence text — only ranks existing resume bullets.
 */
export async function retrieveEvidenceEmbedded(
  requirement: string,
  resume: CandidateResume,
  topK = 5,
  precomputed?: { query?: number[] | null; docs?: (number[] | null)[] }
): Promise<RankedEvidence[]> {
  const lexical = retrieveEvidenceLexical(requirement, resume, Math.max(topK, 8));
  const corpus = flattenResumeEvidence(resume);
  if (!corpus.length || !embeddingsEnabled()) return lexical.slice(0, topK);

  let queryVec = precomputed?.query ?? null;
  let docVecs = precomputed?.docs ?? null;

  if (!queryVec || !docVecs) {
    const docs = await embedDocuments(corpus.map((row) => `${row.role} at ${row.company}: ${row.text}`));
    const [q] = await embedTexts([requirement], "RETRIEVAL_QUERY");
    queryVec = q;
    docVecs = docs;
  }

  if (!queryVec || !docVecs.some(Boolean)) return lexical.slice(0, topK);

  const byText = new Map(lexical.map((row) => [row.text, row]));
  const blended: RankedEvidence[] = corpus.map((row, i) => {
    const docVec = docVecs![i];
    const embedScore = docVec ? cosineSimilarity(queryVec!, docVec) : 0;
    const lex = byText.get(row.text);
    const lexScore = lex?.score ?? 0;
    const score = Math.round((embedScore * 0.72 + lexScore * 0.28) * 1000) / 1000;
    const reasons = [
      ...(embedScore >= 0.35 ? [`embed ${embedScore.toFixed(2)}`] : []),
      ...(lex?.reasons || []),
    ];
    return { ...row, score, reasons };
  });

  return blended
    .filter((row) => row.score >= 0.22)
    .sort((a, b) => b.score - a.score || a.text.localeCompare(b.text))
    .slice(0, topK);
}

/** Prefetch embeddings for one resume + many requirements (one/two batch calls). */
export async function buildEmbeddingIndex(
  requirements: string[],
  resume: CandidateResume
): Promise<{
  queries: Map<string, number[] | null>;
  docs: (number[] | null)[];
} | null> {
  if (!embeddingsEnabled()) return null;
  const corpus = flattenResumeEvidence(resume);
  if (!corpus.length) return null;

  const docs = await embedDocuments(corpus.map((row) => `${row.role} at ${row.company}: ${row.text}`));
  const queryVecs = await embedTexts(requirements, "RETRIEVAL_QUERY");
  if (!docs.some(Boolean) && !queryVecs.some(Boolean)) return null;

  const queries = new Map<string, number[] | null>();
  requirements.forEach((req, i) => queries.set(req, queryVecs[i] ?? null));
  return { queries, docs };
}

export function formatRankedEvidence(rows: RankedEvidence[]): string[] {
  return rows.map(formatResumeEvidence);
}

/** Similarity of a requirement to the whole resume (skills + top evidence). */
export function resumeRelevance(requirement: string, resume: CandidateResume): number {
  const top = retrieveEvidence(requirement, resume, 3);
  if (top.length === 0) return 0;
  const best = top[0].score;
  const listed = resume.skills.some((skill) => {
    const a = new Set(expandTerms(tokenize(requirement)));
    const b = expandTerms(tokenize(skill));
    return b.some((t) => a.has(t));
  });
  return Math.min(1, best + (listed ? 0.08 : 0));
}

export function resumeRelevanceFromRanked(
  ranked: RankedEvidence[],
  requirement: string,
  resume: CandidateResume
): number {
  if (!ranked.length) return resumeRelevance(requirement, resume);
  const best = ranked[0].score;
  const listed = resume.skills.some((skill) => {
    const a = new Set(expandTerms(tokenize(requirement)));
    const b = expandTerms(tokenize(skill));
    return b.some((t) => a.has(t));
  });
  return Math.min(1, best + (listed ? 0.08 : 0));
}
