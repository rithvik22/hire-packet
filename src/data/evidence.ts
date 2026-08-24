export type EvidenceEntry = {
  id: string;
  source: string;
  skillHints: string[];
  text: string;
};

export const EVIDENCE: EvidenceEntry[] = [
  {
    id: "hv-1",
    source: "Healthvice Inc. — WellFed",
    skillHints: ["architecture", "AI", "React Native", "React", "Next.js", "TypeScript", "iOS", "Android", "lead", "full-stack"],
    text: "Architected WellFed from the ground up — AI-powered nutrition and social meal-planning across web, iOS, and Android — leading backend, frontend, mobile, AI, and DevOps.",
  },
  {
    id: "hv-2",
    source: "Healthvice Inc. — WellFed",
    skillHints: ["NestJS", "Node.js", "Java", "Bun", "REST", "GraphQL", "microservices", "TypeScript", "JavaScript"],
    text: "Built NestJS / Node / Java / Bun services with REST and GraphQL for recipes, users, collections, subscriptions, meal planning, and social features.",
  },
  {
    id: "hv-3",
    source: "Healthvice Inc. — WellFed",
    skillHints: [
      "Firebase Auth",
      "OAuth 2.0",
      "JWT",
      "RBAC",
      "OWASP",
      "Kafka",
      "Socket.IO",
      "MongoDB",
      "Redis",
      "RAG",
      "OpenAI",
      "webhooks",
      "real-time",
    ],
    text: "Implemented Firebase Auth, OAuth 2.0, JWT, RBAC, OWASP hardening, Kafka + Socket.IO workflows, MongoDB + Redis, and production RAG with OpenAI.",
  },
  {
    id: "hv-4",
    source: "Healthvice Inc. — WellFed",
    skillHints: [
      "Terraform",
      "Kubernetes",
      "AWS",
      "EC2",
      "S3",
      "RDS",
      "Lambda",
      "Azure",
      "AKS",
      "CI/CD",
      "Docker",
    ],
    text: "Provisioned Terraform / Kubernetes infra; deployed on AWS (EC2, S3, RDS, Lambda) and Azure (AKS, ACR, DevOps CI/CD).",
  },
  {
    id: "uls-1",
    source: "Unique Logic Solutions",
    skillHints: ["Java", "Spring Boot", "React", "PostgreSQL", "AWS", "pharmacy", "payments"],
    text: "Built an online pharmacy platform with Java, Spring Boot, React, PostgreSQL, and AWS for prescriptions, pharmacist review, ordering, and payments.",
  },
  {
    id: "uls-2",
    source: "Unique Logic Solutions",
    skillHints: ["Spring Boot", "microservices", "Kafka", "events", "payments"],
    text: "Designed Spring Boot microservices and Kafka producers/consumers for async prescription, order, and payment events.",
  },
  {
    id: "uls-3",
    source: "Unique Logic Solutions",
    skillHints: [
      "Python",
      "AWS Lambda",
      "S3",
      "Textract",
      "embeddings",
      "OpenSearch",
      "Amazon Bedrock",
      "RAG",
      "AI",
    ],
    text: "Built a Python AI pharmacist-review workflow using AWS Lambda, S3, Textract, Titan Embeddings, OpenSearch, and Amazon Bedrock.",
  },
  {
    id: "cog-1",
    source: "Cognizant",
    skillHints: ["Java", "Spring Boot", "Node.js", "React", "REST", "PostgreSQL"],
    text: "Delivered an employee-management application with Java, Spring Boot, Node.js, React, REST APIs, and PostgreSQL.",
  },
  {
    id: "cog-2",
    source: "Cognizant",
    skillHints: ["REST", "Hibernate", "JPA", "MongoDB", "AWS", "EC2", "S3", "RDS", "Lambda", "SQS", "SNS"],
    text: "Owned REST endpoints, Hibernate/JPA data layers, MongoDB modules, and AWS deployments (EC2, S3, RDS, Lambda, SQS/SNS).",
  },
  {
    id: "proj-1",
    source: "Project: AI-Enhanced Vintage Car Auction",
    skillHints: ["Spring Boot", "React", "Python", "PostgreSQL", "Bedrock", "OpenSearch", "embeddings"],
    text: "Full-stack auction platform with semantic search and personalized recommendations via Bedrock embeddings and OpenSearch.",
  },
  {
    id: "proj-2",
    source: "Project: Ride & Food Booking Mobile App",
    skillHints: ["React Native", "Node.js", "Python", "MySQL", "MongoDB", "payments"],
    text: "Cross-platform booking for rides and food with payments, location analysis, and order tracking.",
  },
  {
    id: "edu-ms",
    source: "University of Memphis",
    skillHints: ["MS", "Computer Science", "degree", "master"],
    text: "MS, Computer Science — University of Memphis (2024).",
  },
  {
    id: "edu-bt",
    source: "Anurag University",
    skillHints: ["B.Tech", "Computer Science", "degree", "bachelor"],
    text: "B.Tech, Computer Science — Anurag University (2022).",
  },
  {
    id: "cert-aws",
    source: "Certification",
    skillHints: ["AWS", "Certified Developer", "cloud certification"],
    text: "AWS Certified Developer — Associate.",
  },
  {
    id: "cert-ml",
    source: "Certification",
    skillHints: ["machine learning", "Python", "Applied ML"],
    text: "Applied Machine Learning in Python — University of Michigan.",
  },
];

const BY_ID = new Map(EVIDENCE.map((e) => [e.id, e]));

export function getEvidence(id: string | null | undefined): EvidenceEntry | null {
  if (!id) return null;
  return BY_ID.get(id) ?? null;
}

export function evidenceIds(): string[] {
  return EVIDENCE.map((e) => e.id);
}

export function findEvidenceForSkill(skill: string): EvidenceEntry | null {
  const needle = skill.toLowerCase();
  const hinted = EVIDENCE.find((e) =>
    e.skillHints.some((h) => {
      const hint = h.toLowerCase();
      return needle.includes(hint) || hint.includes(needle);
    })
  );
  if (hinted) return hinted;
  return EVIDENCE.find((e) => e.text.toLowerCase().includes(needle)) ?? null;
}

export function formatEvidence(entry: EvidenceEntry): string {
  return `${entry.source}: ${entry.text}`;
}
