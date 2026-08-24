"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { candidate } from "@/data/candidate";

export function SiteHeader({ extra }: { extra?: ReactNode }) {
  return (
    <header className="topbar no-print">
      <Link className="wordmark" href="/">
        <span className="mark" aria-hidden />
        <span>
          <em>Hire Packet</em>
          <small>Velapati brief</small>
        </span>
      </Link>
      <nav className="top-links">
        {extra}
        <a href={candidate.portfolio} target="_blank" rel="noreferrer">
          Portfolio
        </a>
        <a href={candidate.linkedin} target="_blank" rel="noreferrer">
          LinkedIn
        </a>
        <a href={candidate.github} target="_blank" rel="noreferrer">
          GitHub
        </a>
      </nav>
    </header>
  );
}
