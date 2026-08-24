import type { HirePacketResult } from "@/lib/types";

export function encodePacket(packet: HirePacketResult): string {
  const json = JSON.stringify(packet);
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function decodePacket(token: string): HirePacketResult | null {
  try {
    const padded = token.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((token.length + 3) % 4);
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
    const json = new TextDecoder().decode(bytes);
    const parsed = JSON.parse(json) as HirePacketResult;
    if (!parsed || typeof parsed.fitScore !== "number" || !Array.isArray(parsed.requirements)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

const SHARE_TTL_MS = 24 * 60 * 60 * 1000;

type ShareRecord = {
  packet: HirePacketResult;
  expiresAt: number;
};

const globalForShares = globalThis as typeof globalThis & {
  hirePacketShares?: Map<string, ShareRecord>;
};

const shares = globalForShares.hirePacketShares ?? new Map<string, ShareRecord>();
globalForShares.hirePacketShares = shares;

function prune(now = Date.now()) {
  for (const [slug, rec] of shares) {
    if (rec.expiresAt <= now) shares.delete(slug);
  }
}

export function putShare(slug: string, packet: HirePacketResult): { slug: string; expiresAt: number } {
  prune();
  let key = slug;
  let i = 2;
  while (shares.has(key) && i < 20) {
    key = `${slug}-${i}`;
    i += 1;
  }
  const expiresAt = Date.now() + SHARE_TTL_MS;
  shares.set(key, { packet: { ...packet, slug: key, sharePath: `/rithvik/${key}` }, expiresAt });
  return { slug: key, expiresAt };
}

export function getShare(slug: string): HirePacketResult | null {
  prune();
  const rec = shares.get(slug);
  if (!rec) return null;
  return rec.packet;
}
