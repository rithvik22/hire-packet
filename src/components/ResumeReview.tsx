"use client";

import type { CandidateResume, ResumeJob } from "@/lib/types";

function emptyJob(): ResumeJob {
  return { company: "", role: "", location: "", start: "", end: "", evidence: [] };
}

function joinLines(items: string[]): string {
  return items.join("\n");
}

function splitLines(value: string): string[] {
  return value
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function ResumeReview({
  resume,
  extractMode,
  isSample = false,
  onChange,
  onConfirm,
  onBack,
}: {
  resume: CandidateResume;
  extractMode: "gemini" | "heuristic";
  isSample?: boolean;
  onChange: (resume: CandidateResume) => void;
  onConfirm: () => void;
  onBack: () => void;
}) {
  function patch(partial: Partial<CandidateResume>) {
    onChange({ ...resume, ...partial });
  }

  function patchJob(index: number, partial: Partial<ResumeJob>) {
    const experience = resume.experience.map((job, i) => (i === index ? { ...job, ...partial } : job));
    patch({ experience });
  }

  const canConfirm = resume.candidate.trim().length >= 2 && (resume.skills.length > 0 || resume.experience.length > 0);

  return (
    <div className="composer no-print">
      <div className="folder-tab">Review resume</div>
      <div className="composer-head">
        <label>Correct extracted JSON</label>
        <span className="hint">
          {isSample
            ? "Sample candidate · you confirm"
            : extractMode === "gemini"
              ? "Gemini extract · you confirm"
              : "Heuristic extract · you confirm"}
        </span>
      </div>
      <p className="form-note">
        Matching uses this structured resume, not the original file. Fix names, bullets, and skills before generating a
        packet.
      </p>

      <div className="review-grid">
        <label>
          Name
          <input value={resume.candidate} onChange={(e) => patch({ candidate: e.target.value })} />
        </label>
        <label>
          Headline
          <input value={resume.headline} onChange={(e) => patch({ headline: e.target.value })} />
        </label>
        <label>
          Location
          <input value={resume.location} onChange={(e) => patch({ location: e.target.value })} />
        </label>
        <label>
          Years of experience
          <input
            type="number"
            min={0}
            max={50}
            value={resume.yearsExperience}
            onChange={(e) => patch({ yearsExperience: Number(e.target.value) || 0 })}
          />
        </label>
        <label>
          Email
          <input value={resume.email} onChange={(e) => patch({ email: e.target.value })} />
        </label>
        <label>
          Phone
          <input value={resume.phone} onChange={(e) => patch({ phone: e.target.value })} />
        </label>
        <label>
          LinkedIn
          <input value={resume.linkedin} onChange={(e) => patch({ linkedin: e.target.value })} />
        </label>
        <label>
          GitHub
          <input value={resume.github} onChange={(e) => patch({ github: e.target.value })} />
        </label>
      </div>

      <label className="stack-field">
        Skills (comma or line separated)
        <textarea
          rows={3}
          value={resume.skills.join(", ")}
          onChange={(e) => patch({ skills: splitLines(e.target.value) })}
        />
      </label>

      <div className="job-list">
        {resume.experience.map((job, index) => (
          <fieldset key={`${job.company}-${index}`} className="job-block">
            <legend>
              Role {index + 1}
              <button type="button" className="btn-tiny" onClick={() => patch({ experience: resume.experience.filter((_, i) => i !== index) })}>
                Remove
              </button>
            </legend>
            <div className="review-grid">
              <label>
                Company
                <input value={job.company} onChange={(e) => patchJob(index, { company: e.target.value })} />
              </label>
              <label>
                Title
                <input value={job.role} onChange={(e) => patchJob(index, { role: e.target.value })} />
              </label>
              <label>
                Start
                <input value={job.start} onChange={(e) => patchJob(index, { start: e.target.value })} />
              </label>
              <label>
                End
                <input value={job.end} onChange={(e) => patchJob(index, { end: e.target.value })} />
              </label>
            </div>
            <label className="stack-field">
              Evidence bullets (one per line)
              <textarea
                rows={4}
                value={joinLines(job.evidence)}
                onChange={(e) =>
                  patchJob(index, {
                    evidence: e.target.value
                      .split("\n")
                      .map((line) => line.trim())
                      .filter(Boolean),
                  })
                }
              />
            </label>
          </fieldset>
        ))}
      </div>

      <button
        type="button"
        className="btn-tiny"
        onClick={() => patch({ experience: [...resume.experience, emptyJob()] })}
      >
        Add role
      </button>

      <label className="stack-field">
        Education
        <textarea rows={2} value={joinLines(resume.education)} onChange={(e) => patch({ education: splitLines(e.target.value) })} />
      </label>
      <label className="stack-field">
        Certifications
        <textarea
          rows={2}
          value={joinLines(resume.certifications)}
          onChange={(e) => patch({ certifications: splitLines(e.target.value) })}
        />
      </label>
      <label className="stack-field">
        Projects (one per line)
        <textarea
          rows={2}
          value={resume.projects.map((p) => p.name).join("\n")}
          onChange={(e) =>
            patch({
              projects: splitLines(e.target.value).map((name) => {
                const existing = resume.projects.find((p) => p.name === name);
                return existing ?? { name, summary: "", tech: [] };
              }),
            })
          }
        />
      </label>

      <div className="composer-actions">
        <button type="button" className="btn-primary" onClick={onConfirm} disabled={!canConfirm}>
          Use this resume
        </button>
        <button type="button" className="btn-ghost" onClick={onBack}>
          Choose another
        </button>
      </div>
    </div>
  );
}
