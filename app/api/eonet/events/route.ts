import {
  EONET_STALE_TTL_MS,
  EONET_TTL_MS,
  getEonetCache,
  refreshEonetCache,
} from "@/lib/server/eonet-cache";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const now = Date.now();
  const cache = getEonetCache();

  if (cache && now - cache.fetchedAt < EONET_TTL_MS) {
    return Response.json(cache.data, {
      headers: {
        "X-Cache": "hit",
        "Cache-Control": `public, max-age=${Math.floor(EONET_TTL_MS / 1000)}`,
      },
    });
  }

  if (cache && now - cache.fetchedAt < EONET_STALE_TTL_MS) {
    refreshEonetCache().catch(() => {});
    return Response.json(cache.data, {
      headers: {
        "X-Cache": "stale",
        "Cache-Control": "public, max-age=60",
      },
    });
  }

  try {
    await refreshEonetCache();
    const fresh = getEonetCache();
    if (fresh) {
      return Response.json(fresh.data, {
        headers: {
          "X-Cache": "miss",
          "Cache-Control": `public, max-age=${Math.floor(EONET_TTL_MS / 1000)}`,
        },
      });
    }
    return Response.json({ error: "EONET API unavailable" }, { status: 502 });
  } catch {
    return Response.json(
      { error: "Failed to fetch EONET data" },
      { status: 502 },
    );
  }
}
