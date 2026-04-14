import crypto from "crypto";
import { authenticate, isAuthContext } from "@/lib/server/auth";
import { uploadProcessedImage } from "@/lib/server/storage";
import {
  processImage,
  moderateImage,
  SAFE_VALIDATION_ERRORS,
} from "@/lib/server/image-pipeline";
import { containsDisallowedChars } from "@/lib/server/text-moderation";
import {
  getStore,
  publicRecord,
  insertImageRecord,
  type ImageRecord,
} from "@/lib/server/images-store";
import { checkRateLimit } from "@/lib/server/rate-limit";
import { RATE_LIMITS } from "@/lib/server/constants";
import { checkContentLength, UPLOAD_BODY_MAX } from "@/lib/server/body-limits";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_UPLOAD_SIZE = 10 * 1024 * 1024;
const ALLOWED_MIMES = new Set(["image/jpeg", "image/png", "image/webp"]);

const ENABLE_MODERATION = !["false", "0", "no"].includes(
  (process.env.ENABLE_MODERATION || "true").toLowerCase(),
);

if (!ENABLE_MODERATION) {
  console.warn(
    "WARNING: Image moderation is DISABLED via ENABLE_MODERATION env var",
  );
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

function jsonEtag(data: unknown): string {
  const json = JSON.stringify(data);
  return `"${crypto.createHash("sha256").update(json).digest("hex")}"`;
}

export async function GET(
  request: Request,
  ctx: { params: Promise<{ eventId: string }> },
) {
  const { eventId } = await ctx.params;

  if (!validateEventId(eventId)) {
    return Response.json({ error: "Invalid event ID" }, { status: 400 });
  }

  const store = await getStore();
  const ids = store.byEvent[eventId] || [];
  const images = ids
    .map((id: string) => store.records[id])
    .filter((r): r is ImageRecord => !!r && r.status === "approved")
    .map(publicRecord);

  const etag = jsonEtag(images);
  if (request.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304 });
  }

  return Response.json(images, {
    headers: {
      "Cache-Control": "public, max-age=30, stale-while-revalidate=60",
      ETag: etag,
    },
  });
}

export async function POST(
  request: Request,
  ctx: { params: Promise<{ eventId: string }> },
) {
  const sizeError = checkContentLength(request, UPLOAD_BODY_MAX);
  if (sizeError) return sizeError;

  const auth = await authenticate(request);
  if (!isAuthContext(auth)) return auth;

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  const limit = checkRateLimit(
    `upload:${auth.userId || ip}`,
    RATE_LIMITS.upload,
  );
  if (!limit.allowed) {
    return Response.json(
      { error: "Upload limit reached" },
      { status: 429, headers: limit.headers },
    );
  }

  const { eventId } = await ctx.params;
  if (!validateEventId(eventId)) {
    return Response.json({ error: "Invalid event ID" }, { status: 400 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json({ error: "Invalid form data" }, { status: 400 });
  }

  const fileEntry = formData.get("image");
  if (!(fileEntry instanceof File)) {
    return Response.json({ error: "No image file provided" }, { status: 400 });
  }

  if (fileEntry.size > MAX_UPLOAD_SIZE) {
    return Response.json({ error: "File too large" }, { status: 400 });
  }

  if (!ALLOWED_MIMES.has(fileEntry.type)) {
    return Response.json(
      { error: "Only JPEG, PNG, and WebP images are allowed" },
      { status: 400 },
    );
  }

  const caption = sanitizeCaption(formData.get("caption"));
  if (caption && containsDisallowedChars(caption)) {
    return Response.json(
      { error: "Only standard Latin characters are allowed" },
      { status: 400 },
    );
  }

  try {
    const arrayBuffer = await fileEntry.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const processed = await processImage(
      buffer,
      fileEntry.name,
      fileEntry.type,
    );

    if (ENABLE_MODERATION) {
      const moderation = await moderateImage(processed.original);
      if (!moderation.safe) {
        return Response.json(
          { error: `Flagged for: ${moderation.flags.join(", ")}` },
          { status: 403 },
        );
      }
    }

    const { sizes, compressedSizes } = await uploadProcessedImage(
      processed,
      false,
    );

    const record: ImageRecord = {
      id: crypto.randomUUID(),
      eventId,
      userId: auth.userId,
      username: auth.username,
      filename: processed.filename,
      originalName: fileEntry.name.slice(0, 200),
      caption,
      width: processed.width,
      height: processed.height,
      size: sizes.original,
      compressedSize: compressedSizes.original,
      status: "approved",
      moderationRating: 0,
      createdAt: new Date().toISOString(),
    };

    await insertImageRecord(record);

    return Response.json(publicRecord(record), { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    return Response.json(
      {
        error: SAFE_VALIDATION_ERRORS.has(message)
          ? message
          : "Image processing failed",
      },
      { status: 400 },
    );
  }
}
