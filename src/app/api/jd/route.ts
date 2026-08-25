import { NextResponse } from "next/server";
import { extractJob } from "@/lib/gemini";
import { logEvent } from "@/lib/log";
import { clientIp, isRateLimited } from "@/lib/rate-limit";
import { sanitizeJobDescription } from "@/lib/sanitize";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: Request) {
  try {
    const ip = clientIp(request);
    if (isRateLimited(ip, 12, 10 * 60 * 1000)) {
      logEvent("rate_limited", { route: "jd" });
      return NextResponse.json({ error: "Too many JD extracts. Wait a few minutes and try again." }, { status: 429 });
    }

    const body = await request.json().catch(() => ({}));
    const sanitized = sanitizeJobDescription(String(body?.jobDescription || ""));
    if (sanitized.error) {
      return NextResponse.json({ error: sanitized.error }, { status: 400 });
    }

    const extracted = await extractJob(sanitized.text);
    logEvent("jd_extracted", { mode: extracted.mode, role: extracted.extraction.role });
    return NextResponse.json(extracted);
  } catch {
    logEvent("jd_extract_error", { ok: false });
    return NextResponse.json({ error: "Could not extract that job description." }, { status: 500 });
  }
}
