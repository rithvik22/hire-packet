"use client";

import type { JdExtraction } from "@/lib/types";

function joinLines(items: string[]) {
  return items.join("\n");
}

function splitLines(value: string) {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function JdReview({
  extraction,
  extractMode,
  onChange,
  onScore,
  onBack,
  busy,
}: {
  extraction: JdExtraction;
  extractMode: "gemini" | "heuristic";
  onChange: (next: JdExtraction) => void;
  onScore: () => void;
  onBack: () => void;
  busy: boolean;
}) {
  function patch<K extends keyof JdExtraction>(key: K, value: JdExtraction[K]) {
    onChange({ ...extraction, [key]: value });
  }

  const canScore = extraction.role.trim().length >= 3 && extraction.requiredSkills.length > 0;

  return (
    <div className="composer no-print">
      <div className="folder-tab">Review JD</div>
      <div className="composer-head">
        <label>Confirm extracted JSON</label>
        <span className="hint">
          {extractMode === "gemini" ? "Gemini extract · you confirm" : "Heuristic extract · you confirm"}
        </span>
      </div>
      <p className="form-note">
        Scoring uses this structured JD, not the original paste. Fix the lines, then score. Star must-haves after
        scores exist.
      </p>
      <div className="review-grid">
        <label>
          Role
          <input value={extraction.role} onChange={(e) => patch("role", e.target.value)} />
        </label>
        <label>
          Minimum years
          <input
            type="number"
            min={0}
            max={20}
            value={extraction.minimumExperience}
            onChange={(e) => patch("minimumExperience", Number(e.target.value) || 0)}
          />
        </label>
      </div>
      <label className="stack-field">
        Required skills (one per line)
        <textarea
          rows={5}
          value={joinLines(extraction.requiredSkills)}
          onChange={(e) => patch("requiredSkills", splitLines(e.target.value))}
        />
      </label>
      <label className="stack-field">
        Responsibilities
        <textarea
          rows={4}
          value={joinLines(extraction.responsibilities)}
          onChange={(e) => patch("responsibilities", splitLines(e.target.value))}
        />
      </label>
      <label className="stack-field">
        Preferred skills
        <textarea
          rows={3}
          value={joinLines(extraction.preferredSkills)}
          onChange={(e) => patch("preferredSkills", splitLines(e.target.value))}
        />
      </label>
      <label className="stack-field">
        Education
        <textarea
          rows={2}
          value={joinLines(extraction.education)}
          onChange={(e) => patch("education", splitLines(e.target.value))}
        />
      </label>
      <div className="composer-actions">
        <button type="button" className="btn-primary" onClick={onScore} disabled={busy || !canScore}>
          {busy ? "Scoring…" : "Score slate"}
        </button>
        <button type="button" className="btn-ghost" onClick={onBack} disabled={busy}>
          Back to paste
        </button>
      </div>
    </div>
  );
}
