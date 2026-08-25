import { sampleCandidateResume } from "@/data/resume";
import type { CandidateResume } from "@/lib/types";

function person(
  name: string,
  headline: string,
  skills: string[],
  evidence: string[],
  years: number
): CandidateResume {
  const base = sampleCandidateResume();
  return {
    ...base,
    candidate: name,
    headline,
    email: "",
    phone: "",
    linkedin: "",
    github: "",
    portfolio: "",
    yearsExperience: years,
    skills,
    experience: [
      {
        company: "Demo Co",
        role: headline,
        location: "",
        start: "2022",
        end: "Present",
        evidence,
      },
    ],
    education: ["B.S. Computer Science"],
    certifications: [],
    projects: [],
  };
}

/** Labeled demo slate so a recruiter can try comparison without five PDFs. */
export function demoSlate(): { filename: string; resume: CandidateResume }[] {
  const rithvik = sampleCandidateResume();
  return [
    { filename: "rithvik-sample.pdf", resume: rithvik },
    {
      filename: "maya-chen.pdf",
      resume: person(
        "Maya Chen",
        "Senior Full-Stack Engineer",
        ["TypeScript", "React", "Next.js", "Node.js", "PostgreSQL", "Kubernetes", "RAG", "WebSockets"],
        [
          "Shipped Next.js dashboards and Node.js APIs for a real-time operations console.",
          "Ran production RAG evaluations and WebSocket fan-out on Kubernetes.",
        ],
        6
      ),
    },
    {
      filename: "jordan-pike.pdf",
      resume: person(
        "Jordan Pike",
        "Junior Frontend Developer",
        ["JavaScript", "React", "CSS", "HTML"],
        ["Built marketing pages in React and CSS for a two-person startup."],
        1
      ),
    },
    {
      filename: "sam-okonkwo.pdf",
      resume: person(
        "Sam Okonkwo",
        "Backend Engineer",
        ["Java", "Spring Boot", "PostgreSQL", "Kafka", "AWS"],
        [
          "Designed Spring Boot microservices and Kafka consumers for payments.",
          "Operated PostgreSQL and AWS (EC2, RDS, Lambda) in production.",
        ],
        5
      ),
    },
    {
      filename: "alex-rivera.pdf",
      resume: person(
        "Alex Rivera",
        "Product Designer",
        ["Figma", "User research", "Prototyping"],
        ["Shipped Figma design systems and user-research studies for a B2B dashboard."],
        6
      ),
    },
  ];
}
