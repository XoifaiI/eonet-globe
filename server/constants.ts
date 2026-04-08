export const MS_PER_SECOND = 1000
export const MS_PER_HOUR = 3_600_000
export const MS_PER_DAY = 86_400_000

export const DEFAULT_GCS_BUCKET = "eonet-globe-images"
export const DEFAULT_PORT = 3001

export const DEV_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:4173",
]

export const MAX_EVENT_ID_LENGTH = 200
export const MAX_ID_LENGTH = 200

export const RATE_LIMITS = {
  api: { windowMs: 60 * MS_PER_SECOND, max: 60 },
  auth: { windowMs: 15 * 60 * MS_PER_SECOND, max: 20 },
  upload: { windowMs: 60 * MS_PER_SECOND, max: 5 },
  wiki: { windowMs: 60 * MS_PER_SECOND, max: 10 },
} as const

export const JSON_BODY_LIMIT = "1mb"

export const IMAGE_VALIDATION = {
  maxFileSize: 10 * 1024 * 1024,
  minFileSize: 1024,
  maxDimension: 8192,
  minDimension: 10,
  maxPixelBudget: 25_000_000,
  maxAspectRatio: 10,
  maxDecompressionRatio: 500,
  maxCaptionLength: 500,
  maxOriginalNameLength: 200,
} as const

export const WIKI_LIMITS = {
  maxSectionsPerEvent: 20,
  maxRevisionsPerSection: 100,
  minTitleLength: 2,
  minContentLength: 10,
  maxContentLength: 10_000,
  maxTitleLength: 200,
  moderationTimeoutMs: 30_000,
} as const

export const JWT_CONFIG = {
  minSecretLength: 32,
  expiry: "7d" as const,
  maxAge: "7d" as const,
  issuer: "eonet-globe",
  audience: "eonet-globe-client",
  maxCredentialLength: 4096,
  maxTokenLength: 2048,
  clockToleranceSeconds: 60,
  jtiByteLength: 16,
} as const

export const GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs"
