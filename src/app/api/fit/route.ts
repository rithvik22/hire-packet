import { NextResponse } from "next/server";
import { generateHirePacket } from "@/lib/gemini";
import { logEvent } from "@/lib/log";
import { clientIp, isRateLimited } from "@/lib/rate-limit";
import { sanitizeJobDescription } from "@/lib/sanitize";

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

    if (sanitized.flagged) {
      logEvent("jd_injection_flag", { jdChars: sanitized.text.length });
    }

    const packet = await generateHirePacket(sanitized.text);
    return NextResponse.json(packet);
  } catch {
    logEvent("fit_error", { ok: false });
    return NextResponse.json({ error: "Failed to generate hire packet." }, { status: 500 });
  }
}
