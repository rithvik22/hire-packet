import { slugify } from "@/lib/slug";
import {
  RECRUITER_STATUS_LABELS,
  type HirePacketResult,
  type MatchStatus,
  type RecruiterStatus,
  type ScoreCategory,
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
  mustHaves?: string[];
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

export type SortKey = "score" | "name" | "strong" | "gaps" | "musts";

export const MAX_MUST_HAVES = 3;

export type MustHaveResult = {
  cleared: boolean;
  passed: number;
  total: number;
  missing: string[];
};

export function mustHaveResult(packet: HirePacketResult | null, mustHaves: string[]): MustHaveResult {
  if (!mustHaves.length) return { cleared: true, passed: 0, total: 0, missing: [] };
  if (!packet) return { cleared: false, passed: 0, total: mustHaves.length, missing: [...mustHaves] };
  const missing: string[] = [];
  for (const req of mustHaves) {
    const match = packet.requirements.find((item) => item.requirement === req);
    if (!match || match.status === "gap") missing.push(req);
  }
  return {
    cleared: missing.length === 0,
    passed: mustHaves.length - missing.length,
    total: mustHaves.length,
    missing,
  };
}

export function toggleMustHave(current: string[], requirement: string): string[] {
  if (current.includes(requirement)) return current.filter((item) => item !== requirement);
  if (current.length >= MAX_MUST_HAVES) return current;
  return [...current, requirement];
}

export function sortRows(
  rows: CompareRow[],
  key: SortKey,
  dir: "asc" | "desc",
  mustHaves: string[] = []
): CompareRow[] {
  const signed = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    if (key === "name") return signed * a.resumeName.localeCompare(b.resumeName);
    if (key === "score") return signed * ((a.packet?.fitScore ?? -1) - (b.packet?.fitScore ?? -1));
    if (key === "strong") return signed * (packetStats(a.packet).strong - packetStats(b.packet).strong);
    if (key === "musts") {
      const aMust = mustHaveResult(a.packet, mustHaves);
      const bMust = mustHaveResult(b.packet, mustHaves);
      if (aMust.passed !== bMust.passed) return signed * (aMust.passed - bMust.passed);
      return signed * ((a.packet?.fitScore ?? -1) - (b.packet?.fitScore ?? -1));
    }
    return signed * (packetStats(a.packet).gaps - packetStats(b.packet).gaps);
  });
}

export function filterRows(
  rows: CompareRow[],
  query: string,
  status: RecruiterStatus | "all",
  mustHaves: string[] = [],
  mustFilter: "all" | "clears" | "missing" = "all"
): CompareRow[] {
  const q = query.trim().toLowerCase();
  return rows.filter((row) => {
    if (status !== "all" && row.status !== status) return false;
    if (mustHaves.length && mustFilter !== "all") {
      const result = mustHaveResult(row.packet, mustHaves);
      if (mustFilter === "clears" && !result.cleared) return false;
      if (mustFilter === "missing" && result.cleared) return false;
    }
    if (!q) return true;
    return (
      row.resumeName.toLowerCase().includes(q) ||
      row.filename.toLowerCase().includes(q) ||
      row.note.toLowerCase().includes(q)
    );
  });
}

export type JdRequirement = {
  requirement: string;
  category: ScoreCategory;
  strong: number;
  partial: number;
  gaps: number;
  strongNames: string[];
  gapNames: string[];
};

export type XrayCell = {
  id: string;
  resumeName: string;
  fitScore: number | null;
  status: MatchStatus | null;
  evidence: string[];
  gap: string | null;
  transferable: string | null;
};

const STATUS_RANK: Record<MatchStatus, number> = {
  strong_match: 0,
  partial_match: 1,
  gap: 2,
};

export function jdRequirements(rows: CompareRow[]): JdRequirement[] {
  const packet = rows.find((row) => row.packet)?.packet;
  if (!packet) return [];
  const seen = new Set<string>();
  const list: JdRequirement[] = [];
  for (const req of packet.requirements) {
    if (seen.has(req.requirement)) continue;
    seen.add(req.requirement);
    let strong = 0;
    let partial = 0;
    let gaps = 0;
    const strongNames: string[] = [];
    const gapNames: string[] = [];
    for (const row of rows) {
      const match = row.packet?.requirements.find((item) => item.requirement === req.requirement);
      if (!match) continue;
      if (match.status === "strong_match") {
        strong += 1;
        strongNames.push(row.resumeName);
      } else if (match.status === "partial_match") {
        partial += 1;
      } else {
        gaps += 1;
        gapNames.push(row.resumeName);
      }
    }
    list.push({
      requirement: req.requirement,
      category: req.category,
      strong,
      partial,
      gaps,
      strongNames,
      gapNames,
    });
  }
  return list;
}

export function xrayForRequirement(rows: CompareRow[], requirement: string): XrayCell[] {
  return rows
    .filter((row) => row.packet)
    .map((row) => {
      const match = row.packet?.requirements.find((item) => item.requirement === requirement);
      return {
        id: row.id,
        resumeName: row.resumeName,
        fitScore: row.packet?.fitScore ?? null,
        status: match?.status ?? null,
        evidence: match?.evidence ?? [],
        gap: match?.gap ?? null,
        transferable: match?.transferable ?? null,
      };
    })
    .sort((a, b) => {
      const rankA = a.status ? STATUS_RANK[a.status] : 3;
      const rankB = b.status ? STATUS_RANK[b.status] : 3;
      if (rankA !== rankB) return rankA - rankB;
      return (b.fitScore ?? -1) - (a.fitScore ?? -1);
    });
}

export function xrayProof(cell: XrayCell): string {
  if (!cell.status) return "This JD line was not scored for this resume.";
  if (cell.status === "gap") return cell.transferable || cell.gap || "No resume evidence for this line.";
  return cell.evidence[0] || cell.transferable || "Listed on the confirmed resume.";
}

export function xrayToText(requirement: string, cells: XrayCell[]): string {
  return [
    `REQUIREMENT X-RAY — ${requirement}`,
    "Same JD line. Every resume. Evidence or a gap. Not a reject.",
    "",
    ...cells.map((cell) => {
      const label = cell.status === "strong_match" ? "Strong" : cell.status === "partial_match" ? "Partial" : "Gap";
      return `${cell.resumeName} — ${label}\n  ${xrayProof(cell)}`;
    }),
  ].join("\n\n");
}

function clipReq(text: string) {
  return text.length > 52 ? `${text.slice(0, 49)}…` : text;
}

export function leadDelta(rows: CompareRow[]): string | null {
  const ranked = sortRows(
    rows.filter((row) => row.packet),
    "score",
    "desc"
  );
  if (ranked.length < 2) return null;
  const lead = ranked[0];
  const next = ranked[1];
  const leadPacket = lead.packet;
  const nextPacket = next.packet;
  if (!leadPacket || !nextPacket) return null;
  const nextByReq = new Map(nextPacket.requirements.map((item) => [item.requirement, item]));
  const leadWins: string[] = [];
  const nextWins: string[] = [];
  for (const req of leadPacket.requirements) {
    const other = nextByReq.get(req.requirement);
    if (!other) continue;
    if (req.status === "strong_match" && other.status === "gap") leadWins.push(req.requirement);
    if (req.status === "gap" && other.status === "strong_match") nextWins.push(req.requirement);
  }
  const leadBit = leadWins.length
    ? `${lead.resumeName} (${leadPacket.fitScore}) leads ${next.resumeName} (${nextPacket.fitScore}) on ${leadWins.slice(0, 2).map(clipReq).join(" and ")}.`
    : `${lead.resumeName} (${leadPacket.fitScore}) leads ${next.resumeName} (${nextPacket.fitScore}) on the weighted score.`;
  const nextBit = nextWins.length
    ? ` ${next.resumeName} is ahead on ${nextWins.slice(0, 2).map(clipReq).join(" and ")}. Gaps are not rejects.`
    : ` No line where ${next.resumeName} is strong and ${lead.resumeName} is a gap.`;
  return `${leadBit}${nextBit}`;
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
