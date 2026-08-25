import { NextResponse } from "next/server";
import { extractStructuredResume } from "@/lib/extract-resume";
import { extractResumeText, resumeFileError } from "@/lib/parse-file";
import { logEvent } from "@/lib/log";
import { clientIp, isRateLimited } from "@/lib/rate-limit";
import { sanitizeResumeText } from "@/lib/sanitize";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: Request) {
  try {
    const ip = clientIp(request);
    if (isRateLimited(ip, 8, 10 * 60 * 1000)) {
      logEvent("rate_limited", { route: "resume" });
      return NextResponse.json(
        { error: "Too many resume uploads. Wait a few minutes and try again." },
        { status: 429 }
      );
    }

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Choose a PDF or DOCX resume." }, { status: 400 });
    }

    const fileError = resumeFileError({ name: file.name, size: file.size });
    if (fileError) {
      return NextResponse.json({ error: fileError }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const rawText = await extractResumeText(buffer, file.name);
    const sanitized = sanitizeResumeText(rawText);
    if (sanitized.error) {
      return NextResponse.json({ error: sanitized.error }, { status: 400 });
    }
    if (sanitized.flagged) {
      logEvent("resume_injection_flag", { textChars: sanitized.text.length });
    }

    const extracted = await extractStructuredResume(sanitized.text);
    logEvent("resume_parsed", {
      mode: extracted.mode,
      textChars: sanitized.text.length,
      jobs: extracted.resume.experience.length,
    });

    return NextResponse.json({
      resume: extracted.resume,
      mode: extracted.mode,
      textChars: sanitized.text.length,
    });
  } catch {
    logEvent("resume_parse_error", { ok: false });
    return NextResponse.json(
      { error: "Could not read that resume. Try a text-based PDF or DOCX." },
      { status: 500 }
    );
  }
}
