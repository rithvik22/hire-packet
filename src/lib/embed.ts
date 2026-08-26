import { GoogleGenerativeAI, TaskType } from "@google/generative-ai";
import { refundGeminiSlot, takeGeminiSlot } from "@/lib/gemini-budget";
import { logEvent } from "@/lib/log";

const EMBED_MODEL = "gemini-embedding-001";
const CACHE_MAX = 400;

const globalForEmbed = globalThis as typeof globalThis & {
  hirePacketEmbedCache?: Map<string, number[]>;
};

function cache(): Map<string, number[]> {
  return (globalForEmbed.hirePacketEmbedCache ??= new Map());
}

export function embeddingsEnabled(): boolean {
  const raw = (process.env.GEMINI_EMBEDDINGS || "1").trim().toLowerCase();
  if (raw === "0" || raw === "false" || raw === "no") return false;
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a.length || !b.length || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

function cacheKey(text: string, task: string): string {
  return `${task}::${text.trim().toLowerCase().slice(0, 800)}`;
}

function remember(key: string, values: number[]) {
  const map = cache();
  if (map.size >= CACHE_MAX) {
    const first = map.keys().next().value;
    if (first) map.delete(first);
  }
  map.set(key, values);
}

type EmbedTask = "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY";

function toTaskType(task: EmbedTask): TaskType {
  return task === "RETRIEVAL_QUERY" ? TaskType.RETRIEVAL_QUERY : TaskType.RETRIEVAL_DOCUMENT;
}

/**
 * Embed many strings in one Gemini batch call. Uses cache. Falls back to nulls on failure.
 * Counts as one hourly Gemini slot per network batch (not per string).
 */
export async function embedTexts(
  texts: string[],
  taskType: EmbedTask = "RETRIEVAL_DOCUMENT"
): Promise<(number[] | null)[]> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || !texts.length) return texts.map(() => null);

  const out: (number[] | null)[] = texts.map(() => null);
  const pending: { index: number; text: string; key: string }[] = [];

  for (let i = 0; i < texts.length; i++) {
    const text = texts[i]?.trim();
    if (!text) continue;
    const key = cacheKey(text, taskType);
    const hit = cache().get(key);
    if (hit) {
      out[i] = hit;
      continue;
    }
    pending.push({ index: i, text: text.slice(0, 2000), key });
  }

  if (!pending.length) return out;
  if (!takeGeminiSlot()) {
    logEvent("embed_budget", { ok: false, pending: pending.length });
    return out;
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: EMBED_MODEL });
    const task = toTaskType(taskType);
    const CHUNK = 20;
    for (let start = 0; start < pending.length; start += CHUNK) {
      const slice = pending.slice(start, start + CHUNK);
      const result = await model.batchEmbedContents({
        requests: slice.map((item) => ({
          content: { role: "user", parts: [{ text: item.text }] },
          taskType: task,
        })),
      });
      const embeddings = result.embeddings || [];
      for (let i = 0; i < slice.length; i++) {
        const values = embeddings[i]?.values;
        if (values?.length) {
          remember(slice[i].key, values);
          out[slice[i].index] = values;
        }
      }
    }
    logEvent("embed_ok", { count: pending.length });
    return out;
  } catch (err) {
    refundGeminiSlot();
    logEvent("embed_fail", {
      ok: false,
      reason: (err instanceof Error ? err.message : String(err)).replace(/\s+/g, " ").slice(0, 120),
    });
    return out;
  }
}

export async function embedDocuments(texts: string[]): Promise<(number[] | null)[]> {
  return embedTexts(texts, "RETRIEVAL_DOCUMENT");
}
