import { NextResponse } from "next/server";
import { getShare } from "@/lib/share";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  if (!slug) {
    return NextResponse.json({ error: "Missing slug." }, { status: 400 });
  }
  const packet = getShare(slug);
  if (!packet) {
    return NextResponse.json({ error: "Link expired or not found. Generate a new packet." }, { status: 404 });
  }
  return NextResponse.json(packet);
}
