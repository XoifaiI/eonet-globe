import { authenticate, isAuthContext } from "@/lib/server/auth";
import {
  getSections,
  getSectionContent,
  createSection,
  approveRevision,
} from "@/lib/server/wiki-store";
import {
  moderateText,
  sanitizeWikiContent,
  sanitizeWikiTitle,
  containsDisallowedChars,
} from "@/lib/server/text-moderation";
import { checkRateLimit } from "@/lib/server/rate-limit";
import { RATE_LIMITS, WIKI_LIMITS } from "@/lib/server/constants";
import { checkContentLength, JSON_BODY_MAX } from "@/lib/server/body-limits";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function validateId(id: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(id) && id.length < 200;
}

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ eventId: string }> },
) {
  const { eventId } = await ctx.params;
  if (!validateId(eventId)) {
    return Response.json({ error: "Invalid event ID" }, { status: 400 });
  }

  const sections = await getSections(eventId);
  const result = await Promise.all(
    sections.map(async (section) => {
      const latest = await getSectionContent(eventId, section.id);
      return {
        ...section,
        content: latest?.content || "",
        authorName: latest?.authorName || "",
      };
    }),
  );

  return Response.json(result, {
    headers: { "Cache-Control": "public, max-age=15" },
  });
}

export async function POST(
  request: Request,
  ctx: { params: Promise<{ eventId: string }> },
) {
  const sizeError = checkContentLength(request, JSON_BODY_MAX);
  if (sizeError) return sizeError;

  const auth = await authenticate(request);
  if (!isAuthContext(auth)) return auth;

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  const limit = checkRateLimit(`wiki:${auth.userId || ip}`, RATE_LIMITS.wiki);
  if (!limit.allowed) {
    return Response.json(
      { error: "Too many wiki edits" },
      { status: 429, headers: limit.headers },
    );
  }

  const { eventId } = await ctx.params;
  if (!validateId(eventId)) {
    return Response.json({ error: "Invalid event ID" }, { status: 400 });
  }

  let body: { title?: unknown; content?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const title = sanitizeWikiTitle(body.title);
  const content = sanitizeWikiContent(body.content);

  if (
    !title ||
    title.length < WIKI_LIMITS.minTitleLength ||
    title.length > WIKI_LIMITS.maxTitleLength
  ) {
    return Response.json(
      { error: "Title must be 2 to 200 characters" },
      { status: 400 },
    );
  }

  if (
    !content ||
    content.length < WIKI_LIMITS.minContentLength ||
    content.length > WIKI_LIMITS.maxContentLength
  ) {
    return Response.json(
      { error: "Content must be 10 to 10,000 characters" },
      { status: 400 },
    );
  }

  if (containsDisallowedChars(title) || containsDisallowedChars(content)) {
    return Response.json(
      { error: "Only standard Latin characters are allowed" },
      { status: 400 },
    );
  }

  const sections = await getSections(eventId);
  if (sections.length >= WIKI_LIMITS.maxSectionsPerEvent) {
    return Response.json(
      { error: "Maximum 20 sections per event" },
      { status: 400 },
    );
  }

  const moderation = await moderateText(`${title}\n\n${content}`);
  if (!moderation.safe) {
    return Response.json(
      { error: `Flagged for: ${moderation.flags.join(", ")}` },
      { status: 403 },
    );
  }

  const { section, revision } = await createSection(
    eventId,
    title,
    content,
    auth.userId,
    auth.username,
  );

  await approveRevision(
    eventId,
    section.id,
    revision.id,
    moderation.toxicityScore,
    moderation.flags,
  );

  return Response.json({ section, revision }, { status: 201 });
}
