import { describe, expect, it } from "vitest";
import { sampleCandidateResume } from "@/data/resume";
import { retrieveEvidence, resumeRelevance, tokenize } from "@/lib/retrieve";
import { matchRequirement } from "@/lib/match";

const sample = sampleCandidateResume();

describe("tokenize", () => {
  it("drops stopwords and lowercases", () => {
    expect(tokenize("Experience with the Kubernetes cluster")).toEqual(
      expect.arrayContaining(["kubernetes", "cluster"])
    );
    expect(tokenize("Experience with the Kubernetes cluster")).not.toContain("with");
  });
});

describe("retrieveEvidence", () => {
  it("ranks Kubernetes / orchestration wording against K8s bullets", () => {
    const ranked = retrieveEvidence("container orchestration and cluster management", sample, 3);
    expect(ranked.length).toBeGreaterThan(0);
    expect(ranked[0].score).toBeGreaterThanOrEqual(ranked[ranked.length - 1]?.score ?? 0);
    expect(ranked.some((row) => /Kubernetes|Terraform/i.test(row.text))).toBe(true);
  });

  it("ranks RAG / retrieval wording against Bedrock / embeddings evidence", () => {
    const ranked = retrieveEvidence("semantic retrieval and vector search for ranking", sample, 5);
    expect(ranked.length).toBeGreaterThan(0);
    const blob = ranked.map((r) => r.text).join(" ");
    expect(blob).toMatch(/RAG|Bedrock|embeddings|OpenSearch/i);
  });

  it("never invents employers — only returns resume text", () => {
    const ranked = retrieveEvidence("Node.js APIs", sample, 5);
    for (const row of ranked) {
      const source = sample.experience.some(
        (job) => job.company === row.company && job.evidence.includes(row.text)
      );
      const project = sample.projects.some(
        (p) => p.name === row.company && row.text.includes(p.summary.slice(0, 20))
      );
      expect(source || project).toBe(true);
    }
  });
});

describe("semantic matchRequirement", () => {
  it("surfaces evidence for related wording without exact skill keyword", () => {
    const match = matchRequirement(
      "container orchestration on cloud infrastructure",
      "responsibilities",
      sample
    );
    expect(match.status).not.toBe("gap");
    expect(match.evidence.join(" ")).toMatch(/Kubernetes|Terraform|AWS/i);
  });

  it("still gaps unrelated domains", () => {
    const match = matchRequirement("COBOL mainframe batch payroll", "requiredSkills", sample);
    expect(match.status).toBe("gap");
    expect(match.evidence).toHaveLength(0);
  });
});

describe("resumeRelevance", () => {
  it("scores higher for on-resume topics than off-resume topics", () => {
    const on = resumeRelevance("production RAG with embeddings", sample);
    const off = resumeRelevance("COBOL VSAM CICS mainframe", sample);
    expect(on).toBeGreaterThan(off);
  });
});
