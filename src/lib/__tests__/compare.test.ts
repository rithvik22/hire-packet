import { describe, expect, it } from "vitest";
import { demoSlate } from "@/data/demo-slate";
import { RETELL_JD } from "@/data/sample-jd";
import {
  decodeBoard,
  defaultStatus,
  encodeBoard,
  filterRows,
  packetStats,
  sortRows,
  type CompareRow,
} from "@/lib/compare";
import { generateHirePackets } from "@/lib/gemini";

function row(partial: Partial<CompareRow> & Pick<CompareRow, "id" | "resumeName">): CompareRow {
  return {
    filename: `${partial.resumeName}.pdf`,
    packet: null,
    error: null,
    status: defaultStatus(),
    note: "",
    ...partial,
  };
}

describe("comparison board", () => {
  it("defaults every candidate to review, never reject", () => {
    expect(defaultStatus()).toBe("review");
    expect(defaultStatus()).not.toBe("hold");
  });

  it("sorts by score descending without dropping anyone", () => {
    const rows = [
      row({ id: "a", resumeName: "A", packet: { fitScore: 65 } as CompareRow["packet"] }),
      row({ id: "b", resumeName: "B", packet: { fitScore: 91 } as CompareRow["packet"] }),
      row({ id: "c", resumeName: "C", packet: { fitScore: 82 } as CompareRow["packet"] }),
    ];
    expect(sortRows(rows, "score", "desc").map((item) => item.resumeName)).toEqual(["B", "C", "A"]);
  });

  it("filters shortlist without deleting the rest of the slate", () => {
    const rows = [
      row({ id: "a", resumeName: "A", status: "shortlist" }),
      row({ id: "b", resumeName: "B", status: "hold" }),
    ];
    expect(filterRows(rows, "", "shortlist")).toHaveLength(1);
    expect(rows).toHaveLength(2);
  });

  it("round-trips a hiring-manager board payload", () => {
    const board = {
      role: "Full-Stack Engineer",
      createdAt: "2026-01-01",
      mode: "heuristic" as const,
      rows: [row({ id: "a", resumeName: "A", status: "shortlist" })],
    };
    expect(decodeBoard(encodeBoard(board))?.rows[0]?.resumeName).toBe("A");
  });
});

describe("batch packets", () => {
  it("scores a five-person demo slate against one JD without auto-rejecting", async () => {
    const slate = demoSlate();
    expect(slate).toHaveLength(5);
    const { packets } = await generateHirePackets(
      RETELL_JD,
      slate.map((item) => item.resume)
    );
    expect(packets).toHaveLength(5);
    const scores = packets.map((packet) => packet.fitScore);
    expect(new Set(scores).size).toBeGreaterThan(1);
    const designer = packets.find((packet) => packet.candidate.name === "Alex Rivera");
    const rithvik = packets.find((packet) => /Rithvik/i.test(packet.candidate.name));
    expect(designer?.fitScore).toBeLessThan(rithvik?.fitScore ?? 0);
    expect(packetStats(rithvik ?? null).strong).toBeGreaterThan(packetStats(designer ?? null).strong);
    packets.forEach((packet) => {
      expect(packet.recommendation).toMatch(/fit/);
    });
  });
});
