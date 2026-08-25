import { describe, expect, it } from "vitest";
import { isQuotaError } from "@/lib/gemini-budget";

describe("gemini budget", () => {
  it("treats quota and 429 as stop, not retry", () => {
    expect(isQuotaError(new Error("429 Too Many Requests"))).toBe(true);
    expect(isQuotaError(new Error("You exceeded your current quota"))).toBe(true);
    expect(isQuotaError(new Error("RESOURCE_EXHAUSTED"))).toBe(true);
    expect(isQuotaError(new Error("Model did not return valid JSON"))).toBe(false);
  });
});
