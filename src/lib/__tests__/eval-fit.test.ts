import { describe, expect, it } from "vitest";
import { sampleCandidateResume } from "@/data/resume";
import { matchRequirement } from "@/lib/match";
import { reciprocalRankFusion, type RankedEvidence } from "@/lib/retrieve";

const sample = sampleCandidateResume();

describe("honest named-tool matching", () => {
  it("keeps OpenSearch / Elasticsearch as a match", () => {
    const match = matchRequirement(
      "Hands-on experience with Elasticsearch or OpenSearch in production",
      "requiredSkills",
      sample
    );
    expect(match.status).not.toBe("gap");
    expect(match.evidence.join(" ")).toMatch(/OpenSearch/i);
  });

  it("keeps Kafka as a match", () => {
    const match = matchRequirement(
      "batch and/or streaming data processing (Spark, Kafka, Flink)",
      "preferredSkills",
      sample
    );
    expect(match.status).not.toBe("gap");
    expect(match.evidence.join(" ")).toMatch(/Kafka/i);
  });

  it("does not treat dbt as a strong match", () => {
    const match = matchRequirement("Experience with dbt for data transformation", "requiredSkills", sample);
    expect(match.status).not.toBe("strong_match");
    expect(match.evidence).toHaveLength(0);
  });

  it("does not treat Snowflake as a strong match", () => {
    const match = matchRequirement(
      "Strong SQL and data warehouses (Snowflake, BigQuery, Redshift)",
      "requiredSkills",
      sample
    );
    expect(match.status).not.toBe("strong_match");
  });

  it("does not treat Datadog as a strong match", () => {
    const match = matchRequirement(
      "Service observability — Datadog, Prometheus/Grafana",
      "requiredSkills",
      sample
    );
    expect(match.status).not.toBe("strong_match");
  });

  it("does not treat LightGBM / LTR as a strong match", () => {
    const match = matchRequirement(
      "learning-to-rank libraries (LightGBM, XGBoost rankers)",
      "preferredSkills",
      sample
    );
    expect(match.status).not.toBe("strong_match");
  });
});

function hit(text: string, extra: Partial<RankedEvidence> = {}): RankedEvidence {
  return {
    company: "Co",
    role: "Dev",
    text,
    score: 1,
    reasons: [],
    ...extra,
  };
}

describe("reciprocalRankFusion", () => {
  it("promotes items that rank well on both lists", () => {
    const lexical = [hit("kafka pipeline"), hit("generic api"), hit("other")];
    const embedded = [hit("kafka pipeline"), hit("other"), hit("generic api")];
    const fused = reciprocalRankFusion([lexical, embedded]);
    expect(fused[0].text).toBe("kafka pipeline");
    expect(fused[0].reasons.some((r) => r.startsWith("rrf"))).toBe(true);
  });
});
