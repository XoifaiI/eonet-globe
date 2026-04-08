import "dotenv/config"
import express from "express"
import cors from "cors"
import path from "path"
import rateLimit from "express-rate-limit"
import { MS_PER_HOUR, DEFAULT_PORT, DEV_ORIGINS, RATE_LIMITS, JSON_BODY_LIMIT } from "./constants.js"
import authRouter from "./auth.js"
import type { AuthRequest } from "./auth.js"
import imagesRouter, { getExpiredImages, removeImageRecords } from "./images.js"
import eonetRouter from "./eonet-cache.js"
import wikiRouter from "./wiki.js"
import { deleteImages } from "./storage.js"

const app = express()
const PORT = process.env.PORT || DEFAULT_PORT
const MAX_AGE_DAYS = Number(process.env.IMAGE_MAX_AGE_DAYS) || 60
const CLEANUP_INTERVAL = 6 * MS_PER_HOUR
const IS_PROD = process.env.NODE_ENV === "production"

const ALLOWED_ORIGINS = new Set(
  [...DEV_ORIGINS, process.env.CORS_ORIGIN].filter(Boolean)
)

const trustProxy = process.env.TRUST_PROXY
if (trustProxy) {
  const parsed = Number(trustProxy)
  app.set("trust proxy", Number.isFinite(parsed) ? parsed : trustProxy)
}

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

app.use(express.json({ limit: JSON_BODY_LIMIT }))
app.disable("x-powered-by")

app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff")
  res.setHeader("X-Frame-Options", "DENY")
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin")
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups")
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
  if (IS_PROD) {
    res.setHeader("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload")
  }
  next()
})

const apiLimiter = rateLimit({ ...RATE_LIMITS.api, standardHeaders: true, legacyHeaders: false, message: { error: "Too many requests" } })
const authLimiter = rateLimit({ ...RATE_LIMITS.auth, standardHeaders: true, legacyHeaders: false, message: { error: "Too many auth attempts" } })
const uploadLimiter = rateLimit({
  ...RATE_LIMITS.upload,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Upload limit reached" },
  keyGenerator: (req) => (req as AuthRequest).userId || req.ip || "unknown",
})
const wikiWriteLimiter = rateLimit({
  ...RATE_LIMITS.wiki,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many wiki edits" },
  keyGenerator: (req) => (req as AuthRequest).userId || req.ip || "unknown",
})

app.use("/api", apiLimiter)
app.use("/api/auth", authLimiter)
app.use("/api/images/:eventId", (req, _res, next) => {
  if (req.method === "POST") return uploadLimiter(req, _res, next)
  next()
})
app.use("/api/wiki", (req, _res, next) => {
  if (req.method === "POST" || req.method === "PUT") return wikiWriteLimiter(req, _res, next)
  next()
})

app.use("/api/auth", authRouter)
app.use("/api/images", imagesRouter)
app.use("/api/eonet", eonetRouter)
app.use("/api/wiki", wikiRouter)

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", uptime: process.uptime() })
})

if (IS_PROD) {
  const distPath = path.join(import.meta.dirname, "..", "dist")

  app.use("/assets", express.static(path.join(distPath, "assets"), {
    maxAge: "1y",
    immutable: true,
  }))

  app.use(express.static(distPath, { maxAge: 0, index: false }))

  app.get("{*path}", (_req, res) => {
    res.setHeader("Cache-Control", "no-cache")
    res.setHeader("Content-Type", "text/html; charset=utf-8")
    res.setHeader(
      "Content-Security-Policy",
      [
        "default-src 'self'",
        "script-src 'self' blob: https://accounts.google.com",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob: https://basemaps.cartocdn.com https://server.arcgisonline.com https://s3.amazonaws.com",
        "connect-src 'self' https://accounts.google.com https://basemaps.cartocdn.com https://server.arcgisonline.com https://s3.amazonaws.com",
        "worker-src blob:",
        "frame-src https://accounts.google.com",
        "font-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
      ].join("; ")
    )
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
