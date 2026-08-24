type Meta = Record<string, string | number | boolean | null>;

const BLOCKED = /email|phone|jd|resume|prompt|pitch|name|linkedin/i;

export function logEvent(event: string, meta: Meta = {}): void {
  const safe: Meta = {};
  for (const [key, value] of Object.entries(meta)) {
    if (BLOCKED.test(key)) continue;
    safe[key] = value;
  }
  console.info(JSON.stringify({ event, ...safe, t: Date.now() }));
}
