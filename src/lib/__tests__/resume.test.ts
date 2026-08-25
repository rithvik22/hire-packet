import { describe, expect, it } from "vitest";
import { extractResumeHeuristic, parseCandidateResume } from "@/lib/extract-resume";
import { MAX_RESUME_BYTES, normalizeResumeLayout, resumeFileError } from "@/lib/parse-file";
import { MIN_RESUME_CHARS, sanitizeResumeText, wrapUntrustedResume } from "@/lib/sanitize";
import { heuristicFit } from "@/lib/heuristic";
import { SAMPLE_JD } from "@/data/sample-jd";

const SAMPLE_TEXT = `
Alex Rivera
Product Designer · Austin, TX
alex.rivera@example.com
https://linkedin.com/in/alexrivera

Skills
Figma, User research, Prototyping, Design systems

Experience
Product Designer — Northwind
2020 — Present
Shipped Figma design systems and user-research studies for a B2B dashboard.
Led prototyping workshops with engineering.

Education
BFA, Graphic Design — RISD (2018)
`.repeat(1);

describe("resume file limits", () => {
  it("rejects non PDF/DOCX names", () => {
    expect(resumeFileError({ name: "cv.txt", size: 1200 })).toMatch(/PDF or DOCX/i);
  });

  it("rejects oversized files", () => {
    expect(resumeFileError({ name: "cv.pdf", size: MAX_RESUME_BYTES + 1 })).toMatch(/4 MB/i);
  });

  it("accepts a small pdf", () => {
    expect(resumeFileError({ name: "cv.pdf", size: 20_000 })).toBeNull();
  });

  it("breaks PDF-style section headings onto their own lines", () => {
    const text = normalizeResumeLayout("Alex Rivera  Skills Figma React  Experience Lead at Acme 2022");
    expect(text).toMatch(/Skills/);
    expect(text).toMatch(/Experience/);
    expect(text.split("\n").length).toBeGreaterThan(2);
  });
});

describe("resume text sanitize", () => {
  it("rejects too-short extracts", () => {
    expect(sanitizeResumeText("hi").error).toBeTruthy();
    expect(MIN_RESUME_CHARS).toBe(180);
  });

  it("wraps untrusted resume text", () => {
    const wrapped = wrapUntrustedResume("Worked at Acme");
    expect(wrapped).toContain("UNTRUSTED RESUME TEXT");
    expect(wrapped).toContain("Worked at Acme");
  });
});

describe("heuristic resume extract", () => {
  it("pulls name, email, skills, and evidence", () => {
    const resume = extractResumeHeuristic(SAMPLE_TEXT);
    const parsed = parseCandidateResume(resume);
    expect(parsed.candidate).toMatch(/Alex Rivera/);
    expect(parsed.email).toMatch(/alex\.rivera/);
    expect(parsed.skills.join(" ")).toMatch(/Figma/i);
    expect(parsed.experience.some((job) => job.evidence.join(" ").includes("Figma"))).toBe(true);
  });

  it("does not treat summary prose as a job title", () => {
    const blob = `
RITHVIK REDDY VELAPATI
Irving, TX
velapatirithvik@gmail.com
linkedin.com/in/rithvikvelapati
github.com/rithvik22
Full-Stack Developer with nearly four years building enterprise, web, mobile, and AI-powered applications. Promoted to Lead Developer at Healthvice, leading backend, frontend, mobile, AI, and cloud delivery. Experienced in OAuth 2.0 authentication, event-driven systems, Docker, Kubernetes, and CI/CD.
Technical Skills
Java, JavaScript, TypeScript, Python, SQL, React, Next.js, Node.js, NestJS, AWS, Azure
Experience
Lead Developer at Healthvice Inc
08/2024 – Present
Architected WellFed from the ground up — AI-powered nutrition and social meal-planning across web, iOS, and Android — leading backend, frontend, mobile, AI, and DevOps.
Software Developer at Unique Logic Solutions
05/2024 – 08/2024
Built an online pharmacy platform with Java, Spring Boot, React, PostgreSQL, and AWS.
Education
Master of Science: Computer Science 05/2024 University of Memphis
Bachelor of Technology: Computer Science 04/2022 Anurag University
`;
    const resume = extractResumeHeuristic(blob);
    expect(resume.yearsExperience).toBe(4);
    expect(resume.skills.join(" ")).not.toMatch(/Technical Skills/i);
    expect(resume.experience[0]?.company).toMatch(/Healthvice/i);
    expect(resume.experience[0]?.company).not.toMatch(/leading backend/i);
    expect(resume.experience[0]?.role).toMatch(/Lead Developer/i);
    expect(resume.experience[0]?.role).not.toMatch(/Azure\. Progressed/i);
    expect(resume.experience.some((job) => /Unique Logic/i.test(job.company))).toBe(true);
    expect(resume.linkedin).toMatch(/linkedin\.com\/in\/rithvikvelapati/i);
    expect(resume.github).toMatch(/github\.com\/rithvik22/i);
  });
});

describe("generatePacket uses the supplied resume", () => {
  it("scores the designer resume without Healthvice evidence", () => {
    const resume = extractResumeHeuristic(SAMPLE_TEXT);
    const packet = heuristicFit(SAMPLE_JD, resume);
    expect(packet.candidate.name).toMatch(/Alex Rivera/);
    expect(packet.requirements.some((row) => row.evidence.join(" ").includes("Healthvice"))).toBe(false);
    expect(packet.sharePath.startsWith("/p/")).toBe(true);
  });
});
