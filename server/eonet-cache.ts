import { Router, type Request, type Response } from "express"
import crypto from "crypto"

interface CachedResponse {
  data: unknown
  etag: string
  fetchedAt: number
}

const EONET_OPEN = "https://eonet.gsfc.nasa.gov/api/v3/events?status=open&days=90"
const EONET_RECENT = "https://eonet.gsfc.nasa.gov/api/v3/events?status=all&days=30"
const TTL = 5 * 60 * 1000
const STALE_TTL = 30 * 60 * 1000

let cache: CachedResponse | null = null
let fetchPromise: Promise<void> | null = null

async function fetchOne(url: string): Promise<{ events: Array<Record<string, unknown>> } | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url)
      if (res.ok) return res.json()
      if (res.status === 503 && attempt < 2) {
        await new Promise((r) => setTimeout(r, 4000 * (attempt + 1)))
        continue
      }
      return null
    } catch {
      if (attempt < 2) await new Promise((r) => setTimeout(r, 4000))
    }
  }
  return null
}

async function refreshCache(): Promise<void> {
  if (fetchPromise) return fetchPromise

  fetchPromise = (async () => {
    try {
      const openData = await fetchOne(EONET_OPEN)
      await new Promise((r) => setTimeout(r, 1000))
      const recentData = await fetchOne(EONET_RECENT)

      if (!openData && !recentData) return

      const seen = new Set<string>()
      const merged: Array<Record<string, unknown>> = []

      for (const data of [openData, recentData]) {
        if (!data) continue
        for (const event of data.events) {
          const id = event.id as string
          if (!seen.has(id)) {
            seen.add(id)
            merged.push(event)
          }
        }
      }

      const data = { events: merged }
      const etag = `"${crypto.createHash("sha256").update(JSON.stringify(data)).digest("hex")}"`
      cache = { data, etag, fetchedAt: Date.now() }
    } finally {
      fetchPromise = null
    }
  })()

  return fetchPromise
}

const router = Router()

router.get("/events", async (_req: Request, res: Response) => {
  const now = Date.now()

  if (cache && now - cache.fetchedAt < TTL) {
    res.setHeader("X-Cache", "hit")
    res.setHeader("Cache-Control", `public, max-age=${Math.floor(TTL / 1000)}`)
    res.json(cache.data)
    return
  }

  if (cache && now - cache.fetchedAt < STALE_TTL) {
    res.setHeader("X-Cache", "stale")
    res.setHeader("Cache-Control", "public, max-age=60")
    res.json(cache.data)
    refreshCache().catch(() => {})
    return
  }

  try {
    await refreshCache()
    if (cache) {
      res.setHeader("X-Cache", "miss")
      res.setHeader("Cache-Control", `public, max-age=${Math.floor(TTL / 1000)}`)
      res.json(cache.data)
    } else {
      res.status(502).json({ error: "EONET API unavailable" })
    }
  } catch {
    res.status(502).json({ error: "Failed to fetch EONET data" })
  }
})

export default router
