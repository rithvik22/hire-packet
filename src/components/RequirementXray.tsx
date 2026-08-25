"use client";

import { useMemo, useRef } from "react";
import { CopyButton } from "@/components/CopyButton";
import {
  jdRequirements,
  xrayForRequirement,
  xrayProof,
  xrayToText,
  type CompareRow,
  type JdRequirement,
} from "@/lib/compare";
import { CATEGORY_LABELS, SCORE_WEIGHTS, type MatchStatus, type ScoreCategory } from "@/lib/types";

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

export function RequirementXray({
  rows,
  selected,
  onSelect,
  onOpenCandidate,
  mustHaves = [],
  onToggleMustHave,
}: {
  rows: CompareRow[];
  selected: string | null;
  onSelect: (requirement: string) => void;
  onOpenCandidate?: (id: string) => void;
  mustHaves?: string[];
  onToggleMustHave?: (requirement: string) => void;
}) {
  const paneRef = useRef<HTMLElement>(null);
  const requirements = useMemo(() => jdRequirements(rows), [rows]);
  const grouped = useMemo(
    () =>
      CATEGORIES.map((category) => ({
        category,
        items: requirements.filter((item) => item.category === category),
      })).filter((group) => group.items.length > 0),
    [requirements]
  );
  const cells = useMemo(
    () => (selected ? xrayForRequirement(rows, selected) : []),
    [rows, selected]
  );
  const active = requirements.find((item) => item.requirement === selected) ?? null;

  if (!requirements.length) return null;

  function pick(item: JdRequirement) {
    onSelect(item.requirement);
    window.requestAnimationFrame(() => {
      paneRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }

  return (
    <section className="xray print-break">
      <div className="section-head">
        <h3>
          <span>02</span> Requirement x-ray
        </h3>
        <div className="no-print">
          <CopyButton text={selected ? xrayToText(selected, cells) : ""} label="Copy this line" />
        </div>
      </div>
      <p className="score-note">
        Pick a JD line to see every resume. Star up to three must-haves. A gap is a flag, not a reject.
      </p>
      <div className="xray-split">
        <div className="xray-lines">
          {grouped.map((group) => (
            <div key={group.category} className="xray-group">
              <p className="xray-cat">{CATEGORY_LABELS[group.category]}</p>
              <div className="xray-chips">
                {group.items.map((item) => {
                  const on = selected === item.requirement;
                  const must = mustHaves.includes(item.requirement);
                  return (
                    <div key={item.requirement} className={`xray-row${on ? " is-on" : ""}${must ? " is-must" : ""}`}>
                      <button
                        type="button"
                        className="xray-row-main"
                        aria-pressed={on}
                        onClick={() => pick(item)}
                      >
                        <strong>{item.requirement}</strong>
                        <span className="xray-counts">
                          <span className="xray-count-ok">{item.strong} strong</span>
                          {item.partial ? (
                            <>
                              <span className="xray-sep">·</span>
                              <span>{item.partial} partial</span>
                            </>
                          ) : null}
                          <span className="xray-sep">·</span>
                          <span className="xray-count-gap">
                            {item.gaps} gap{item.gaps === 1 ? "" : "s"}
                          </span>
                        </span>
                      </button>
                      {onToggleMustHave ? (
                        <button
                          type="button"
                          className={`must-star${must ? " is-on" : ""}`}
                          onClick={() => onToggleMustHave(item.requirement)}
                          disabled={!must && mustHaves.length >= 3}
                        >
                          {must ? "Must" : "Star"}
                        </button>
                      ) : must ? (
                        <span className="must-star is-on">Must</span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        {selected && active ? (
          <aside className="xray-pane" id="xray-pane" ref={paneRef}>
            <p className="xray-cat">Selected line</p>
            <h4>{active.requirement}</h4>
            <p className="xray-summary">
              <span className="xray-count-ok">{active.strong} strong</span>
              <span className="xray-sep">·</span>
              <span>{active.partial} partial</span>
              <span className="xray-sep">·</span>
              <span className="xray-count-gap">
                {active.gaps} gap{active.gaps === 1 ? "" : "s"}
              </span>
            </p>
            {onToggleMustHave ? (
              <button
                type="button"
                className={`btn-ghost must-pane-btn${mustHaves.includes(active.requirement) ? " is-on" : ""}`}
                onClick={() => onToggleMustHave(active.requirement)}
                disabled={!mustHaves.includes(active.requirement) && mustHaves.length >= 3}
              >
                {mustHaves.includes(active.requirement) ? "Must-have" : "Star as must-have"}
              </button>
            ) : null}
            <ul className="xray-people">
              {cells.map((cell) => (
                <li key={cell.id} className={`xray-person xray-person-${cell.status || "none"}`}>
                  <div className="xray-person-head">
                    {onOpenCandidate ? (
                      <button type="button" className="compare-name" onClick={() => onOpenCandidate(cell.id)}>
                        {cell.resumeName}
                      </button>
                    ) : (
                      <strong>{cell.resumeName}</strong>
                    )}
                    {cell.status ? <span className={chipClass(cell.status)}>{statusLabel(cell.status)}</span> : null}
                  </div>
                  <p>{xrayProof(cell)}</p>
                </li>
              ))}
            </ul>
          </aside>
        ) : null}
      </div>
    </section>
  );
}
