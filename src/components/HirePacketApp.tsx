"use client";

import { FormEvent, KeyboardEvent, useEffect, useState } from "react";
import { candidate } from "@/data/candidate";
import { sampleCandidateResume } from "@/data/resume";
import { SAMPLE_JD, SAMPLE_JD_TITLE } from "@/data/sample-jd";
import type { CandidateResume, HirePacketResult } from "@/lib/types";
import { PacketReport } from "@/components/PacketReport";
import { ResumeIntake } from "@/components/ResumeIntake";
import { ResumeReview } from "@/components/ResumeReview";
import { SiteHeader } from "@/components/SiteHeader";

const STEPS = [
  { n: "01", label: "Extract JD into structured JSON" },
  { n: "02", label: "Match each line to confirmed resume evidence" },
  { n: "03", label: "Score 35 / 25 / 20 / 10 / 10 in code" },
  { n: "04", label: "Write the brief from verified matches only" },
];

export function HirePacketApp() {
  const [resume, setResume] = useState<CandidateResume | null>(null);
  const [resumeMode, setResumeMode] = useState<"gemini" | "heuristic">("heuristic");
  const [confirmed, setConfirmed] = useState(false);
  const [usingSample, setUsingSample] = useState(false);
  const [jobDescription, setJobDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [packet, setPacket] = useState<HirePacketResult | null>(null);

  const tooShort = jobDescription.trim().length > 0 && jobDescription.trim().length < 40;
  const canSubmit = Boolean(confirmed && resume && jobDescription.trim().length >= 40 && !loading);
  const empty = !packet && !loading && !error && confirmed;

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
    if (!resume || !confirmed) {
      setError("Upload a resume or choose the sample candidate first.");
      return;
    }
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
        body: JSON.stringify({ jobDescription: text, resume }),
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

  function resetResume() {
    setResume(null);
    setConfirmed(false);
    setUsingSample(false);
    setPacket(null);
    setError(null);
  }

  return (
    <div className="desk">
      <div className="blotter">
        <SiteHeader />

        <main>
          <section className="hero no-print">
            <p className="eyebrow">Single packet</p>
            <h1>Match one resume to the job.</h1>
            <p className="lede">
              Upload, confirm the extract, paste the JD. You get a score with cited evidence — not an auto-reject.
            </p>
          </section>

          {!resume ? (
            <ResumeIntake
              busy={loading}
              onParsed={(next, mode) => {
                setResume(next);
                setResumeMode(mode);
                setUsingSample(false);
                setConfirmed(false);
              }}
              onSample={() => {
                setResume(sampleCandidateResume());
                setResumeMode("heuristic");
                setUsingSample(true);
                setConfirmed(false);
              }}
            />
          ) : !confirmed ? (
            <ResumeReview
              resume={resume}
              extractMode={usingSample ? "heuristic" : resumeMode}
              isSample={usingSample}
              onChange={setResume}
              onConfirm={() => {
                setResume({
                  ...resume,
                  experience: resume.experience.filter((job) => job.company.trim() && job.role.trim()),
                });
                setConfirmed(true);
              }}
              onBack={resetResume}
            />
          ) : (
            <form className="composer no-print" onSubmit={onSubmit}>
              <div className="folder-tab">JD intake</div>
              <div className="composer-head">
                <label htmlFor="jd">Paste the job description</label>
                <span className="hint">{jobDescription.trim().length.toLocaleString()} characters</span>
              </div>
              <p className="source-chip">
                Matching <strong>{resume.candidate}</strong>
                {usingSample ? " · sample candidate" : ""}
                <button type="button" className="btn-tiny" onClick={resetResume}>
                  Change resume
                </button>
              </p>
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
                {usingSample ? (
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
                ) : null}
                <span className="kbd-hint">⌘ Enter</span>
              </div>
            </form>
          )}

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
                {usingSample
                  ? "Run the Northline sample to see a live brief — score, proof, gaps, and a forward-ready note — in under a minute."
                  : `Paste a JD to match against ${resume?.candidate ?? "this resume"}.`}
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
