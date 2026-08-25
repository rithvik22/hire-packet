import { NextResponse } from "next/server";
import { generateHirePackets } from "@/lib/gemini";
import { logEvent } from "@/lib/log";
import { clientIp, isRateLimited } from "@/lib/rate-limit";
import { sanitizeJobDescription } from "@/lib/sanitize";
import { CandidateResumeSchema, JdExtractionSchema } from "@/lib/schema";
import { parseCandidateResume } from "@/lib/extract-resume";
import { MAX_COMPARE_RESUMES } from "@/lib/compare";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const ip = clientIp(request);
    if (isRateLimited(ip, 8, 10 * 60 * 1000)) {
      logEvent("rate_limited", { route: "fit_batch" });
      return NextResponse.json(
        { error: "Too many batch comparisons. Wait a few minutes and try again." },
        { status: 429 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const sanitized = sanitizeJobDescription(String(body?.jobDescription || ""));
    if (sanitized.error) {
      return NextResponse.json({ error: sanitized.error }, { status: 400 });
    }

    const rawResumes = Array.isArray(body?.resumes) ? body.resumes : [];
    if (rawResumes.length < 1) {
      return NextResponse.json({ error: "Upload at least one resume." }, { status: 400 });
    }
    if (rawResumes.length > MAX_COMPARE_RESUMES) {
      return NextResponse.json({ error: `Compare at most ${MAX_COMPARE_RESUMES} resumes.` }, { status: 400 });
    }

    const resumes = [];
    for (const item of rawResumes) {
      const parsed = CandidateResumeSchema.safeParse(item);
      if (!parsed.success) {
        return NextResponse.json({ error: "One resume failed validation. Remove it and try again." }, { status: 400 });
      }
      resumes.push(parseCandidateResume(parsed.data));
    }

    const confirmed = body?.extraction ? JdExtractionSchema.safeParse(body.extraction) : null;
    if (body?.extraction && !confirmed?.success) {
      return NextResponse.json({ error: "JD extract failed validation. Fix the fields and score again." }, { status: 400 });
    }

    const result = await generateHirePackets(sanitized.text, resumes, confirmed?.success ? confirmed.data : undefined);
    logEvent("batch_generated", { count: result.packets.length, mode: result.mode });
    return NextResponse.json(result);
  } catch {
    logEvent("fit_batch_error", { ok: false });
    return NextResponse.json({ error: "Failed to generate comparison packets." }, { status: 500 });
  }
}
