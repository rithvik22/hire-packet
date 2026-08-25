import { NextResponse } from "next/server";
import { generateHirePacket } from "@/lib/gemini";
import { logEvent } from "@/lib/log";
import { clientIp, isRateLimited } from "@/lib/rate-limit";
import { sanitizeJobDescription } from "@/lib/sanitize";
import { CandidateResumeSchema } from "@/lib/schema";
import { sampleCandidateResume } from "@/data/resume";
import { parseCandidateResume } from "@/lib/extract-resume";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: Request) {
  try {
    const ip = clientIp(request);
    if (isRateLimited(ip)) {
      logEvent("rate_limited", { route: "fit" });
      return NextResponse.json(
        { error: "Too many packets generated. Wait a few minutes and try again." },
        { status: 429 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const sanitized = sanitizeJobDescription(String(body?.jobDescription || ""));
    if (sanitized.error) {
      return NextResponse.json({ error: sanitized.error }, { status: 400 });
    }

    const useSample = Boolean(body?.useSample);
    const parsed = body?.resume ? CandidateResumeSchema.safeParse(body.resume) : null;
    if (parsed && !parsed.success) {
      return NextResponse.json({ error: "Resume JSON failed validation. Review the extracted fields." }, { status: 400 });
    }
    if (!parsed?.success && !useSample) {
      return NextResponse.json(
        { error: "Upload a resume or choose the sample candidate first." },
        { status: 400 }
      );
    }

    const resume = parsed?.success ? parseCandidateResume(parsed.data) : sampleCandidateResume();

    if (sanitized.flagged) {
      logEvent("jd_injection_flag", { jdChars: sanitized.text.length });
    }

    const packet = await generateHirePacket(sanitized.text, resume);
    return NextResponse.json(packet);
  } catch {
    logEvent("fit_error", { ok: false });
    return NextResponse.json({ error: "Failed to generate hire packet." }, { status: 500 });
  }
}
