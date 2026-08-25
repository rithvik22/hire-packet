import { NextResponse } from "next/server";
import { getBoard } from "@/lib/compare";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const board = getBoard(slug);
  if (!board) {
    return NextResponse.json({ error: "Link expired or not found." }, { status: 404 });
  }
  return NextResponse.json(board);
}
