import { slugify } from "@/lib/slug";
import {
  RECRUITER_STATUS_LABELS,
  type HirePacketResult,
  type RecruiterStatus,
} from "@/lib/types";

export const MAX_COMPARE_RESUMES = 20;

export type CompareRow = {
  id: string;
  filename: string;
  resumeName: string;
  packet: HirePacketResult | null;
  error: string | null;
  status: RecruiterStatus;
  note: string;
};

export type CompareBoard = {
  role: string;
  createdAt: string;
  mode: "gemini" | "heuristic";
  rows: CompareRow[];
};

export function packetStats(packet: HirePacketResult | null): { strong: number; gaps: number } {
  if (!packet) return { strong: 0, gaps: 0 };
  return {
    strong: packet.requirements.filter((row) => row.status === "strong_match").length,
    gaps: packet.requirements.filter((row) => row.status === "gap").length,
  };
}

export function defaultStatus(): RecruiterStatus {
  return "review";
}

export type SortKey = "score" | "name" | "strong" | "gaps";

export function sortRows(rows: CompareRow[], key: SortKey, dir: "asc" | "desc"): CompareRow[] {
  const signed = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    if (key === "name") return signed * a.resumeName.localeCompare(b.resumeName);
    if (key === "score") return signed * ((a.packet?.fitScore ?? -1) - (b.packet?.fitScore ?? -1));
    if (key === "strong") return signed * (packetStats(a.packet).strong - packetStats(b.packet).strong);
    return signed * (packetStats(a.packet).gaps - packetStats(b.packet).gaps);
  });
}

export function filterRows(
  rows: CompareRow[],
  query: string,
  status: RecruiterStatus | "all"
): CompareRow[] {
  const q = query.trim().toLowerCase();
  return rows.filter((row) => {
    if (status !== "all" && row.status !== status) return false;
    if (!q) return true;
    return (
      row.resumeName.toLowerCase().includes(q) ||
      row.filename.toLowerCase().includes(q) ||
      row.note.toLowerCase().includes(q)
    );
  });
}

export function boardToText(board: CompareBoard, onlyShortlist = false): string {
  const rows = onlyShortlist ? board.rows.filter((row) => row.status === "shortlist") : board.rows;
  return [
    `HIRE PACKET COMPARISON — ${board.role}`,
    `Generated ${board.createdAt}`,
    "Scores organize the slate. The recruiter decides. No automatic rejects.",
    "",
    ...rows.map((row) => {
      const stats = packetStats(row.packet);
      return [
        `${row.resumeName} — ${row.packet?.fitScore ?? "—"}/100 — ${RECRUITER_STATUS_LABELS[row.status]}`,
        `Strong ${stats.strong} · Gaps ${stats.gaps}`,
        row.note ? `Note: ${row.note}` : "",
      ]
        .filter(Boolean)
        .join("\n");
    }),
  ].join("\n\n");
}

export function encodeBoard(board: CompareBoard): string {
  const json = JSON.stringify(board);
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function decodeBoard(token: string): CompareBoard | null {
  try {
    const padded = token.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((token.length + 3) % 4);
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
    const json = new TextDecoder().decode(bytes);
    const parsed = JSON.parse(json) as CompareBoard;
    if (!parsed?.role || !Array.isArray(parsed.rows)) return null;
    return parsed;
  } catch {
    return null;
  }
}

const SHARE_TTL_MS = 24 * 60 * 60 * 1000;

type BoardRecord = { board: CompareBoard; expiresAt: number };

const globalForBoards = globalThis as typeof globalThis & {
  hirePacketBoards?: Map<string, BoardRecord>;
};

const boards = globalForBoards.hirePacketBoards ?? new Map<string, BoardRecord>();
globalForBoards.hirePacketBoards = boards;

function prune(now = Date.now()) {
  for (const [slug, rec] of boards) {
    if (rec.expiresAt <= now) boards.delete(slug);
  }
}

export function putBoard(board: CompareBoard): { slug: string; expiresAt: number; path: string } {
  prune();
  const base = slugify(`${board.role}-slate`, "slate");
  let key = base;
  let i = 2;
  while (boards.has(key) && i < 20) {
    key = `${base}-${i}`;
    i += 1;
  }
  const expiresAt = Date.now() + SHARE_TTL_MS;
  boards.set(key, { board, expiresAt });
  return { slug: key, expiresAt, path: `/board/${key}` };
}

export function getBoard(slug: string): CompareBoard | null {
  prune();
  return boards.get(slug)?.board ?? null;
}
