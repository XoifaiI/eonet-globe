import { authenticate, isAuthContext } from "@/lib/server/auth";
import {
  getRevisionHistory,
  revertSection,
  approveRevision,
} from "@/lib/server/wiki-store";
import { checkRateLimit } from "@/lib/server/rate-limit";
import { RATE_LIMITS, WIKI_LIMITS } from "@/lib/server/constants";
import { checkContentLength, JSON_BODY_MAX } from "@/lib/server/body-limits";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function validateId(id: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(id) && id.length < 200;
}

export async function POST(
  request: Request,
  ctx: {
    params: Promise<{
      eventId: string;
      sectionId: string;
      revisionId: string;
    }>;
  },
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

  const { eventId, sectionId, revisionId } = await ctx.params;
  if (
    !validateId(eventId) ||
    !validateId(sectionId) ||
    !validateId(revisionId)
  ) {
    return Response.json({ error: "Invalid ID" }, { status: 400 });
  }

  const history = await getRevisionHistory(eventId, sectionId);
  if (history.length >= WIKI_LIMITS.maxRevisionsPerSection) {
    return Response.json(
      { error: "Maximum revision limit reached" },
      { status: 400 },
    );
  }

  const revision = await revertSection(
    eventId,
    sectionId,
    revisionId,
    auth.userId,
    auth.username,
  );

  if (!revision) {
    return Response.json(
      { error: "Revision not found or not approved" },
      { status: 404 },
    );
  }

  await approveRevision(eventId, sectionId, revision.id, 0, []);
  return Response.json({ revision });
}
