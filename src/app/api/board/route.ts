import { NextResponse } from "next/server";
import { logEvent } from "@/lib/log";
import { clientIp, isRateLimited } from "@/lib/rate-limit";
import { putBoard, type CompareBoard } from "@/lib/compare";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const ip = clientIp(request);
    if (isRateLimited(ip, 20, 10 * 60 * 1000)) {
      return NextResponse.json({ error: "Too many board links." }, { status: 429 });
    }

    const body = (await request.json()) as { board?: CompareBoard; shortlistOnly?: boolean };
    const board = body?.board;
    if (!board?.role || !Array.isArray(board.rows) || board.rows.length === 0) {
      return NextResponse.json({ error: "Missing comparison board." }, { status: 400 });
    }

    const rows = body.shortlistOnly ? board.rows.filter((row) => row.status === "shortlist") : board.rows;
    if (!rows.length) {
      return NextResponse.json({ error: "Shortlist at least one candidate before sharing." }, { status: 400 });
    }

    const stored = putBoard({ ...board, rows });
    logEvent("board_created", { slug: stored.slug, count: rows.length });
    return NextResponse.json(stored);
  } catch {
    return NextResponse.json({ error: "Could not create hiring-manager link." }, { status: 500 });
  }
}
