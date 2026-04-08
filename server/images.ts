import { Router, type Response } from "express";
import multer from "multer";
import crypto from "crypto";
import { readPath, modifyJson } from "./db.js";

function jsonEtag(data: unknown): string {
  const json = JSON.stringify(data);
  return `"${crypto.createHash("sha256").update(json).digest("hex")}"`;
}
import { requireAuth, type AuthRequest } from "./auth.js";
import { uploadProcessedImage, downloadImage } from "./storage.js";
import {
  processImage,
  moderateImage,
  SAFE_VALIDATION_ERRORS,
} from "./image-pipeline.js";
import { containsDisallowedChars } from "./text-moderation.js";

type ImageStatus = "processing" | "approved" | "rejected";

interface ImageRecord {
  id: string;
  eventId: string;
  userId: string;
  username: string;
  filename: string;
  originalName: string;
  caption: string;
  width: number;
  height: number;
  size: number;
  compressedSize: number;
  status: ImageStatus;
  moderationRating: number | null;
  createdAt: string;
}

interface ImageStore {
  byEvent: Record<string, string[]>;
  byDate: string[];
  records: Record<string, ImageRecord>;
}

const STORE_PATH = "meta/images-v2.json";
const EMPTY_STORE: ImageStore = { byEvent: {}, byDate: [], records: {} };

const MAX_UPLOAD_SIZE = 10 * 1024 * 1024;
const MAX_FILES_PER_UPLOAD = 1;

const ENABLE_MODERATION = !["false", "0", "no"].includes(
  (process.env.ENABLE_MODERATION || "true").toLowerCase(),
);

if (!ENABLE_MODERATION) {
  console.warn(
    "WARNING: Image moderation is DISABLED via ENABLE_MODERATION env var",
  );
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_UPLOAD_SIZE,
    files: MAX_FILES_PER_UPLOAD,
    fields: 5,
    fieldSize: 1024,
  },
  fileFilter: (_req, file, cb) => {
    const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);
    if (ALLOWED.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPEG, PNG, and WebP images are allowed"));
    }
  },
});

const router = Router();

async function getStore(): Promise<ImageStore> {
  const store = await readPath<ImageStore>(STORE_PATH, EMPTY_STORE);
  if (!store.byEvent) store.byEvent = {};
  if (!store.byDate) store.byDate = [];
  if (!store.records) store.records = {};
  return store;
}

function param(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] : (value ?? "");
}

function validateEventId(eventId: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(eventId) && eventId.length < 200;
}

function sanitizeCaption(input: unknown): string {
  if (typeof input !== "string") return "";
  return input
    .slice(0, 500)
    .replace(/[<>&"']/g, "")
    .trim();
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
  };
}

router.get("/:eventId", async (req: AuthRequest, res: Response) => {
  const eventId = param(req.params.eventId);
  if (!validateEventId(eventId)) {
    res.status(400).json({ error: "Invalid event ID" });
    return;
  }

  const store = await getStore();
  const ids = store.byEvent[eventId] || [];
  const images = ids
    .map((id: string) => store.records[id])
    .filter((r): r is ImageRecord => !!r && r.status === "approved")
    .map(publicRecord);

  const etag = jsonEtag(images);
  if (req.headers["if-none-match"] === etag) {
    res.status(304).end();
    return;
  }

  res.setHeader(
    "Cache-Control",
    "public, max-age=30, stale-while-revalidate=60",
  );
  res.setHeader("ETag", etag);
  res.json(images);
});

router.get("/file/:filename", async (req: AuthRequest, res: Response) => {
  const filename = param(req.params.filename);
  if (!/^[a-f0-9-]+\.webp$/i.test(filename)) {
    res.status(400).end();
    return;
  }

  const store = await getStore();
  const record = Object.values(store.records).find(
    (r) => r.filename === filename,
  );
  if (!record || record.status !== "approved") {
    res.status(404).end();
    return;
  }

  const variant = (
    req.query.v === "thumb"
      ? "thumbnail"
      : req.query.v === "original"
        ? "original"
        : "medium"
  ) as "thumbnail" | "medium" | "original";

  try {
    const { buffer, etag } = await downloadImage(filename, variant);

    if (req.headers["if-none-match"] === etag) {
      res.status(304).end();
      return;
    }

    res.setHeader("Content-Type", "image/webp");
    res.setHeader("Content-Length", buffer.length);
    res.setHeader("ETag", etag);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'none'; img-src 'self'",
    );
    res.setHeader("Content-Disposition", "inline");
    res.setHeader(
      "Cache-Control",
      "public, max-age=86400, stale-while-revalidate=604800",
    );
    res.send(buffer);
  } catch {
    res.status(404).end();
  }
});

router.post(
  "/:eventId",
  requireAuth,
  upload.single("image"),
  async (req: AuthRequest, res: Response) => {
    const eventId = param(req.params.eventId);
    if (!validateEventId(eventId)) {
      res.status(400).json({ error: "Invalid event ID" });
      return;
    }

    if (!req.file) {
      res.status(400).json({ error: "No image file provided" });
      return;
    }

    const caption = sanitizeCaption(req.body.caption);
    if (caption && containsDisallowedChars(caption)) {
      res
        .status(400)
        .json({ error: "Only standard Latin characters are allowed" });
      return;
    }

    try {
      const processed = await processImage(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype,
      );

      if (ENABLE_MODERATION) {
        const moderation = await moderateImage(processed.original);
        if (!moderation.safe) {
          res
            .status(403)
            .json({ error: `Flagged for: ${moderation.flags.join(", ")}` });
          return;
        }
      }

      const { sizes, compressedSizes } = await uploadProcessedImage(
        processed,
        false,
      );

      const record: ImageRecord = {
        id: crypto.randomUUID(),
        eventId,
        userId: req.userId!,
        username: req.username!,
        filename: processed.filename,
        originalName: req.file.originalname.slice(0, 200),
        caption,
        width: processed.width,
        height: processed.height,
        size: sizes.original,
        compressedSize: compressedSizes.original,
        status: "approved",
        moderationRating: 0,
        createdAt: new Date().toISOString(),
      };

      await modifyJson<ImageStore>(STORE_PATH, EMPTY_STORE, (store) => {
        if (!store.byEvent) store.byEvent = {};
        if (!store.byDate) store.byDate = [];
        if (!store.records) store.records = {};

        store.records[record.id] = record;
        if (!store.byEvent[eventId]) store.byEvent[eventId] = [];
        store.byEvent[eventId].push(record.id);
        store.byDate.push(record.id);
        return store;
      });

      res.status(201).json(publicRecord(record));
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      res.status(400).json({
        error: SAFE_VALIDATION_ERRORS.has(message)
          ? message
          : "Image processing failed",
      });
    }
  },
);

export async function getExpiredImages(
  maxAgeDays: number,
): Promise<Array<{ id: string; filename: string; eventId: string }>> {
  const MS_PER_DAY = 86_400_000;
  const cutoff = Date.now() - maxAgeDays * MS_PER_DAY;
  const store = await getStore();
  const expired: Array<{ id: string; filename: string; eventId: string }> = [];

  for (const id of store.byDate) {
    const record = store.records[id];
    if (!record) continue;
    if (new Date(record.createdAt).getTime() >= cutoff) break;
    expired.push({
      id: record.id,
      filename: record.filename,
      eventId: record.eventId,
    });
  }

  return expired;
}

export async function removeImageRecords(ids: string[]) {
  if (ids.length === 0) return;
  const idSet = new Set(ids);

  await modifyJson<ImageStore>(STORE_PATH, EMPTY_STORE, (store) => {
    for (const id of ids) {
      const record = store.records[id];
      if (record) {
        const eventIds = store.byEvent[record.eventId];
        if (eventIds) {
          store.byEvent[record.eventId] = eventIds.filter(
            (i: string) => i !== id,
          );
          if (store.byEvent[record.eventId].length === 0)
            delete store.byEvent[record.eventId];
        }
        delete store.records[id];
      }
    }

    store.byDate = store.byDate.filter((id: string) => !idSet.has(id));
    return store;
  });
}

export default router;
