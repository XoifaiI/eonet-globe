import "server-only";
import { Storage } from "@google-cloud/storage";
import crypto from "crypto";
import zstd from "zstd-napi";
import type { ProcessedImage } from "./image-pipeline";
import { DEFAULT_GCS_BUCKET } from "./constants";

const BUCKET_NAME = process.env.GCS_BUCKET || DEFAULT_GCS_BUCKET;
const ZSTD_LEVEL = 10;

const storage = new Storage(
  process.env.GCS_KEY_FILE
    ? { keyFilename: process.env.GCS_KEY_FILE }
    : undefined,
);

const bucket = storage.bucket(BUCKET_NAME);

interface StorageResult {
  paths: { original: string; medium: string; thumbnail: string };
  sizes: { original: number; medium: number; thumbnail: number };
  compressedSizes: { original: number; medium: number; thumbnail: number };
}

async function uploadBuffer(
  gcsPath: string,
  buffer: Buffer,
  contentType: string,
): Promise<number> {
  const compressed = zstd.compress(buffer, { compressionLevel: ZSTD_LEVEL });
  const file = bucket.file(gcsPath);
  await file.save(compressed, {
    metadata: {
      contentEncoding: "zstd",
      contentType,
      metadata: { originalSize: String(buffer.length) },
    },
    resumable: false,
  });
  return compressed.length;
}

export async function uploadProcessedImage(
  image: ProcessedImage,
  quarantine = true,
): Promise<StorageResult> {
  const prefix = quarantine ? "quarantine" : "images";
  const base = `${prefix}/${image.filename}`;

  const [origComp, medComp, thumbComp] = await Promise.all([
    uploadBuffer(`${base}/original.webp.zst`, image.original, "image/webp"),
    uploadBuffer(`${base}/medium.webp.zst`, image.medium, "image/webp"),
    uploadBuffer(`${base}/thumbnail.webp.zst`, image.thumbnail, "image/webp"),
  ]);

  return {
    paths: {
      original: `${base}/original.webp.zst`,
      medium: `${base}/medium.webp.zst`,
      thumbnail: `${base}/thumbnail.webp.zst`,
    },
    sizes: {
      original: image.original.length,
      medium: image.medium.length,
      thumbnail: image.thumbnail.length,
    },
    compressedSizes: {
      original: origComp,
      medium: medComp,
      thumbnail: thumbComp,
    },
  };
}

export async function promoteFromQuarantine(filename: string): Promise<void> {
  const variants = [
    "original.webp.zst",
    "medium.webp.zst",
    "thumbnail.webp.zst",
  ];
  await Promise.all(
    variants.map((v) =>
      bucket
        .file(`quarantine/${filename}/${v}`)
        .move(`images/${filename}/${v}`),
    ),
  );
}

const IMAGE_CACHE_MAX_BYTES =
  Number(process.env.IMAGE_CACHE_MAX_MB || 128) * 1024 * 1024;
const imageCache = new Map<
  string,
  { buffer: Buffer; etag: string; accessedAt: number }
>();
let cacheBytes = 0;

function evictCache() {
  if (cacheBytes <= IMAGE_CACHE_MAX_BYTES) return;
  const entries = [...imageCache.entries()].sort(
    (a, b) => a[1].accessedAt - b[1].accessedAt,
  );
  for (const [key, entry] of entries) {
    if (cacheBytes <= IMAGE_CACHE_MAX_BYTES) break;
    cacheBytes -= entry.buffer.length;
    imageCache.delete(key);
  }
}

export async function downloadImage(
  filename: string,
  variant: "original" | "medium" | "thumbnail" = "medium",
): Promise<{ buffer: Buffer; etag: string }> {
  const cacheKey = `${filename}:${variant}`;
  const cached = imageCache.get(cacheKey);
  if (cached) {
    cached.accessedAt = Date.now();
    return { buffer: cached.buffer, etag: cached.etag };
  }

  const gcsPath = `images/${filename}/${variant}.webp.zst`;
  const [compressed] = await bucket.file(gcsPath).download();
  const buffer = zstd.decompress(compressed);
  const etag = `"${crypto.createHash("sha256").update(buffer).digest("hex")}"`;

  cacheBytes += buffer.length;
  imageCache.set(cacheKey, { buffer, etag, accessedAt: Date.now() });
  evictCache();

  return { buffer, etag };
}

export async function getSignedUrl(
  filename: string,
  variant: "original" | "medium" | "thumbnail" = "medium",
  expiresInMinutes = 60,
): Promise<string> {
  const gcsPath = `images/${filename}/${variant}.webp.zst`;
  const [url] = await bucket.file(gcsPath).getSignedUrl({
    action: "read",
    expires: Date.now() + expiresInMinutes * 60 * 1000,
    responseDisposition: "inline",
    responseType: "image/webp",
  });
  return url;
}

export async function deleteImage(filename: string): Promise<void> {
  const variants = [
    "original.webp.zst",
    "medium.webp.zst",
    "thumbnail.webp.zst",
  ];
  const prefixes = ["images", "quarantine"];

  await Promise.allSettled(
    prefixes.flatMap((prefix) =>
      variants.map((v) => bucket.file(`${prefix}/${filename}/${v}`).delete()),
    ),
  );
}

export async function deleteImages(filenames: string[]): Promise<void> {
  const BATCH = 5;
  for (let i = 0; i < filenames.length; i += BATCH) {
    const batch = filenames.slice(i, i + BATCH);
    await Promise.allSettled(batch.map((f) => deleteImage(f)));
  }
}
