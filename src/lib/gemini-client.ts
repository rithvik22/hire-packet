import { GoogleGenerativeAI, type ResponseSchema } from "@google/generative-ai";
import { isQuotaError, refundGeminiSlot, takeGeminiSlot } from "@/lib/gemini-budget";
import { logEvent } from "@/lib/log";

const MODELS = ["gemini-flash-latest", "gemini-flash-lite-latest"];
const MAX_ATTEMPTS = 1;

export function extractJson(text: string): unknown {
  const cleaned = text.replace(/```json|```/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
    throw new Error("Model did not return valid JSON");
  }
}

function shortError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  return message.replace(/\s+/g, " ").slice(0, 120);
}

export async function callModel(
  apiKey: string,
  prompt: string,
  schema: ResponseSchema | null,
  temperature: number,
  options?: { models?: string[]; maxAttempts?: number }
): Promise<unknown> {
  const models = options?.models?.length ? options.models : MODELS;
  const maxAttempts = options?.maxAttempts ?? MAX_ATTEMPTS;
  let lastError: unknown;

  for (const modelName of models) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      if (!takeGeminiSlot()) {
        logEvent("gemini_budget", { ok: false, model: modelName });
        throw new Error("gemini_budget");
      }
      try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig: {
            temperature,
            responseMimeType: "application/json",
            ...(schema ? { responseSchema: schema } : {}),
          },
        });
        const suffix =
          attempt > 1 ? `\nPrevious output failed validation. Return JSON that matches the schema exactly.` : "";
        const result = await model.generateContent(prompt + suffix);
        return extractJson(result.response.text());
      } catch (err) {
        refundGeminiSlot();
        lastError = err;
        logEvent("gemini_retry", {
          attempt,
          ok: false,
          model: modelName,
          reason: shortError(err),
        });
        if (isQuotaError(err) || (err instanceof Error && err.message === "gemini_budget")) {
          throw err instanceof Error ? err : new Error("gemini_quota");
        }
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error("gemini_failed");
}
