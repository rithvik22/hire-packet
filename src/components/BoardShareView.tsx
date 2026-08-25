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
  jdRequirements,
  leadDelta,
  mustHaveResult,
  type CompareBoard,
} from "@/lib/compare";
import { RECRUITER_STATUS_LABELS } from "@/lib/types";
import { RequirementXray } from "@/components/RequirementXray";

export function BoardShareView() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const [board, setBoard] = useState<CompareBoard | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "missing">("loading");
  const [openId, setOpenId] = useState<string | null>(null);
  const [xrayReq, setXrayReq] = useState<string | null>(null);

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
    () => (board ? sortRows(filterRows(board.rows, "", "all"), "score", "desc", board.mustHaves ?? []) : []),
    [board]
  );
  const mustHaves = board?.mustHaves ?? [];
  const delta = useMemo(() => (board ? leadDelta(board.rows) : null), [board]);
  const openRow = visible.find((row) => row.id === openId);

  useEffect(() => {
    const reqs = jdRequirements(visible);
    if (!reqs.length) {
      setXrayReq(null);
      return;
    }
    if (!xrayReq || !reqs.some((item) => item.requirement === xrayReq)) {
      setXrayReq(reqs[0].requirement);
    }
  }, [visible, xrayReq]);

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
              Scores organize this slate. They are not a hiring decision. Must-haves flag gaps. They do not reject.
            </p>
            {delta ? <p className="delta-note">{delta}</p> : null}
            <div className="table-wrap">
              <table className="req-table compare-table">
                <thead>
                  <tr>
                    <th>Candidate</th>
                    <th>Score</th>
                    <th>Strong</th>
                    <th>Gaps</th>
                    <th>Must-haves</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((row) => {
                    const stats = packetStats(row.packet);
                    const musts = mustHaveResult(row.packet, mustHaves);
                    return (
                      <tr key={row.id}>
                        <td>
                          <button type="button" className="compare-name" onClick={() => setOpenId(row.id)}>
                            {row.resumeName}
                          </button>
                          {row.note ? <div className="cat-tag">{row.note}</div> : null}
                        </td>
                        <td>{row.packet?.fitScore ?? "—"}</td>
                        <td className="must-ok">{stats.strong}</td>
                        <td className={stats.gaps ? "must-miss" : undefined}>{stats.gaps}</td>
                        <td>
                          {mustHaves.length ? (
                            <span className={musts.cleared ? "must-ok" : "must-miss"}>
                              {musts.passed}/{musts.total}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td>{RECRUITER_STATUS_LABELS[row.status]}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <RequirementXray
              rows={visible}
              selected={xrayReq}
              onSelect={setXrayReq}
              onOpenCandidate={setOpenId}
              mustHaves={mustHaves}
            />
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
