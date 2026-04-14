import { downloadImage } from "@/lib/server/storage";
import { getStore } from "@/lib/server/images-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  request: Request,
  ctx: { params: Promise<{ filename: string }> },
) {
  const { filename } = await ctx.params;

  if (!/^[a-f0-9-]+\.webp$/i.test(filename)) {
    return new Response(null, { status: 400 });
  }

  const url = new URL(request.url);
  const variant = (
    url.searchParams.get("v") === "thumb"
      ? "thumbnail"
      : url.searchParams.get("v") === "original"
        ? "original"
        : "medium"
  ) as "thumbnail" | "medium" | "original";

  const store = await getStore();
  const record = Object.values(store.records).find(
    (r) => r.filename === filename,
  );
  if (!record || record.status !== "approved") {
    return new Response(null, { status: 404 });
  }

  try {
    const { buffer, etag } = await downloadImage(filename, variant);

    if (request.headers.get("if-none-match") === etag) {
      return new Response(null, { status: 304 });
    }

    const body = new Blob([new Uint8Array(buffer)], { type: "image/webp" });
    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "image/webp",
        "Content-Length": String(buffer.length),
        ETag: etag,
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; img-src 'self'",
        "Content-Disposition": "inline",
        "Cache-Control":
          "public, max-age=86400, stale-while-revalidate=604800",
      },
    });
  } catch {
    return new Response(null, { status: 404 });
  }
}
