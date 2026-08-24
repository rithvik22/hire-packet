import { NextResponse } from "next/server";
import { logEvent } from "@/lib/log";
import { clientIp, isRateLimited } from "@/lib/rate-limit";
import { putShare } from "@/lib/share";
import type { HirePacketResult } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const ip = clientIp(request);
    if (isRateLimited(ip, 20, 10 * 60 * 1000)) {
      return NextResponse.json({ error: "Too many share links." }, { status: 429 });
    }

    const body = (await request.json()) as { packet?: HirePacketResult };
    const packet = body?.packet;
    if (!packet || typeof packet.fitScore !== "number" || !packet.slug) {
      return NextResponse.json({ error: "Missing packet to share." }, { status: 400 });
    }

    const stored = putShare(packet.slug, packet);
    logEvent("share_created", { slug: stored.slug });
    return NextResponse.json({
      slug: stored.slug,
      path: `/rithvik/${stored.slug}`,
      expiresAt: stored.expiresAt,
    });
  } catch {
    return NextResponse.json({ error: "Could not create share link." }, { status: 500 });
  }
}
