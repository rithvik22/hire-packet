"use client";

import { ChangeEvent, DragEvent, useRef, useState } from "react";
import type { CandidateResume } from "@/lib/types";

export function ResumeIntake({
  busy,
  onParsed,
  onSample,
}: {
  busy: boolean;
  onParsed: (resume: CandidateResume, mode: "gemini" | "heuristic") => void;
  onSample: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  async function parseFile(file: File) {
    setError(null);
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/resume/parse", { method: "POST", body, signal: AbortSignal.timeout(45000) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not read that resume.");
      onParsed(data.resume as CandidateResume, data.mode === "gemini" ? "gemini" : "heuristic");
    } catch (err) {
      const timedOut =
        (err instanceof DOMException && err.name === "TimeoutError") ||
        (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError"));
      setError(
        timedOut
          ? "That took too long. Try again, or use the sample candidate."
          : err instanceof Error
            ? err.message
            : "Could not read that resume."
      );
    } finally {
      setUploading(false);
    }
  }

  function onInput(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) void parseFile(file);
    event.target.value = "";
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragOver(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void parseFile(file);
  }

  const blocked = busy || uploading;

  return (
    <div className="composer no-print">
      <div className="folder-tab">Resume intake</div>
      <div className="composer-head">
        <label htmlFor="resume-file">Upload PDF or DOCX</label>
        <span className="hint">4 MB max · text only · not stored</span>
      </div>
      <div
        className={`dropzone${dragOver ? " dropzone-over" : ""}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        <p>
          Drop a resume here, or{" "}
          <button
            type="button"
            className="linkish"
            onClick={(event) => {
              event.stopPropagation();
              inputRef.current?.click();
            }}
            disabled={blocked}
          >
            browse
          </button>
        </p>
        <p className="muted">PDF and DOCX only. The file is parsed in memory and discarded.</p>
        <input
          ref={inputRef}
          id="resume-file"
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={onInput}
          disabled={blocked}
          hidden
        />
      </div>
      {uploading ? (
        <p className="form-note">Reading the file. If Gemini is slow, a local extract you can edit will appear in a few seconds.</p>
      ) : null}
      {error ? (
        <div className="form-error" role="alert">
          <p>{error}</p>
        </div>
      ) : null}
      <div className="composer-actions">
        <button type="button" className="btn-ghost" onClick={onSample} disabled={blocked}>
          Try sample candidate
        </button>
      </div>
    </div>
  );
}
