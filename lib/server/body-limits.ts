export const JSON_BODY_MAX = 1024 * 1024;
export const UPLOAD_BODY_MAX = 12 * 1024 * 1024;

export function checkContentLength(
  request: Request,
  max: number,
): Response | null {
  const header = request.headers.get("content-length");
  if (header === null) {
    return Response.json(
      { error: "Content-Length header required" },
      { status: 411 },
    );
  }
  const length = Number(header);
  if (!Number.isFinite(length) || length < 0) {
    return Response.json({ error: "Invalid Content-Length" }, { status: 400 });
  }
  if (length > max) {
    return Response.json({ error: "Payload too large" }, { status: 413 });
  }
  return null;
}
