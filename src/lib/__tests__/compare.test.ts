import { describe, expect, it } from "vitest";
import { demoSlate } from "@/data/demo-slate";
import { RETELL_JD } from "@/data/sample-jd";
import {
  decodeBoard,
  defaultStatus,
  encodeBoard,
  filterRows,
  jdRequirements,
  leadDelta,
  mustHaveResult,
  packetStats,
  sortRows,
  toggleMustHave,
  xrayForRequirement,
  xrayProof,
  xrayToText,
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

  it("x-rays one JD line across the slate without dropping anyone", () => {
    const node = "Node.js APIs";
    const rows = [
      row({
        id: "a",
        resumeName: "Maya",
        packet: {
          fitScore: 91,
          requirements: [
            {
              requirement: node,
              status: "strong_match",
              evidence: ["Built Node APIs at Healthvice."],
              gap: null,
              transferable: null,
              category: "requiredSkills",
            },
            {
              requirement: "Figma",
              status: "gap",
              evidence: [],
              gap: "No design-tool tenure.",
              transferable: null,
              category: "preferredSkills",
            },
          ],
        } as CompareRow["packet"],
      }),
      row({
        id: "b",
        resumeName: "Alex",
        packet: {
          fitScore: 38,
          requirements: [
            {
              requirement: node,
              status: "gap",
              evidence: [],
              gap: "No Node.js on the resume.",
              transferable: null,
              category: "requiredSkills",
            },
            {
              requirement: "Figma",
              status: "strong_match",
              evidence: ["Shipped Figma systems."],
              gap: null,
              transferable: null,
              category: "preferredSkills",
            },
          ],
        } as CompareRow["packet"],
      }),
      row({
        id: "c",
        resumeName: "Sam",
        packet: {
          fitScore: 74,
          requirements: [
            {
              requirement: node,
              status: "partial_match",
              evidence: ["Listed skill on verified resume: Node.js"],
              gap: null,
              transferable: null,
              category: "requiredSkills",
            },
          ],
        } as CompareRow["packet"],
      }),
    ];

    const reqs = jdRequirements(rows);
    expect(reqs.map((item) => item.requirement)).toEqual([node, "Figma"]);
    expect(reqs[0]).toMatchObject({
      strong: 1,
      partial: 1,
      gaps: 1,
      strongNames: ["Maya"],
      gapNames: ["Alex"],
    });

    const xray = xrayForRequirement(rows, node);
    expect(xray.map((cell) => cell.resumeName)).toEqual(["Maya", "Sam", "Alex"]);
    expect(xray[0].status).toBe("strong_match");
    expect(xrayProof(xray[0])).toMatch(/Healthvice/);
    expect(xrayProof(xray[2])).toMatch(/No Node/);
    expect(xrayToText(node, xray)).toMatch(/Maya/);
    expect(xray).toHaveLength(3);
  });

  it("flags must-have gaps without removing anyone from the slate", () => {
    const node = "Node.js APIs";
    const rows = [
      row({
        id: "a",
        resumeName: "Maya",
        packet: {
          fitScore: 91,
          requirements: [
            { requirement: node, status: "strong_match", evidence: ["Node"], gap: null, transferable: null, category: "requiredSkills" },
          ],
        } as CompareRow["packet"],
      }),
      row({
        id: "b",
        resumeName: "Alex",
        packet: {
          fitScore: 38,
          requirements: [
            { requirement: node, status: "gap", evidence: [], gap: "No Node", transferable: null, category: "requiredSkills" },
          ],
        } as CompareRow["packet"],
      }),
    ];
    expect(mustHaveResult(rows[0].packet, [node]).cleared).toBe(true);
    expect(mustHaveResult(rows[1].packet, [node]).cleared).toBe(false);
    expect(filterRows(rows, "", "all", [node], "missing").map((item) => item.resumeName)).toEqual(["Alex"]);
    expect(rows).toHaveLength(2);
    expect(toggleMustHave([], node)).toEqual([node]);
    expect(toggleMustHave(["a", "b", "c"], "d")).toEqual(["a", "b", "c"]);
    const delta = leadDelta(rows);
    expect(delta).toMatch(/Maya/);
    expect(delta).toMatch(/Alex/);
    expect(delta).toMatch(/Node/);
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
    const rows = packets.map((packet, index) =>
      row({ id: String(index), resumeName: packet.candidate.name, packet })
    );
    const node = jdRequirements(rows).find((item) => /node/i.test(item.requirement));
    expect(node?.strong).toBeGreaterThan(0);
    expect(node?.gaps).toBeGreaterThan(0);
    expect(xrayForRequirement(rows, node?.requirement || "").length).toBe(5);
  });
});
