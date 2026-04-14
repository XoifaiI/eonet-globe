import "server-only";
import crypto from "crypto";
import { retryAsync } from "./retry-async";

export interface CachedResponse {
  data: unknown;
  etag: string;
  fetchedAt: number;
}

const EONET_OPEN =
  "https://eonet.gsfc.nasa.gov/api/v3/events?status=open&days=90";
const EONET_RECENT =
  "https://eonet.gsfc.nasa.gov/api/v3/events?status=all&days=30";
export const EONET_TTL_MS = 5 * 60 * 1000;
export const EONET_STALE_TTL_MS = 30 * 60 * 1000;

let cache: CachedResponse | null = null;
let fetchPromise: Promise<void> | null = null;

async function fetchOne(
  url: string,
): Promise<{ events: Array<Record<string, unknown>> } | null> {
  try {
    return await retryAsync(
      async () => {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`EONET ${res.status}`);
        return res.json();
      },
      {
        maxAttempts: 3,
        pauseBase: 2,
        pauseExponent: 2,
        onFailure: (attempt, max, err) =>
          console.warn(`EONET fetch attempt ${attempt}/${max} failed:`, err),
      },
    );
  } catch {
    return null;
  }
}

export async function refreshEonetCache(): Promise<void> {
  if (fetchPromise) return fetchPromise;

  fetchPromise = (async () => {
    try {
      const openData = await fetchOne(EONET_OPEN);
      await new Promise((r) => setTimeout(r, 1000));
      const recentData = await fetchOne(EONET_RECENT);

      if (!openData && !recentData) return;

      const seen = new Set<string>();
      const merged: Array<Record<string, unknown>> = [];

      for (const data of [openData, recentData]) {
        if (!data) continue;
        for (const event of data.events) {
          const id = event.id as string;
          if (!seen.has(id)) {
            seen.add(id);
            merged.push(event);
          }
        }
      }

      const data = { events: merged };
      const etag = `"${crypto.createHash("sha256").update(JSON.stringify(data)).digest("hex")}"`;
      cache = { data, etag, fetchedAt: Date.now() };
    } finally {
      fetchPromise = null;
    }
  })();

  return fetchPromise;
}

export function getEonetCache(): CachedResponse | null {
  return cache;
}
