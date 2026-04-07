import { Router, type Response } from "express"
import multer from "multer"
import path from "path"
import { v4 as uuid } from "uuid"
import { read, write } from "./db.js"
import { requireAuth, type AuthRequest } from "./auth.js"

interface ImageRecord {
  id: string
  eventId: string
  userId: string
  username: string
  filename: string
  originalName: string
  caption: string
  createdAt: string
}

const UPLOAD_DIR = path.join(import.meta.dirname, "uploads")

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
])

const MAX_FILE_SIZE = 5 * 1024 * 1024

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    cb(null, `${uuid()}${ext}`)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error("Only JPEG, PNG, WebP, and GIF images are allowed"))
    }
  },
})

const router = Router()

function getImages(): ImageRecord[] {
  return read<ImageRecord[]>("images", [])
}

router.get("/:eventId", (req: AuthRequest, res: Response) => {
  const images = getImages().filter((img) => img.eventId === req.params.eventId)
  res.json(images)
})

router.post(
  "/:eventId",
  requireAuth,
  upload.single("image"),
  (req: AuthRequest, res: Response) => {
    if (!req.file) {
      res.status(400).json({ error: "No image file provided" })
      return
    }

    const caption = typeof req.body.caption === "string" ? req.body.caption.slice(0, 500) : ""

    const record: ImageRecord = {
      id: uuid(),
      eventId: req.params.eventId,
      userId: req.userId!,
      username: req.username!,
      filename: req.file.filename,
      originalName: req.file.originalname,
      caption,
      createdAt: new Date().toISOString(),
    }

    const images = getImages()
    images.push(record)
    write("images", images)

    res.status(201).json(record)
  }
)

export default router
