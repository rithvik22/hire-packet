"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { PacketReport } from "@/components/PacketReport";
import { SiteHeader } from "@/components/SiteHeader";
import { decodePacket } from "@/lib/share";
import type { HirePacketResult } from "@/lib/types";

export function SharedPacketView() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const [packet, setPacket] = useState<HirePacketResult | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "missing">("loading");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const hash = window.location.hash.replace(/^#/, "");
      if (hash) {
        const fromHash = decodePacket(hash);
        if (fromHash && !cancelled) {
          setPacket(fromHash);
          setStatus("ready");
          return;
        }
      }

      try {
        const res = await fetch(`/api/share/${encodeURIComponent(slug)}`);
        if (!res.ok) throw new Error("missing");
        const data = (await res.json()) as HirePacketResult;
        if (!cancelled) {
          setPacket(data);
          setStatus("ready");
        }
      } catch {
        if (!cancelled) setStatus("missing");
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  return (
    <div className="desk">
      <div className="blotter">
        <SiteHeader extra={<Link href="/">Generate another</Link>} />

        {status === "loading" ? (
          <div className="collating">
            <p className="collating-kicker">Opening shared packet</p>
            <p className="dossier-name" style={{ fontSize: 28 }}>
              /p/{slug}
            </p>
          </div>
        ) : null}

        {status === "missing" ? (
          <div className="empty-packet">
            <h1>Link expired</h1>
            <p className="lede">
              Temporary shares live in memory and in the URL hash so the JD is never stored. Generate a
              new packet from the home page.
            </p>
            <Link className="btn-primary" href="/" style={{ display: "inline-block", textDecoration: "none" }}>
              Generate hire packet
            </Link>
          </div>
        ) : null}

        {status === "ready" && packet ? <PacketReport packet={packet} shareMode /> : null}
      </div>
    </div>
  );
}
