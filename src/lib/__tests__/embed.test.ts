import { describe, expect, it } from "vitest";
import { sampleCandidateResume } from "@/data/resume";
import { cosineSimilarity } from "@/lib/embed";
import { retrieveEvidence } from "@/lib/retrieve";

describe("cosineSimilarity", () => {
  it("is 1 for identical vectors", () => {
    expect(cosineSimilarity([1, 0, 0], [1, 0, 0])).toBeCloseTo(1);
  });

  it("is 0 for orthogonal vectors", () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
  });

  it("handles empty safely", () => {
    expect(cosineSimilarity([], [])).toBe(0);
    expect(cosineSimilarity([1], [1, 2])).toBe(0);
  });
});

describe("lexical retrieve still works offline", () => {
  it("ranks without needing embeddings", () => {
    const sample = sampleCandidateResume();
    const ranked = retrieveEvidence("durable retries for event pipelines", sample, 3);
    expect(Array.isArray(ranked)).toBe(true);
  });
});
