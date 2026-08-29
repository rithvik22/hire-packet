import { describe, expect, it } from "vitest";
import { extractJdHeuristic } from "@/lib/extract";
import { SAMPLE_JD } from "@/data/sample-jd";

const QUIZLET_JD = `Sr Backend Engineer — Quizlet
Location: San Francisco or New York · Hybrid (Wed/Thu in office) · Full-time
Compensation: $167k–$219k

In this role, you will:
- Design, build, and maintain data pipelines that ingest, transform, and load content into Elasticsearch indices at scale.
- Build and operate hybrid retrieval, combining lexical (BM25) search with dense vector similarity in Elasticsearch.

What you bring to the table:
- Minimum 4+ years of experience in backend or data engineering.
- Strong SQL and experience with data warehouses (Snowflake, BigQuery, Redshift, or similar).
- Experience with dbt for data transformation, modeling, and testing within the warehouse.
- Hands-on experience with Elasticsearch or OpenSearch in production.
- Comfort with containerization and deployment (Docker, Kubernetes) for production services.

Bonus points:
- Experience with batch and/or streaming data processing (Spark, Kafka, Flink, or similar).
- Understanding of retrieval evaluation basics (recall@k, NDCG, MRR).
`;

describe("extractJdHeuristic", () => {
  it("skips location and pay on a Quizlet-style JD", () => {
    const extracted = extractJdHeuristic(QUIZLET_JD);
    expect(extracted.role).toMatch(/Quizlet/i);
    expect(extracted.minimumExperience).toBe(4);
    const blob = [...extracted.requiredSkills, ...extracted.responsibilities, ...extracted.preferredSkills].join(" ");
    expect(blob).not.toMatch(/San Francisco/);
    expect(blob).not.toMatch(/\$167/);
    expect(extracted.requiredSkills.join(" ")).toMatch(/dbt/i);
    expect(extracted.requiredSkills.join(" ")).toMatch(/OpenSearch|Elasticsearch/i);
    expect(extracted.preferredSkills.join(" ")).toMatch(/Kafka/i);
    expect(extracted.responsibilities.join(" ")).toMatch(/Elasticsearch/i);
  });

  it("still reads the sample Northline JD", () => {
    const extracted = extractJdHeuristic(SAMPLE_JD);
    expect(extracted.role).toMatch(/Full-Stack/i);
    expect(extracted.requiredSkills.join(" ")).toMatch(/TypeScript|React|AWS/i);
    expect(extracted.responsibilities.join(" ")).toMatch(/NestJS|PostgreSQL/i);
    expect(extracted.preferredSkills.join(" ")).toMatch(/Kafka|OpenSearch/i);
  });

  it("ignores LinkedIn chrome and does not dump preferred skills into education", () => {
    const extracted = extractJdHeuristic(`Senior Full Stack Engineer
Show match details
Tailor my resume
Help me stand out
Create cover letter
Is this information helpful?
About the job
Key Responsibilities
End-to-End Development: Design scalable Node.js and React applications.
API Design and Integration: Architect RESTful APIs and microservices.
Requirements
Experience: 7+ years in full-stack development, with 5+ years focused on Node.js and React.
Advanced proficiency in JavaScript, TypeScript, and Node.js frameworks (e.g., Express).
Education: Bachelor’s degree in Computer Science, Engineering, or a related field.
Preferred Skills
Proficiency in advanced front-end frameworks (e.g., Next.js, Vue.js) and state management.
Knowledge of performance monitoring tools (e.g., New Relic, Datadog).
Why Pearpop?
Impactful Role: Shape the technical backbone of Pearpop’s creator platform, driving innovation in the $250B creator economy.
`);
    expect(extracted.role).toMatch(/Senior Full Stack/i);
    expect(extracted.minimumExperience).toBe(7);
    expect(extracted.requiredSkills.join(" ")).not.toMatch(/Show match details|Tailor my resume/i);
    expect(extracted.requiredSkills.join(" ")).toMatch(/Node\.js|TypeScript/i);
    expect(extracted.responsibilities.join(" ")).toMatch(/RESTful APIs/i);
    expect(extracted.preferredSkills.join(" ")).toMatch(/Next\.js|Datadog/i);
    expect(extracted.preferredSkills.join(" ")).not.toMatch(/\$250B|Impactful Role/i);
    expect(extracted.education.join(" ")).toMatch(/Bachelor|Computer Science/i);
    expect(extracted.education.join(" ")).not.toMatch(/Next\.js|Datadog/i);
  });
});
