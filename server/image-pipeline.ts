import sharp from "sharp"
import crypto from "crypto"

const MAX_FILE_SIZE = 10 * 1024 * 1024
const MIN_FILE_SIZE = 1024
const MAX_PIXEL_BUDGET = 25_000_000
const MAX_DIMENSION = 8192
const MIN_DIMENSION = 10
const MAX_ASPECT_RATIO = 10
const THUMBNAIL_SIZE = 200
const MEDIUM_SIZE = 800
const ORIGINAL_MAX = 2000
const OUTPUT_QUALITY = 82
const TARGET_DPI = 72

const MAGIC_BYTES: Array<{ type: string; bytes: number[]; offset: number }> = [
  { type: "jpeg", bytes: [0xff, 0xd8, 0xff], offset: 0 },
  { type: "png", bytes: [0x89, 0x50, 0x4e, 0x47], offset: 0 },
  { type: "webp", bytes: [0x57, 0x45, 0x42, 0x50], offset: 8 },
]

const ALLOWED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"])
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"])

export interface ProcessedImage {
  original: Buffer
  medium: Buffer
  thumbnail: Buffer
  width: number
  height: number
  format: string
  filename: string
}

export interface ValidationResult {
  valid: boolean
  error?: string
}

export function validateExtension(filename: string): ValidationResult {
  const lower = filename.toLowerCase()

  if (lower.includes("\0")) {
    return { valid: false, error: "Filename contains null bytes" }
  }

  const parts = lower.split(".")
  const ext = "." + (parts.pop() || "")

  const dangerousExts = new Set([".php", ".exe", ".sh", ".bat", ".cmd", ".js", ".html", ".svg", ".xml"])
  if (parts.some((p) => dangerousExts.has("." + p))) {
    return { valid: false, error: "Filename contains dangerous extension" }
  }
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return { valid: false, error: `Extension ${ext} is not allowed` }
  }

  return { valid: true }
}

export function validateMimeType(mimeType: string): ValidationResult {
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    return { valid: false, error: `MIME type ${mimeType} is not allowed` }
  }
  return { valid: true }
}

export function validateFileSize(size: number): ValidationResult {
  if (size < MIN_FILE_SIZE) {
    return { valid: false, error: "File is suspiciously small" }
  }
  if (size > MAX_FILE_SIZE) {
    return { valid: false, error: `File exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit` }
  }
  return { valid: true }
}

export function validateMagicBytes(buffer: Buffer): ValidationResult {
  if (buffer.length < 12) {
    return { valid: false, error: "File too small to validate" }
  }

  const matched = MAGIC_BYTES.some(({ bytes, offset }) =>
    bytes.every((b, i) => buffer[offset + i] === b)
  )

  if (!matched) {
    return { valid: false, error: "File signature does not match any allowed image format" }
  }

  return { valid: true }
}

function validateDecompressionRatio(fileSize: number, width: number, height: number): ValidationResult {
  const uncompressedSize = width * height * 4
  const ratio = uncompressedSize / fileSize

  if (ratio > 500) {
    return { valid: false, error: "Suspected decompression bomb" }
  }

  return { valid: true }
}

export async function processImage(
  buffer: Buffer,
  originalFilename: string,
  mimeType: string
): Promise<ProcessedImage> {
  const extCheck = validateExtension(originalFilename)
  if (!extCheck.valid) throw new Error(extCheck.error)

  const mimeCheck = validateMimeType(mimeType)
  if (!mimeCheck.valid) throw new Error(mimeCheck.error)

  const sizeCheck = validateFileSize(buffer.length)
  if (!sizeCheck.valid) throw new Error(sizeCheck.error)

  const magicCheck = validateMagicBytes(buffer)
  if (!magicCheck.valid) throw new Error(magicCheck.error)

  const metadata = await sharp(buffer, { limitInputPixels: MAX_PIXEL_BUDGET }).metadata()

  if (!metadata.width || !metadata.height) {
    throw new Error("Could not read image dimensions")
  }

  if (metadata.width > MAX_DIMENSION || metadata.height > MAX_DIMENSION) {
    throw new Error(`Image dimensions exceed ${MAX_DIMENSION}px limit`)
  }

  if (metadata.width < MIN_DIMENSION || metadata.height < MIN_DIMENSION) {
    throw new Error(`Image dimensions below ${MIN_DIMENSION}px minimum`)
  }

  const pixelBudget = metadata.width * metadata.height
  if (pixelBudget > MAX_PIXEL_BUDGET) {
    throw new Error(`Image exceeds ${MAX_PIXEL_BUDGET} pixel budget`)
  }

  const aspectRatio = Math.max(metadata.width / metadata.height, metadata.height / metadata.width)
  if (aspectRatio > MAX_ASPECT_RATIO) {
    throw new Error("Image has extreme aspect ratio")
  }

  const decompCheck = validateDecompressionRatio(buffer.length, metadata.width, metadata.height)
  if (!decompCheck.valid) throw new Error(decompCheck.error)

  if (metadata.format === "svg" || metadata.format === "gif") {
    throw new Error("SVG and GIF files are not accepted")
  }

  const baseProcessor = sharp(buffer, { limitInputPixels: MAX_PIXEL_BUDGET })
    .rotate()
    .withMetadata({ density: TARGET_DPI })
    .removeAlpha()

  const original = await baseProcessor
    .clone()
    .resize(ORIGINAL_MAX, ORIGINAL_MAX, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: OUTPUT_QUALITY })
    .toBuffer()

  const medium = await baseProcessor
    .clone()
    .resize(MEDIUM_SIZE, MEDIUM_SIZE, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: OUTPUT_QUALITY })
    .toBuffer()

  const thumbnail = await baseProcessor
    .clone()
    .resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, { fit: "cover" })
    .webp({ quality: 75 })
    .toBuffer()

  const reprocessedMeta = await sharp(original).metadata()
  if (!reprocessedMeta.width || !reprocessedMeta.height) {
    throw new Error("Image re-encoding produced invalid output")
  }

  const filename = `${crypto.randomUUID()}.webp`

  return {
    original,
    medium,
    thumbnail,
    width: reprocessedMeta.width,
    height: reprocessedMeta.height,
    format: "webp",
    filename,
  }
}

const UNSAFE_THRESHOLD = new Set(["LIKELY", "VERY_LIKELY"])

let visionClient: InstanceType<typeof import("@google-cloud/vision").ImageAnnotatorClient> | null = null

async function getVisionClient() {
  if (!visionClient) {
    const { ImageAnnotatorClient } = await import("@google-cloud/vision")
    visionClient = new ImageAnnotatorClient()
  }
  return visionClient
}

export async function moderateImage(
  buffer: Buffer
): Promise<{ safe: boolean; flags: string[] }> {
  try {
    const client = await getVisionClient()

    const [result] = await client.safeSearchDetection({ image: { content: buffer } })
    const annotation = result.safeSearchAnnotation

    if (!annotation) {
      return { safe: true, flags: [] }
    }

    const flags: string[] = []
    const checks = {
      adult: annotation.adult,
      violence: annotation.violence,
      racy: annotation.racy,
    } as Record<string, string | null | undefined>

    for (const [category, likelihood] of Object.entries(checks)) {
      if (likelihood && UNSAFE_THRESHOLD.has(likelihood)) {
        flags.push(category)
      }
    }

    return { safe: flags.length === 0, flags }
  } catch (err) {
    console.error("Vision SafeSearch error:", err)
    return { safe: false, flags: ["moderation_error"] }
  }
}
