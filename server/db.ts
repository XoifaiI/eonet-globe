import { Storage } from "@google-cloud/storage"

const BUCKET_NAME = process.env.GCS_BUCKET || "eonet-globe-images"

const storage = new Storage(
  process.env.GCS_KEY_FILE
    ? { keyFilename: process.env.GCS_KEY_FILE }
    : undefined
)

const bucket = storage.bucket(BUCKET_NAME)
const cache = new Map<string, { data: unknown; ts: number }>()
const CACHE_TTL = 5000

export async function read<T>(name: string, fallback: T): Promise<T> {
  const cached = cache.get(name)
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return cached.data as T
  }

  try {
    const [contents] = await bucket.file(`meta/${name}.json`).download()
    const data = JSON.parse(contents.toString("utf-8")) as T
    cache.set(name, { data, ts: Date.now() })
    return data
  } catch {
    return fallback
  }
}

export async function write<T>(name: string, data: T): Promise<void> {
  cache.set(name, { data, ts: Date.now() })
  await bucket.file(`meta/${name}.json`).save(
    JSON.stringify(data),
    { resumable: false, contentType: "application/json" }
  )
}
