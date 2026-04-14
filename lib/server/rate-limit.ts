interface RateLimitConfig {
  readonly windowMs: number;
  readonly max: number;
}

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
const SWEEP_INTERVAL_MS = 60_000;
let lastSweep = Date.now();

function sweep(now: number) {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  headers: Record<string, string>;
}

export function checkRateLimit(
  key: string,
  config: RateLimitConfig,
): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const composite = `${key}:${config.windowMs}:${config.max}`;
  let bucket = buckets.get(composite);

  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + config.windowMs };
    buckets.set(composite, bucket);
  }

  bucket.count += 1;
  const allowed = bucket.count <= config.max;
  const remaining = Math.max(0, config.max - bucket.count);
  const resetSeconds = Math.ceil((bucket.resetAt - now) / 1000);

  const headers: Record<string, string> = {
    "RateLimit-Limit": String(config.max),
    "RateLimit-Remaining": String(remaining),
    "RateLimit-Reset": String(resetSeconds),
  };

  if (!allowed) {
    headers["Retry-After"] = String(resetSeconds);
  }

  return { allowed, remaining, resetAt: bucket.resetAt, headers };
}
