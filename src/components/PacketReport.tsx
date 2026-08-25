"use client";

import { useEffect, useState } from "react";
import { packetToPlainText, sectionText } from "@/lib/packet-text";
import { encodePacket } from "@/lib/share";
import {
  CATEGORY_LABELS,
  RECOMMENDATION_LABELS,
  SCORE_WEIGHTS,
  type HirePacketResult,
  type MatchStatus,
  type ScoreCategory,
} from "@/lib/types";
import { CopyButton } from "@/components/CopyButton";

const CATEGORIES = Object.keys(SCORE_WEIGHTS) as ScoreCategory[];

function statusLabel(status: MatchStatus) {
  if (status === "strong_match") return "Strong";
  if (status === "partial_match") return "Partial";
  return "Gap";
}

function chipClass(status: MatchStatus) {
  if (status === "strong_match") return "chip chip-strong";
  if (status === "partial_match") return "chip chip-partial";
  return "chip chip-gap";
}

function ScoreStamp({ score }: { score: number }) {
  const tone = score >= 80 ? "high" : score >= 55 ? "mid" : "low";
  const r = 52;
  const c = 2 * Math.PI * r;
  const dash = (Math.max(0, Math.min(100, score)) / 100) * c;
  return (
    <div className={`stamp stamp-${tone}`} aria-label={`Fit score ${score} out of 100`}>
      <svg viewBox="0 0 120 120" aria-hidden>
        <circle className="stamp-track" cx="60" cy="60" r={r} />
        <circle
          className="stamp-ring"
          cx="60"
          cy="60"
          r={r}
          strokeDasharray={`${dash} ${c}`}
          transform="rotate(-90 60 60)"
        />
      </svg>
      <div className="stamp-inner">
        <span className="stamp-score">{score}</span>
        <span className="stamp-caption">Fit / 100</span>
      </div>
    </div>
  );
}

function SectionHead({ n, title, copy }: { n: string; title: string; copy: string }) {
  return (
    <div className="section-head">
      <h3>
        <span>{n}</span> {title}
      </h3>
      <div className="no-print">
        <CopyButton text={copy} label="Copy" className="btn-tiny" />
      </div>
    </div>
  );
}

export function PacketReport({
  packet,
  shareMode = false,
  onNewAnalysis,
}: {
  packet: HirePacketResult;
  shareMode?: boolean;
  onNewAnalysis?: () => void;
}) {
  const [shareState, setShareState] = useState<"idle" | "working" | "done" | "error">("idle");
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setExpanded(false);
  }, [packet.generatedAt]);

  async function createShare() {
    setShareState("working");
    try {
      await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packet }),
      });
      const url = `${window.location.origin}${packet.sharePath}#${encodePacket(packet)}`;
      await navigator.clipboard.writeText(url);
      setShareState("done");
      window.setTimeout(() => setShareState("idle"), 2000);
    } catch {
      setShareState("error");
    }
  }

  const person = packet.candidate;
  const generated = new Date(packet.generatedAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <article className="dossier" id="packet">
      <div className="dossier-tab" aria-hidden>
        Hire packet
      </div>
      <header className="dossier-masthead">
        <div className="dossier-kicker">
          <span>Evidence brief</span>
          <span className="dot" />
          <span>{generated}</span>
          <span className="dot" />
          <span className={packet.mode === "gemini" ? "mode-ai" : "mode-local"}>
            {packet.mode === "gemini" ? "Gemini extracted · code scored" : "Heuristic extract · code scored"}
          </span>
        </div>
        <div className="dossier-title-row">
          <div>
            <p className="dossier-eyebrow">{packet.roleGuess}</p>
            <h2 className="dossier-name">{person.name}</h2>
            <p className="dossier-meta">
              {person.headline || packet.seniority}
              {person.headline ? (
                <>
                  <span className="dot" />
                  {packet.seniority}
                </>
              ) : null}
              {person.location ? (
                <>
                  <span className="dot" />
                  {person.location}
                </>
              ) : null}
            </p>
            <p className={`rec-banner rec-${packet.recommendation}`}>
              {RECOMMENDATION_LABELS[packet.recommendation]}
            </p>
            <p className="dossier-links">
              {person.email ? <a href={`mailto:${person.email}`}>{person.email}</a> : null}
              {person.linkedin ? (
                <a href={person.linkedin} target="_blank" rel="noreferrer">
                  LinkedIn
                </a>
              ) : null}
              {person.github ? (
                <a href={person.github} target="_blank" rel="noreferrer">
                  GitHub
                </a>
              ) : null}
              {person.portfolio ? (
                <a href={person.portfolio} target="_blank" rel="noreferrer">
                  Portfolio
                </a>
              ) : null}
            </p>
          </div>
          <ScoreStamp score={packet.fitScore} />
        </div>
      </header>

      <div className="dossier-toolbar no-print">
        <CopyButton text={packetToPlainText(packet)} label="Copy packet" />
        <CopyButton text={packet.recruiterPitch} label="Copy recruiter note" />
        <button type="button" className="btn-ghost" onClick={() => window.print()}>
          Download PDF
        </button>
        {!shareMode ? (
          <button type="button" className="btn-ghost" onClick={() => void createShare()}>
            {shareState === "done" ? "Link copied" : shareState === "working" ? "Creating…" : "Copy share link"}
          </button>
        ) : null}
        {onNewAnalysis ? (
          <button type="button" className="btn-ghost" onClick={onNewAnalysis}>
            Start new analysis
          </button>
        ) : null}
      </div>

      {!shareMode ? (
        <p className="share-line no-print">
          Shareable <code>{packet.sharePath}</code>
          <span className="muted"> — JD is never stored</span>
        </p>
      ) : null}

      <section className="dossier-section print-break">
        <SectionHead n="01" title="Explainable fit" copy={sectionText(packet, "score")} />
        <ul className="score-bars">
          {CATEGORIES.map((key) => {
            const row = packet.scoreBreakdown[key];
            const pct = row.max ? Math.round((row.earned / row.max) * 100) : 0;
            return (
              <li key={key}>
                <div className="bar-meta">
                  <span>
                    {CATEGORY_LABELS[key]} <em>{row.max} pts</em>
                  </span>
                  <span>{row.na ? "Not in JD" : `${row.earned}/${row.max}`}</span>
                </div>
                <div className="bar-track" aria-hidden>
                  <div className={`bar-fill ${row.na ? "na" : ""}`} style={{ width: `${row.na ? 0 : pct}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
        <p className="score-note">
          Strong = full points · Partial = half · Gap = zero. Gemini explains this number. It does not pick it.
        </p>
      </section>

      <p className="dossier-summary">{packet.summary}</p>

      <section className="dossier-section print-break">
        <SectionHead n="02" title="Why interview" copy={sectionText(packet, "why")} />
        <ol className="why-cards">
          {packet.whyInterview.map((item, i) => (
            <li key={item}>
              <em>{String(i + 1).padStart(2, "0")}</em>
              <span>{item}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="dossier-section print-break">
        <SectionHead n="03" title="Requirement ledger" copy={sectionText(packet, "requirements")} />
        <div className="table-wrap">
          <p className="evidence-toggle no-print">
            <button type="button" className="btn-tiny" onClick={() => setExpanded((v) => !v)}>
              {expanded ? "Collapse evidence" : "Expand evidence"}
            </button>
          </p>
          <table className="req-table">
            <thead>
              <tr>
                <th>JD requirement</th>
                <th>Match</th>
                <th>Resume evidence</th>
              </tr>
            </thead>
            <tbody>
              {packet.requirements.map((row) => (
                <tr key={`${row.category}-${row.requirement}`}>
                  <td>
                    <strong>{row.requirement}</strong>
                    <div className="cat-tag">{CATEGORY_LABELS[row.category]}</div>
                  </td>
                  <td>
                    <span className={chipClass(row.status)}>{statusLabel(row.status)}</span>
                  </td>
                  <td className="evidence-cell">
                    {row.evidence.length ? (
                      <div>
                        <p className="match-ev">{row.evidence[0]}</p>
                        {row.evidence.length > 1 ? (
                          <ul className={expanded ? "extra-evidence" : "extra-evidence extra-hidden"}>
                            {row.evidence.slice(1).map((line) => (
                              <li key={line}>{line}</li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    ) : (
                      <span>{row.gap ?? "No direct production experience"}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="dossier-section print-break">
        <SectionHead n="04" title="Honest gaps" copy={sectionText(packet, "gaps")} />
        <div className="gap-grid">
          <GapCol title="Missing" items={packet.gaps.missing} />
          <GapCol title="Transferable" items={packet.gaps.transferable} />
          <GapCol title="Ask in the room" items={packet.gaps.discuss} />
        </div>
      </section>

      <section className="dossier-section print-break">
        <SectionHead n="05" title="Interview questions" copy={sectionText(packet, "questions")} />
        <ol className="q-cards">
          {packet.interviewQuestions.map((q, i) => (
            <li key={q.question}>
              <em>{String(i + 1).padStart(2, "0")}</em>
              <div>
                <span>{q.question}</span>
                <small>
                  Based on {q.basedOn}: {q.context}
                </small>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="dossier-section pitch-block print-break">
        <SectionHead n="06" title="Forward this" copy={sectionText(packet, "pitch")} />
        <blockquote className="pitch">{packet.recruiterPitch}</blockquote>
      </section>

      <p className="disclosure">{packet.disclosure}</p>
    </article>
  );
}

function GapCol({ title, items }: { title: string; items: { requirement: string; note: string }[] }) {
  return (
    <div className="gap-col">
      <h4>{title}</h4>
      {items.length === 0 ? (
        <p className="muted">None called out.</p>
      ) : (
        <ul>
          {items.map((g) => (
            <li key={g.requirement}>
              <strong>{g.requirement}</strong>
              <span>{g.note}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
