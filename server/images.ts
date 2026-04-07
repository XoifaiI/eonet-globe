import { Router, type Response } from "express"
import multer from "multer"
import crypto from "crypto"
import { read, write } from "./db.js"
import { requireAuth, type AuthRequest } from "./auth.js"
import { uploadProcessedImage, promoteFromQuarantine, downloadImage, deleteImage } from "./storage.js"
import { processImage, moderateImage } from "./image-pipeline.js"

type ImageStatus = "processing" | "approved" | "rejected"

interface ImageRecord {
  id: string
  eventId: string
  userId: string
  username: string
  filename: string
  originalName: string
  caption: string
  width: number
  height: number
  size: number
  compressedSize: number
  status: ImageStatus
  moderationRating: number | null
  createdAt: string
}

interface ImageStore {
  byEvent: Record<string, string[]>
  byDate: string[]
  records: Record<string, ImageRecord>
}

const MAX_UPLOAD_SIZE = 10 * 1024 * 1024
const MAX_FILES_PER_UPLOAD = 1
const ENABLE_MODERATION = process.env.ENABLE_MODERATION !== "false"

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_UPLOAD_SIZE,
    files: MAX_FILES_PER_UPLOAD,
    fields: 5,
    fieldSize: 1024,
  },
  fileFilter: (_req, file, cb) => {
    const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"])
    if (ALLOWED.has(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error("Only JPEG, PNG, and WebP images are allowed"))
    }
  },
})

const router = Router()

async function getStore(): Promise<ImageStore> {
  const store = await read<ImageStore>("images-v2", { byEvent: {}, byDate: [], records: {} })
  if (!store.byEvent) store.byEvent = {}
  if (!store.byDate) store.byDate = []
  if (!store.records) store.records = {}
  return store
}

async function saveStore(store: ImageStore): Promise<void> {
  await write("images-v2", store)
}

function param(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] : value ?? ""
}

function validateEventId(eventId: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(eventId) && eventId.length < 200
}

function sanitizeCaption(input: unknown): string {
  if (typeof input !== "string") return ""
  return input.slice(0, 500).replace(/[<>&"']/g, "").trim()
}

function publicRecord(record: ImageRecord) {
  return {
    id: record.id,
    eventId: record.eventId,
    userId: record.userId,
    username: record.username,
    filename: record.filename,
    originalName: record.originalName,
    caption: record.caption,
    width: record.width,
    height: record.height,
    status: record.status,
    createdAt: record.createdAt,
  }
}

router.get("/:eventId", async (req: AuthRequest, res: Response) => {
  const eventId = param(req.params.eventId)
  if (!validateEventId(eventId)) {
    res.status(400).json({ error: "Invalid event ID" })
    return
  }

  const store = await getStore()
  const ids = store.byEvent[eventId] || []
  const images = ids
    .map((id: string) => store.records[id])
    .filter((r): r is ImageRecord => !!r && r.status === "approved")
    .map(publicRecord)

  res.setHeader("Cache-Control", "public, max-age=30")
  res.json(images)
})

router.get("/file/:filename", async (req: AuthRequest, res: Response) => {
  const filename = param(req.params.filename)
  if (!/^[a-f0-9-]+\.webp$/i.test(filename)) {
    res.status(400).end()
    return
  }

  const store = await getStore()
  const record = Object.values(store.records).find((r) => r.filename === filename)
  if (!record || record.status !== "approved") {
    res.status(404).end()
    return
  }

  const variant = (req.query.v === "thumb" ? "thumbnail" : req.query.v === "original" ? "original" : "medium") as "thumbnail" | "medium" | "original"

  try {
    const buffer = await downloadImage(filename, variant)

    res.setHeader("Content-Type", "image/webp")
    res.setHeader("Content-Length", buffer.length)
    res.setHeader("X-Content-Type-Options", "nosniff")
    res.setHeader("Content-Security-Policy", "default-src 'none'; img-src 'self'")
    res.setHeader("Content-Disposition", "inline")
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable")
    res.send(buffer)
  } catch {
    res.status(404).end()
  }
})

router.post(
  "/:eventId",
  requireAuth,
  upload.single("image"),
  async (req: AuthRequest, res: Response) => {
    const eventId = param(req.params.eventId)
    if (!validateEventId(eventId)) {
      res.status(400).json({ error: "Invalid event ID" })
      return
    }

    if (!req.file) {
      res.status(400).json({ error: "No image file provided" })
      return
    }

    const origin = req.headers.origin || ""
    if (origin) {
      const allowed = new Set([
        "http://localhost:5173",
        "http://localhost:4173",
        process.env.CORS_ORIGIN || "",
      ].filter(Boolean))
      try {
        if (!allowed.has(new URL(origin).origin)) {
          res.status(403).json({ error: "Invalid origin" })
          return
        }
      } catch {
        res.status(403).json({ error: "Invalid origin" })
        return
      }
    }

    try {
      const processed = await processImage(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype
      )

      const { sizes, compressedSizes } = await uploadProcessedImage(processed, true)

      const record: ImageRecord = {
        id: crypto.randomUUID(),
        eventId,
        userId: req.userId!,
        username: req.username!,
        filename: processed.filename,
        originalName: req.file.originalname.slice(0, 200),
        caption: sanitizeCaption(req.body.caption),
        width: processed.width,
        height: processed.height,
        size: sizes.original,
        compressedSize: compressedSizes.original,
        status: "processing",
        moderationRating: null,
        createdAt: new Date().toISOString(),
      }

      const store = await getStore()
      store.records[record.id] = record
      if (!store.byEvent[eventId]) store.byEvent[eventId] = []
      store.byEvent[eventId].push(record.id)
      store.byDate.push(record.id)
      await saveStore(store)

      runModeration(record, processed.original).catch((err) =>
        console.error("Moderation failed for", record.id, err)
      )

      res.status(201).json(publicRecord(record))
    } catch (err) {
      console.error("Upload processing failed:", err)
      res.status(400).json({
        error: err instanceof Error ? err.message : "Upload processing failed",
      })
    }
  }
)

async function runModeration(record: ImageRecord, imageBuffer: Buffer) {
  if (!ENABLE_MODERATION) {
    await promoteFromQuarantine(record.filename)
    const store = await getStore()
    const current = store.records[record.id]
    if (!current) return
    current.status = "approved"
    current.moderationRating = 1
    await saveStore(store)
    return
  }

  const result = await moderateImage(imageBuffer)

  const store = await getStore()
  const current = store.records[record.id]
  if (!current) return

  current.moderationRating = result.flags.length

  if (result.safe) {
    await promoteFromQuarantine(record.filename)
    current.status = "approved"
    await saveStore(store)
    console.log(`Image ${record.id} approved`)
  } else {
    current.status = "rejected"
    await saveStore(store)
    await deleteImage(record.filename)
    console.log(`Image ${record.id} rejected: ${result.flags.join(", ")}`)
  }
}

export async function getExpiredImages(maxAgeDays: number): Promise<Array<{ id: string; filename: string; eventId: string }>> {
  const MS_PER_DAY = 86_400_000
  const cutoff = Date.now() - maxAgeDays * MS_PER_DAY
  const store = await getStore()
  const expired: Array<{ id: string; filename: string; eventId: string }> = []

  for (const id of store.byDate) {
    const record = store.records[id]
    if (!record) continue
    if (new Date(record.createdAt).getTime() >= cutoff) break
    expired.push({ id: record.id, filename: record.filename, eventId: record.eventId })
  }

  return expired
}

export async function removeImageRecords(ids: string[]) {
  if (ids.length === 0) return
  const store = await getStore()
  const idSet = new Set(ids)

  for (const id of ids) {
    const record = store.records[id]
    if (record) {
      const eventIds = store.byEvent[record.eventId]
      if (eventIds) {
        store.byEvent[record.eventId] = eventIds.filter((i: string) => i !== id)
        if (store.byEvent[record.eventId].length === 0) delete store.byEvent[record.eventId]
      }
      delete store.records[id]
    }
  }

  store.byDate = store.byDate.filter((id: string) => !idSet.has(id))
  await saveStore(store)
}

export default router
