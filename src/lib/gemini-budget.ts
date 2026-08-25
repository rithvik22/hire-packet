const WINDOW_MS = 60 * 60 * 1000;

const globalForGemini = globalThis as typeof globalThis & {
  hirePacketGeminiCalls?: number[];
};

function calls(): number[] {
  return (globalForGemini.hirePacketGeminiCalls ??= []);
}

export function geminiHourlyLimit(): number {
  const raw = Number(process.env.GEMINI_MAX_CALLS_PER_HOUR);
  if (Number.isFinite(raw) && raw >= 0) return raw;
  return 8;
}

export function geminiNarrativeEnabled(): boolean {
  const raw = (process.env.GEMINI_NARRATIVE || "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}

export function geminiCallsUsed(): number {
  const now = Date.now();
  const live = calls().filter((at) => now - at < WINDOW_MS);
  globalForGemini.hirePacketGeminiCalls = live;
  return live.length;
}

export function takeGeminiSlot(): boolean {
  const limit = geminiHourlyLimit();
  if (limit === 0) return false;
  const used = geminiCallsUsed();
  if (used >= limit) return false;
  calls().push(Date.now());
  return true;
}

export function isQuotaError(err: unknown): boolean {
  const message = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return (
    message.includes("429") ||
    message.includes("quota") ||
    message.includes("resource exhausted") ||
    message.includes("resource_exhausted") ||
    message.includes("too many requests")
  );
}
