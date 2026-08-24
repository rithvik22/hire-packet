type Bucket = { hits: number[]; };

const buckets = new Map<string, Bucket>();

export function isRateLimited(ip: string, max = 12, windowMs = 10 * 60 * 1000): boolean {
  const now = Date.now();
  const bucket = buckets.get(ip) ?? { hits: [] };
  bucket.hits = bucket.hits.filter((t) => now - t < windowMs);
  if (bucket.hits.length >= max) {
    buckets.set(ip, bucket);
    return true;
  }
  bucket.hits.push(now);
  buckets.set(ip, bucket);
  return false;
}

export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip") || "unknown";
}
