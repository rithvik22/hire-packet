"use client";

import { FormEvent, KeyboardEvent, useEffect, useState } from "react";
import { candidate } from "@/data/candidate";
import { RETELL_JD, RETELL_JD_TITLE, SAMPLE_JD, SAMPLE_JD_TITLE } from "@/data/sample-jd";
import type { HirePacketResult } from "@/lib/types";
import { PacketReport } from "@/components/PacketReport";
import { SiteHeader } from "@/components/SiteHeader";

const STEPS = [
  { n: "01", label: "Extract JD into structured JSON" },
  { n: "02", label: "Match each line to frozen resume evidence" },
  { n: "03", label: "Score 35 / 25 / 20 / 10 / 10 in code" },
  { n: "04", label: "Write the brief from verified matches only" },
];

export function HirePacketApp() {
  const [jobDescription, setJobDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [packet, setPacket] = useState<HirePacketResult | null>(null);

  const tooShort = jobDescription.trim().length > 0 && jobDescription.trim().length < 40;
  const canSubmit = jobDescription.trim().length >= 40 && !loading;
  const empty = !packet && !loading && !error;

  useEffect(() => {
    if (!loading) return;
    setStep(0);
    const id = window.setInterval(() => {
      setStep((s) => (s + 1) % STEPS.length);
    }, 1100);
    return () => window.clearInterval(id);
  }, [loading]);

  async function generate(jd = jobDescription) {
    const text = jd.trim();
    if (text.length < 40) {
      setError("Paste a fuller job description (at least ~40 characters).");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/fit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobDescription: text }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to generate hire packet.");
      }
      setPacket(data as HirePacketResult);
      window.requestAnimationFrame(() => {
        document.getElementById("packet")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate hire packet.");
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void generate();
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      void generate();
    }
  }

  return (
    <div className="desk">
      <div className="blotter">
        <SiteHeader />

        <main>
          <section className="hero no-print">
            <p className="eyebrow">
              <span className="tape">Verified resume</span>
              Evidence-backed brief for {candidate.name.split(" ")[0]}
            </p>
            <h1>
              Paste a job.
              <span>Leave with proof.</span>
            </h1>
            <p className="lede">
              A one-page hire packet: exact resume bullets, an explainable score, honest gaps, and a
              note a recruiter can forward. Gemini reads the JD. Code does the matching.
            </p>
            <ul className="proof-row">
              <li>
                <strong>01 Proof</strong>
                <span>Every strong match cites a frozen resume bullet. No invented jobs.</span>
              </li>
              <li>
                <strong>02 Score</strong>
                <span>35 / 25 / 20 / 10 / 10 — calculated in TypeScript, not by the model.</span>
              </li>
              <li>
                <strong>03 Honesty</strong>
                <span>Gaps stay gaps. Telephony maps to Socket.IO — it is not a call-center job.</span>
              </li>
            </ul>
          </section>

          <form className="composer no-print" onSubmit={onSubmit}>
            <div className="folder-tab">JD intake</div>
            <div className="composer-head">
              <label htmlFor="jd">Paste the job description</label>
              <span className="hint">{jobDescription.trim().length.toLocaleString()} characters</span>
            </div>
            <textarea
              id="jd"
              name="jobDescription"
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Drop the full JD here — required skills, responsibilities, preferred stack, years…"
              rows={11}
              spellCheck={false}
            />
            {tooShort ? <p className="form-note">Need a bit more JD to classify against.</p> : null}
            {error ? (
              <div className="form-error" role="alert">
                <p>{error}</p>
                <button type="button" className="btn-ghost" onClick={() => void generate()}>
                  Retry
                </button>
              </div>
            ) : null}
            <div className="composer-actions">
              <button type="submit" className="btn-primary" disabled={!canSubmit}>
                {loading ? "Collating…" : "Generate hire packet"}
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  setJobDescription(RETELL_JD);
                  void generate(RETELL_JD);
                }}
                disabled={loading}
              >
                {RETELL_JD_TITLE}
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  setJobDescription(SAMPLE_JD);
                  void generate(SAMPLE_JD);
                }}
                disabled={loading}
              >
                {SAMPLE_JD_TITLE}
              </button>
              <span className="kbd-hint">⌘ Enter</span>
            </div>
          </form>

          {loading ? (
            <div className="collating" aria-live="polite">
              <p className="collating-kicker">Assembling the brief</p>
              <ol className="collate-steps">
                {STEPS.map((item, i) => (
                  <li key={item.n} className={i === step ? "active" : i < step ? "done" : ""}>
                    <span>{item.n}</span>
                    {item.label}
                  </li>
                ))}
              </ol>
            </div>
          ) : null}

          {empty ? (
            <div className="empty-packet no-print">
              <div className="empty-folder" aria-hidden />
              <p className="collating-kicker">Awaiting a job description</p>
              <p>
                Run the Retell sample to see a live brief — score, proof, gaps, and a forward-ready
                note — in under a minute.
              </p>
            </div>
          ) : null}

          {packet && !loading ? (
            <PacketReport
              packet={packet}
              onNewAnalysis={() => {
                setPacket(null);
                setError(null);
                setJobDescription("");
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            />
          ) : null}

          <section className="how no-print">
            <h2>Not an ATS scanner.</h2>
            <ol>
              <li>
                <strong>Frozen resume JSON.</strong> Gemini never edits{" "}
                <code>src/data/resume.ts</code> and does not see it while extracting the JD.
              </li>
              <li>
                <strong>Match in code.</strong> No evidence → cannot be a strong match. Weights:
                required 35, experience 25, responsibilities 20, preferred 10, education 10.
              </li>
              <li>
                <strong>Narrative last.</strong> The model may only write copy from verified matches.
                Invalid JSON is retried, then a heuristic fallback — the page does not crash.
              </li>
            </ol>
          </section>
        </main>

        <footer className="site-foot no-print">
          <p>
            Built by {candidate.name}
            <span className="dot" />
            Irving, TX
          </p>
          <p>
            <a href={`mailto:${candidate.email}`}>{candidate.email}</a>
          </p>
        </footer>
      </div>
    </div>
  );
}
