import { candidate } from "@/data/candidate";

export type ResumeEvidence = {
  company: string;
  role: string;
  text: string;
};

export type FrozenResume = {
  candidate: string;
  yearsExperience: number;
  skills: string[];
  experience: {
    company: string;
    role: string;
    evidence: string[];
  }[];
  education: string[];
  certifications: string[];
};

/** Frozen source of truth. Gemini never writes this file and never receives it during JD extraction. */
export const resume: FrozenResume = {
  candidate: candidate.name,
  yearsExperience: 4,
  skills: [
    "Java",
    "JavaScript",
    "TypeScript",
    "Python",
    "SQL",
    "React",
    "Next.js",
    "Angular",
    "React Native",
    "Tailwind CSS",
    "Node.js",
    "NestJS",
    "Spring Boot",
    "Bun",
    "REST",
    "GraphQL",
    "Microservices",
    "MongoDB",
    "PostgreSQL",
    "MySQL",
    "Redis",
    "AWS",
    "Azure",
    "Terraform",
    "Docker",
    "Kubernetes",
    "Jenkins",
    "CI/CD",
    "OpenAI",
    "Amazon Bedrock",
    "RAG",
    "Replicate",
    "OAuth 2.0",
    "JWT",
    "Kafka",
    "Socket.IO",
    "Webhooks",
  ],
  experience: [
    {
      company: "Healthvice Inc. — WellFed",
      role: "Lead Developer",
      evidence: [
        "Built React and Next.js customer-facing features",
        "Developed REST and GraphQL APIs using Node.js and NestJS",
        "Implemented AI workflows using OpenAI and Replicate",
        "Architected WellFed from the ground up — AI-powered nutrition and social meal-planning across web, iOS, and Android — leading backend, frontend, mobile, AI, and DevOps.",
        "Built NestJS / Node / Java / Bun services with REST and GraphQL for recipes, users, collections, subscriptions, meal planning, and social features.",
        "Implemented Firebase Auth, OAuth 2.0, JWT, RBAC, OWASP hardening, Kafka + Socket.IO workflows, MongoDB + Redis, and production RAG with OpenAI.",
        "Provisioned Terraform / Kubernetes infra; deployed on AWS (EC2, S3, RDS, Lambda) and Azure (AKS, ACR, DevOps CI/CD).",
      ],
    },
    {
      company: "Unique Logic Solutions",
      role: "Software Developer",
      evidence: [
        "Built an online pharmacy platform with Java, Spring Boot, React, PostgreSQL, and AWS for prescriptions, pharmacist review, ordering, and payments.",
        "Designed Spring Boot microservices and Kafka producers/consumers for async prescription, order, and payment events.",
        "Built a Python AI pharmacist-review workflow using AWS Lambda, S3, Textract, Titan Embeddings, OpenSearch, and Amazon Bedrock.",
      ],
    },
    {
      company: "Cognizant",
      role: "Java Software Developer",
      evidence: [
        "Delivered an employee-management application with Java, Spring Boot, Node.js, React, REST APIs, and PostgreSQL.",
        "Owned REST endpoints, Hibernate/JPA data layers, MongoDB modules, and AWS deployments (EC2, S3, RDS, Lambda, SQS/SNS).",
      ],
    },
  ],
  education: [
    "MS, Computer Science — University of Memphis (2024)",
    "B.Tech, Computer Science — Anurag University (2022)",
  ],
  certifications: [
    "AWS Certified Developer — Associate",
    "Applied Machine Learning in Python — University of Michigan",
  ],
};

Object.freeze(resume);
resume.experience.forEach((job) => {
  Object.freeze(job);
  Object.freeze(job.evidence);
});

export function flattenResumeEvidence(): ResumeEvidence[] {
  return resume.experience.flatMap((job) =>
    job.evidence.map((text) => ({ company: job.company, role: job.role, text }))
  );
}

export function formatResumeEvidence(hit: ResumeEvidence): string {
  return `${hit.company}: ${hit.text}`;
}
