import { getRevisionHistory } from "@/lib/server/wiki-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function validateId(id: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(id) && id.length < 200;
}

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ eventId: string; sectionId: string }> },
) {
  const { eventId, sectionId } = await ctx.params;
  if (!validateId(eventId) || !validateId(sectionId)) {
    return Response.json({ error: "Invalid ID" }, { status: 400 });
  }

  const history = await getRevisionHistory(eventId, sectionId);
  const approved = history.filter((r) => r.status === "approved");
  return Response.json(approved);
}
