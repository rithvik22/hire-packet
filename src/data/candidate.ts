export type Experience = {
  title: string;
  company: string;
  location: string;
  start: string;
  end: string;
  highlights: string[];
};

export type CandidateProfile = {
  name: string;
  headline: string;
  location: string;
  email: string;
  phone: string;
  linkedin: string;
  github: string;
  portfolio: string;
  summary: string;
  skills: {
    languages: string[];
    frontend: string[];
    backend: string[];
    data: string[];
    ai: string[];
    cloud: string[];
    security: string[];
    messaging: string[];
  };
  experience: Experience[];
  education: { degree: string; school: string; year: string }[];
  certifications: string[];
  projects: { name: string; summary: string; tech: string[] }[];
};

export const candidate: CandidateProfile = {
  name: "Rithvik Reddy Velapati",
  headline: "Lead Full-Stack Developer · AI · Cloud",
  location: "Irving, TX",
  email: "velapatirithvik@gmail.com",
  phone: "+1 (901) 658-7572",
  linkedin: "https://www.linkedin.com/in/rithvikvelapati",
  github: "https://github.com/rithvik22",
  portfolio: "https://rithvik22.github.io/Personal_Portfolio/",
  summary:
    "Full-Stack Developer with nearly four years building enterprise, web, mobile, and AI-powered applications. Promoted to Lead Developer at Healthvice; strong in Java, Spring Boot, Node.js, NestJS, React, Next.js, REST, microservices, PostgreSQL, MongoDB, AWS, Azure, OAuth 2.0, Docker, Kubernetes, and CI/CD.",
  skills: {
    languages: ["Java", "JavaScript", "TypeScript", "Python", "SQL"],
    frontend: ["React", "Next.js", "Angular", "React Native", "Tailwind CSS", "WCAG"],
    backend: ["Node.js", "NestJS", "Spring Boot", "Bun", "REST", "GraphQL", "Microservices"],
    data: ["MongoDB", "PostgreSQL", "MySQL", "Redis", "TypeORM", "Hibernate", "JPA"],
    ai: [
      "OpenAI API",
      "Amazon Bedrock",
      "RAG",
      "Embeddings",
      "Replicate",
      "Zod",
      "Instructor",
      "LLM Evaluations",
    ],
    cloud: [
      "AWS",
      "Azure",
      "Terraform",
      "Docker",
      "Kubernetes",
      "Jenkins",
      "CI/CD",
      "Sentry",
    ],
    security: ["OAuth 2.0", "JWT", "Firebase Auth", "RBAC", "OWASP"],
    messaging: ["Apache Kafka", "SQS", "SNS", "Webhooks", "Socket.IO"],
  },
  experience: [
    {
      title: "Lead Developer (promoted from Full-Stack Software Engineer)",
      company: "Healthvice Inc. — WellFed",
      location: "Woodstock, GA",
      start: "08/2024",
      end: "Present",
      highlights: [
        "Architected WellFed from the ground up — AI-powered nutrition and social meal-planning across web, iOS, and Android — leading backend, frontend, mobile, AI, and DevOps.",
        "Built NestJS / Node / Java / Bun services with REST and GraphQL for recipes, users, collections, subscriptions, meal planning, and social features.",
        "Implemented Firebase Auth, OAuth 2.0, JWT, RBAC, OWASP hardening, Kafka + Socket.IO workflows, MongoDB + Redis, and production RAG with OpenAI.",
        "Provisioned Terraform / Kubernetes infra; deployed on AWS (EC2, S3, RDS, Lambda) and Azure (AKS, ACR, DevOps CI/CD).",
      ],
    },
    {
      title: "Software Developer",
      company: "Unique Logic Solutions",
      location: "Bentonville, AR",
      start: "05/2024",
      end: "08/2024",
      highlights: [
        "Built an online pharmacy platform with Java, Spring Boot, React, PostgreSQL, and AWS for prescriptions, pharmacist review, ordering, and payments.",
        "Designed Spring Boot microservices and Kafka producers/consumers for async prescription, order, and payment events.",
        "Built a Python AI pharmacist-review workflow using AWS Lambda, S3, Textract, Titan Embeddings, OpenSearch, and Amazon Bedrock.",
      ],
    },
    {
      title: "Java Software Developer",
      company: "Cognizant",
      location: "Hyderabad, India",
      start: "01/2021",
      end: "07/2022",
      highlights: [
        "Delivered an employee-management application with Java, Spring Boot, Node.js, React, REST APIs, and PostgreSQL.",
        "Owned REST endpoints, Hibernate/JPA data layers, MongoDB modules, and AWS deployments (EC2, S3, RDS, Lambda, SQS/SNS).",
      ],
    },
  ],
  education: [
    {
      degree: "MS, Computer Science",
      school: "University of Memphis",
      year: "2024",
    },
    {
      degree: "B.Tech, Computer Science",
      school: "Anurag University",
      year: "2022",
    },
  ],
  certifications: [
    "AWS Certified Developer — Associate",
    "Applied Machine Learning in Python — University of Michigan",
  ],
  projects: [
    {
      name: "AI-Enhanced Vintage Car Auction",
      summary:
        "Full-stack auction platform with semantic search and personalized recommendations via Bedrock embeddings and OpenSearch.",
      tech: ["Spring Boot", "React", "Python", "PostgreSQL", "Bedrock", "OpenSearch"],
    },
    {
      name: "Ride & Food Booking Mobile App",
      summary:
        "Cross-platform booking for rides and food with payments, location analysis, and order tracking.",
      tech: ["React Native", "Node.js", "Python", "MySQL", "MongoDB"],
    },
  ],
};

export function flattenSkills(profile: CandidateProfile = candidate): string[] {
  return Object.values(profile.skills).flat();
}
