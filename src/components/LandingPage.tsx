"use client";

import Link from "next/link";
import { candidate } from "@/data/candidate";
import { SiteHeader } from "@/components/SiteHeader";

export function LandingPage() {
  return (
    <div className="desk desk-home">
      <div className="shell">
        <SiteHeader tone="dark" />
        <main className="home-hero">
          <div className="home-copy">
            <p className="home-badge">Recruiter software · not an ATS</p>
            <h1>
              See who fits the job.
              <em>See the proof.</em>
            </h1>
            <p className="home-lede">
              Paste a JD. Drop resumes. Every score is calculated in code, and every strong match cites a real
              bullet. You shortlist. The model never rejects anyone.
            </p>
            <div className="home-actions">
              <Link className="btn-primary btn-lg" href="/compare">
                Compare a slate
              </Link>
              <Link className="btn-ghost btn-lg btn-ghost-dark" href="/packet">
                One hire packet
              </Link>
            </div>
            <ul className="home-points">
              <li>Score in TypeScript, not the model</li>
              <li>No evidence → cannot be a strong match</li>
              <li>Shortlist, review, or hold — your call</li>
            </ul>
          </div>

          <div className="home-preview" aria-hidden>
            <div className="preview-bar">
              <span>Full-Stack Engineer</span>
              <span>5 candidates</span>
            </div>
            <table className="preview-table">
              <thead>
                <tr>
                  <th>Candidate</th>
                  <th>Score</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <b>Maya Chen</b>
                    <small>12 strong · 1 gap</small>
                  </td>
                  <td>
                    <span className="preview-score high">91</span>
                  </td>
                  <td>
                    <span className="pill pill-go">Shortlist</span>
                  </td>
                </tr>
                <tr>
                  <td>
                    <b>Rithvik Velapati</b>
                    <small>10 strong · 2 gaps</small>
                  </td>
                  <td>
                    <span className="preview-score high">87</span>
                  </td>
                  <td>
                    <span className="pill pill-mid">Review</span>
                  </td>
                </tr>
                <tr>
                  <td>
                    <b>Sam Okonkwo</b>
                    <small>9 strong · 3 gaps</small>
                  </td>
                  <td>
                    <span className="preview-score mid">74</span>
                  </td>
                  <td>
                    <span className="pill pill-mid">Review</span>
                  </td>
                </tr>
                <tr>
                  <td>
                    <b>Jordan Pike</b>
                    <small>4 strong · 8 gaps</small>
                  </td>
                  <td>
                    <span className="preview-score low">38</span>
                  </td>
                  <td>
                    <span className="pill">Hold</span>
                  </td>
                </tr>
              </tbody>
            </table>
            <p className="preview-caption">Open a row to read the evidence. Status is set by the recruiter.</p>
          </div>
        </main>
        <footer className="home-foot">
          <span>{candidate.name}</span>
          <a href={`mailto:${candidate.email}`}>{candidate.email}</a>
        </footer>
      </div>
    </div>
  );
}
