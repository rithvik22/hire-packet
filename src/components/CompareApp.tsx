"use client";

import { ChangeEvent, DragEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { candidate } from "@/data/candidate";
import { demoSlate } from "@/data/demo-slate";
import { SAMPLE_JD, SAMPLE_JD_TITLE } from "@/data/sample-jd";
import {
  boardToText,
  defaultStatus,
  encodeBoard,
  filterRows,
  jdRequirements,
  leadDelta,
  MAX_COMPARE_RESUMES,
  MAX_MUST_HAVES,
  mustHaveResult,
  packetStats,
  sortRows,
  toggleMustHave,
  type CompareBoard,
  type CompareRow,
  type SortKey,
} from "@/lib/compare";
import { RECRUITER_STATUS_LABELS, type CandidateResume, type JdExtraction, type RecruiterStatus } from "@/lib/types";
import { PacketReport } from "@/components/PacketReport";
import { JdReview } from "@/components/JdReview";
import { RequirementXray } from "@/components/RequirementXray";
import { SiteHeader } from "@/components/SiteHeader";
import { CopyButton } from "@/components/CopyButton";

function newId(): string {
  return crypto.randomUUID();
}

function SortHead({
  k,
  label,
  active,
  dir,
  onSort,
}: {
  k: SortKey;
  label: string;
  active: SortKey;
  dir: "asc" | "desc";
  onSort: (key: SortKey) => void;
}) {
  return (
    <button type="button" className={`sort-btn${active === k ? " is-on" : ""}`} onClick={() => onSort(k)}>
      {label}
      {active === k ? <span className="sort-caret">{dir === "asc" ? "↑" : "↓"}</span> : null}
    </button>
  );
}

export function CompareApp() {
  const [jobDescription, setJobDescription] = useState("");
  const [rows, setRows] = useState<CompareRow[]>([]);
  const [resumes, setResumes] = useState<Record<string, CandidateResume>>({});
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<RecruiterStatus | "all">("all");
  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [openId, setOpenId] = useState<string | null>(null);
  const [shareState, setShareState] = useState<"idle" | "working" | "done" | "error">("idle");
  const [role, setRole] = useState("");
  const [generatedAt, setGeneratedAt] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [xrayReq, setXrayReq] = useState<string | null>(null);
  const [mustHaves, setMustHaves] = useState<string[]>([]);
  const [mustFilter, setMustFilter] = useState<"all" | "clears" | "missing">("all");
  const [extraction, setExtraction] = useState<JdExtraction | null>(null);
  const [extractMode, setExtractMode] = useState<"gemini" | "heuristic">("heuristic");
  const [jdStep, setJdStep] = useState<"paste" | "review" | "done">("paste");
  const fileRef = useRef<HTMLInputElement>(null);

  const generated = rows.some((row) => row.packet);
  const tooShort = jobDescription.trim().length > 0 && jobDescription.trim().length < 40;

  const visible = useMemo(
    () => filterRows(sortRows(rows, sortKey, sortDir, mustHaves), query, statusFilter, mustHaves, mustFilter),
    [rows, sortKey, sortDir, query, statusFilter, mustHaves, mustFilter]
  );

  const delta = useMemo(() => leadDelta(rows), [rows]);

  useEffect(() => {
    const reqs = jdRequirements(rows);
    if (!reqs.length) {
      setXrayReq(null);
      return;
    }
    if (!xrayReq || !reqs.some((item) => item.requirement === xrayReq)) {
      setXrayReq(reqs[0].requirement);
    }
  }, [rows, xrayReq]);

  const board: CompareBoard = {
    role: role || "Role",
    createdAt: generatedAt || new Date().toISOString(),
    mode: rows.find((row) => row.packet)?.packet?.mode ?? "heuristic",
    rows,
    mustHaves,
  };

  function addResume(filename: string, resume: CandidateResume) {
    const id = newId();
    setResumes((current) => ({ ...current, [id]: resume }));
    setRows((current) => {
      if (current.length >= MAX_COMPARE_RESUMES) return current;
      return [
        ...current,
        {
          id,
          filename,
          resumeName: resume.candidate || filename,
          packet: null,
          error: null,
          status: defaultStatus(),
          note: "",
        },
      ];
    });
  }

  async function ingestFiles(files: File[]) {
    if (!files.length) return;
    setError(null);
    const room = MAX_COMPARE_RESUMES - rows.length;
    const picked = files.slice(0, room);
    for (let i = 0; i < picked.length; i++) {
      const file = picked[i];
      setProgress(`Parsing ${i + 1}/${picked.length}: ${file.name}`);
      try {
        const body = new FormData();
        body.append("file", file);
        body.append("fast", "1");
        const res = await fetch("/api/resume/parse", { method: "POST", body });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `Could not read ${file.name}`);
        addResume(file.name, data.resume as CandidateResume);
      } catch (err) {
        setRows((current) => [
          ...current,
          {
            id: newId(),
            filename: file.name,
            resumeName: file.name,
            packet: null,
            error: err instanceof Error ? err.message : "Could not read resume.",
            status: defaultStatus(),
            note: "",
          },
        ]);
      }
    }
    setProgress(null);
  }

  function onFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = [...(event.target.files || [])];
    event.target.value = "";
    void ingestFiles(files);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragOver(false);
    void ingestFiles([...event.dataTransfer.files]);
  }

  function loadDemo() {
    setError(null);
    demoSlate().forEach((item) => addResume(item.filename, item.resume));
  }

  async function extractJd(event?: FormEvent) {
    event?.preventDefault();
    const ready = rows.filter((row) => resumes[row.id]);
    if (jobDescription.trim().length < 40) {
      setError("Paste a fuller job description (at least ~40 characters).");
      return;
    }
    if (ready.length < 1) {
      setError("Upload at least one resume, or load the demo slate.");
      return;
    }

    setProgress("Extracting JD into JSON…");
    setError(null);
    try {
      const res = await fetch("/api/jd", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobDescription }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not extract that JD.");
      setExtraction(data.extraction as JdExtraction);
      setExtractMode(data.mode === "gemini" ? "gemini" : "heuristic");
      setJdStep("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not extract that JD.");
    } finally {
      setProgress(null);
    }
  }

  async function scoreSlate() {
    const ready = rows.filter((row) => resumes[row.id]);
    if (!extraction) {
      setError("Review the JD extract first.");
      return;
    }
    if (ready.length < 1) {
      setError("Upload at least one resume, or load the demo slate.");
      return;
    }

    setProgress(`Scoring ${ready.length} candidates against the confirmed JD…`);
    setError(null);
    try {
      const res = await fetch("/api/fit/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobDescription,
          extraction,
          resumes: ready.map((row) => resumes[row.id]),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate comparison.");
      const packets = data.packets as CompareRow["packet"][];
      setRole(String(data.role || extraction.role || "Role"));
      setGeneratedAt(new Date().toISOString());
      setMustHaves([]);
      setMustFilter("all");
      setRows((current) =>
        current.map((row) => {
          const index = ready.findIndex((item) => item.id === row.id);
          if (index < 0) return row;
          const packet = packets[index];
          return {
            ...row,
            packet,
            resumeName: packet?.candidate.name || row.resumeName,
            error: packet ? null : row.error,
            status: row.status === "review" ? defaultStatus() : row.status,
          };
        })
      );
      setJdStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate comparison.");
    } finally {
      setProgress(null);
    }
  }

  async function shareShortlist() {
    setShareState("working");
    try {
      const payload: CompareBoard = {
        ...board,
        rows: board.rows.filter((row) => row.status === "shortlist" && row.packet),
      };
      if (!payload.rows.length) {
        setShareState("error");
        return;
      }
      const stored = await fetch("/api/board", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ board: payload, shortlistOnly: true }),
      });
      const data = await stored.json();
      if (!stored.ok) throw new Error(data.error || "Could not create link.");
      const shareUrl = `${window.location.origin}${data.path}#${encodeBoard(payload)}`;
      await navigator.clipboard.writeText(shareUrl);
      setShareState("done");
      window.setTimeout(() => setShareState("idle"), 2000);
    } catch {
      setShareState("error");
    }
  }

  function cycleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else {
      setSortKey(key);
      setSortDir(key === "name" ? "asc" : "desc");
    }
  }

  function starMust(requirement: string) {
    const next = toggleMustHave(mustHaves, requirement);
    if (next === mustHaves && !mustHaves.includes(requirement)) {
      setError(`Star at most ${MAX_MUST_HAVES} must-haves. Unstar one first.`);
      return;
    }
    setMustHaves(next);
    setError(null);
  }

  const openRow = rows.find((row) => row.id === openId);

  return (
    <div className="desk">
      <div className="blotter blotter-wide">
        <SiteHeader />

        <main>
          {jdStep !== "done" ? (
            <section className="hero no-print">
              <p className="eyebrow">Comparison board</p>
              <h1>Rank a slate against one JD.</h1>
              <p className="lede">
                Paste the job, drop resumes, confirm the JD extract, then x-ray and star must-haves. You shortlist.
                Nothing is auto-rejected.
              </p>
            </section>
          ) : null}

          {jdStep === "review" && extraction ? (
            <>
              <JdReview
                extraction={extraction}
                extractMode={extractMode}
                onChange={setExtraction}
                onScore={() => void scoreSlate()}
                onBack={() => setJdStep("paste")}
                busy={Boolean(progress)}
              />
              {progress ? <p className="form-note">{progress}</p> : null}
              {error ? (
                <div className="form-error" role="alert">
                  <p>{error}</p>
                </div>
              ) : null}
              <ul className="slate-list">
                {rows.map((row) => (
                  <li key={row.id}>
                    <strong>{row.resumeName}</strong>
                    <span>{row.filename}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : jdStep === "paste" ? (
          <form className="composer no-print" onSubmit={extractJd}>
            <div className="folder-tab">Job + resumes</div>
            <div className="composer-head">
              <label htmlFor="compare-jd">Paste the job description</label>
              <span className="hint">{jobDescription.trim().length.toLocaleString()} characters</span>
            </div>
            <textarea
              id="compare-jd"
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              placeholder="One JD for the whole slate…"
              rows={8}
              spellCheck={false}
            />
            {tooShort ? <p className="form-note">Need a bit more JD to classify against.</p> : null}

            <div className="composer-head" style={{ marginTop: 16 }}>
              <label htmlFor="compare-files">Resumes</label>
              <span className="hint">
                {rows.length}/{MAX_COMPARE_RESUMES} · 4 MB each · not stored
              </span>
            </div>
            <div
              className={`dropzone${dragOver ? " dropzone-over" : ""}`}
              onClick={() => fileRef.current?.click()}
              onDragOver={(event) => {
                event.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
            >
              <p>
                Drop PDF or DOCX files, or{" "}
                <button
                  type="button"
                  className="linkish"
                  onClick={(event) => {
                    event.stopPropagation();
                    fileRef.current?.click();
                  }}
                  disabled={Boolean(progress) || rows.length >= MAX_COMPARE_RESUMES}
                >
                  browse
                </button>
              </p>
              <p>Parsed locally — no Gemini. Review the JD JSON, then score in code.</p>
              <input
                ref={fileRef}
                id="compare-files"
                type="file"
                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                multiple
                onChange={onFiles}
                disabled={Boolean(progress) || rows.length >= MAX_COMPARE_RESUMES}
                hidden
              />
            </div>

            {progress ? <p className="form-note">{progress}</p> : null}
            {error ? (
              <div className="form-error" role="alert">
                <p>{error}</p>
              </div>
            ) : null}

            <ul className="slate-list">
              {rows.map((row) => (
                <li key={row.id}>
                  <strong>{row.resumeName}</strong>
                  <span>{row.filename}</span>
                  {row.error ? <em>{row.error}</em> : null}
                  <button
                    type="button"
                    className="btn-tiny"
                    onClick={() => {
                      setRows((current) => current.filter((item) => item.id !== row.id));
                      setResumes((current) => {
                        const next = { ...current };
                        delete next[row.id];
                        return next;
                      });
                    }}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>

            <div className="composer-actions">
              <button type="submit" className="btn-primary" disabled={Boolean(progress) || rows.length < 1}>
                {progress ? "Working…" : "Review JD extract"}
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  setJobDescription(SAMPLE_JD);
                }}
                disabled={Boolean(progress)}
              >
                {SAMPLE_JD_TITLE}
              </button>
              <button type="button" className="btn-ghost" onClick={loadDemo} disabled={Boolean(progress)}>
                Load 5 demo candidates
              </button>
            </div>
          </form>
          ) : null}

          {generated && jdStep === "done" ? (
            <section className="compare-board">
              <div className="section-head">
                <h3>
                  <span>01</span> Comparison
                </h3>
                <div className="no-print compare-tools">
                  <CopyButton text={boardToText(board)} label="Copy table" />
                  <button type="button" className="btn-ghost" onClick={() => setJdStep("review")}>
                    Edit extract
                  </button>
                  <button type="button" className="btn-ghost" onClick={() => window.print()}>
                    Download PDF
                  </button>
                  <button type="button" className="btn-ghost" onClick={() => void shareShortlist()}>
                    {shareState === "done"
                      ? "Link copied"
                      : shareState === "working"
                        ? "Creating…"
                        : shareState === "error"
                          ? "Shortlist first"
                          : "Share shortlist"}
                  </button>
                </div>
              </div>
              <p className="score-note">
                {role ? `${role} · ` : ""}
                Scores rank the slate. Must-haves flag gaps. Status is yours. There is no auto-reject.
              </p>
              {delta ? <p className="delta-note">{delta}</p> : null}
              <div className="compare-filters no-print">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search name or note"
                />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as RecruiterStatus | "all")}
                >
                  <option value="all">All statuses</option>
                  <option value="shortlist">Shortlist</option>
                  <option value="review">Review</option>
                  <option value="hold">Hold</option>
                </select>
                <select
                  value={mustFilter}
                  onChange={(e) => setMustFilter(e.target.value as "all" | "clears" | "missing")}
                  disabled={!mustHaves.length}
                >
                  <option value="all">All must-haves</option>
                  <option value="clears">Clears must-haves</option>
                  <option value="missing">Missing a must-have</option>
                </select>
              </div>
              <div className="table-wrap">
                <table className="req-table compare-table">
                  <thead>
                    <tr>
                      <th>
                        <SortHead k="name" label="Candidate" active={sortKey} dir={sortDir} onSort={cycleSort} />
                      </th>
                      <th>
                        <SortHead k="score" label="Score" active={sortKey} dir={sortDir} onSort={cycleSort} />
                      </th>
                      <th>
                        <SortHead k="strong" label="Strong" active={sortKey} dir={sortDir} onSort={cycleSort} />
                      </th>
                      <th>
                        <SortHead k="gaps" label="Gaps" active={sortKey} dir={sortDir} onSort={cycleSort} />
                      </th>
                      <th>
                        <SortHead k="musts" label="Must-haves" active={sortKey} dir={sortDir} onSort={cycleSort} />
                      </th>
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
                            <button
                              type="button"
                              className="compare-name"
                              onClick={() => setOpenId(row.id)}
                              disabled={!row.packet}
                            >
                              {row.resumeName}
                            </button>
                            {row.note ? <div className="cat-tag">{row.note}</div> : null}
                          </td>
                          <td>{row.packet ? row.packet.fitScore : "—"}</td>
                          <td className="must-ok">{row.packet ? stats.strong : "—"}</td>
                          <td className={row.packet && stats.gaps ? "must-miss" : undefined}>
                            {row.packet ? stats.gaps : "—"}
                          </td>
                          <td>
                            {mustHaves.length ? (
                              <span className={musts.cleared ? "must-ok" : "must-miss"}>
                                {musts.passed}/{musts.total}
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td>
                            <select
                              className={`status-select status-${row.status}`}
                              value={row.status}
                              onChange={(e) =>
                                setRows((current) =>
                                  current.map((item) =>
                                    item.id === row.id
                                      ? { ...item, status: e.target.value as RecruiterStatus }
                                      : item
                                  )
                                )
                              }
                            >
                              {(Object.keys(RECRUITER_STATUS_LABELS) as RecruiterStatus[]).map((status) => (
                                <option key={status} value={status}>
                                  {RECRUITER_STATUS_LABELS[status]}
                                </option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <RequirementXray
                rows={rows.filter((row) => row.packet)}
                selected={xrayReq}
                onSelect={setXrayReq}
                onOpenCandidate={setOpenId}
                mustHaves={mustHaves}
                onToggleMustHave={starMust}
              />
            </section>
          ) : null}

          {openRow?.packet ? (
            <div className="evidence-layer no-print">
              <div className="evidence-pane">
                <div className="section-head">
                  <h3>
                    <span>03</span> Evidence · {openRow.resumeName}
                  </h3>
                  <button type="button" className="btn-ghost" onClick={() => setOpenId(null)}>
                    Back to table
                  </button>
                </div>
                <label className="stack-field">
                  Recruiter note
                  <textarea
                    rows={2}
                    value={openRow.note}
                    onChange={(e) =>
                      setRows((current) =>
                        current.map((item) => (item.id === openRow.id ? { ...item, note: e.target.value } : item))
                      )
                    }
                  />
                </label>
                <PacketReport packet={openRow.packet} shareMode />
              </div>
            </div>
          ) : null}
        </main>

        <footer className="site-foot no-print">
          <p>
            Built by {candidate.name}
            <span className="dot" />
            Comparison does not auto-reject
          </p>
        </footer>
      </div>
    </div>
  );
}
