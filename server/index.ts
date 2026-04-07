import "dotenv/config"
import express from "express"
import cors from "cors"
import path from "path"
import rateLimit from "express-rate-limit"
import authRouter from "./auth.js"
import imagesRouter, { getExpiredImages, removeImageRecords } from "./images.js"
import eonetRouter from "./eonet-cache.js"
import { deleteImages } from "./storage.js"

const app = express()
const PORT = process.env.PORT || 3001
const MAX_AGE_DAYS = Number(process.env.IMAGE_MAX_AGE_DAYS) || 60
import { MS_PER_HOUR } from "./constants.js"

const CLEANUP_INTERVAL = 6 * MS_PER_HOUR
const IS_PROD = process.env.NODE_ENV === "production"

const ALLOWED_ORIGINS = new Set(
  [
    "http://localhost:5173",
    "http://localhost:4173",
    process.env.CORS_ORIGIN,
  ].filter(Boolean)
)

app.set("trust proxy", 1)

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || ALLOWED_ORIGINS.has(origin)) {
      callback(null, true)
    } else {
      callback(new Error("CORS not allowed"))
    }
  },
  credentials: true,
}))

app.use(express.json({ limit: "1mb" }))
app.disable("x-powered-by")

app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff")
  res.setHeader("X-Frame-Options", "DENY")
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin")
  next()
})

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, try again later" },
})

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many auth attempts" },
})

const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Upload limit reached, try again in a minute" },
})

app.use("/api", apiLimiter)
app.use("/api/auth", authLimiter)
app.use("/api/images/:eventId", (req, _res, next) => {
  if (req.method === "POST") return uploadLimiter(req, _res, next)
  next()
})

app.use("/api/auth", authRouter)
app.use("/api/images", imagesRouter)
app.use("/api/eonet", eonetRouter)

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", uptime: process.uptime() })
})

if (IS_PROD) {
  const distPath = path.join(import.meta.dirname, "..", "dist")
  app.use(express.static(distPath, { maxAge: "1y", immutable: true }))
  app.get("{*path}", (_req, res) => {
    res.sendFile(path.join(distPath, "index.html"))
  })
}

async function runCleanup() {
  try {
    const expired = await getExpiredImages(MAX_AGE_DAYS)
    if (expired.length === 0) return

    await deleteImages(expired.map((e) => e.filename))
    await removeImageRecords(expired.map((e) => e.id))

    console.log(`Cleanup: removed ${expired.length} images older than ${MAX_AGE_DAYS} days`)
  } catch (err) {
    console.error("Cleanup failed:", err)
  }
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
  runCleanup()
  setInterval(runCleanup, CLEANUP_INTERVAL)
})
