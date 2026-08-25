"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { LogoMark } from "@/components/LogoMark";

export function SiteHeader({ extra, tone = "light" }: { extra?: ReactNode; tone?: "light" | "dark" }) {
  return (
    <header className={`topbar no-print topbar-${tone}`}>
      <Link className="wordmark" href="/">
        <LogoMark />
        <span>
          <em>Hire Packet</em>
          <small>Evidence before the decision</small>
        </span>
      </Link>
      <nav className="top-links">
        {extra}
        <Link href="/packet">One packet</Link>
        <Link className="nav-cta" href="/compare">
          Compare<span className="nav-full"> slate</span>
        </Link>
      </nav>
    </header>
  );
}
