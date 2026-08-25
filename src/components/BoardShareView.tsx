"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { PacketReport } from "@/components/PacketReport";
import { SiteHeader } from "@/components/SiteHeader";
import {
  decodeBoard,
  filterRows,
  packetStats,
  sortRows,
  type CompareBoard,
} from "@/lib/compare";
import { RECRUITER_STATUS_LABELS } from "@/lib/types";

export function BoardShareView() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const [board, setBoard] = useState<CompareBoard | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "missing">("loading");
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const hash = window.location.hash.replace(/^#/, "");
      if (hash) {
        const fromHash = decodeBoard(hash);
        if (fromHash && !cancelled) {
          setBoard(fromHash);
          setStatus("ready");
          return;
        }
      }
      try {
        const res = await fetch(`/api/board/${encodeURIComponent(slug)}`);
        if (!res.ok) throw new Error("missing");
        const data = (await res.json()) as CompareBoard;
        if (!cancelled) {
          setBoard(data);
          setStatus("ready");
        }
      } catch {
        if (!cancelled) setStatus("missing");
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const visible = useMemo(
    () => (board ? sortRows(filterRows(board.rows, "", "all"), "score", "desc") : []),
    [board]
  );
  const openRow = visible.find((row) => row.id === openId);

  return (
    <div className="desk">
      <div className="blotter blotter-wide">
        <SiteHeader extra={<Link href="/compare">Generate another</Link>} />

        {status === "loading" ? (
          <div className="collating">
            <p className="collating-kicker">Opening hiring-manager board</p>
          </div>
        ) : null}

        {status === "missing" ? (
          <div className="empty-packet">
            <h1>Link expired</h1>
            <p className="lede">Ask the recruiter to share the shortlist again. The JD is not stored.</p>
            <Link className="btn-primary" href="/compare" style={{ display: "inline-block", textDecoration: "none" }}>
              Open comparison
            </Link>
          </div>
        ) : null}

        {status === "ready" && board ? (
          <main>
            <p className="eyebrow">
              <span className="tape">Hiring manager</span>
              Read-only shortlist
            </p>
            <h1>{board.role}</h1>
            <p className="lede">
              Scores organize this slate. They are not a hiring decision. Open a name to inspect resume evidence.
            </p>
            <div className="table-wrap">
              <table className="req-table compare-table">
                <thead>
                  <tr>
                    <th>Candidate</th>
                    <th>Score</th>
                    <th>Strong matches</th>
                    <th>Gaps</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((row) => {
                    const stats = packetStats(row.packet);
                    return (
                      <tr key={row.id}>
                        <td>
                          <button type="button" className="linkish" onClick={() => setOpenId(row.id)}>
                            {row.resumeName}
                          </button>
                          {row.note ? <div className="cat-tag">{row.note}</div> : null}
                        </td>
                        <td>{row.packet?.fitScore ?? "—"}</td>
                        <td>{stats.strong}</td>
                        <td>{stats.gaps}</td>
                        <td>{RECRUITER_STATUS_LABELS[row.status]}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="disclosure no-print">
              Private link · scores calculated in code · recruiter set status · no automatic rejects
            </p>
            {openRow?.packet ? (
              <PacketReport packet={openRow.packet} shareMode />
            ) : null}
            <p className="no-print" style={{ marginTop: 16 }}>
              <button type="button" className="btn-ghost" onClick={() => window.print()}>
                Download PDF
              </button>
            </p>
          </main>
        ) : null}
      </div>
    </div>
  );
}
