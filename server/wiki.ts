import { Router, type Response } from "express"
import { requireAuth, type AuthRequest } from "./auth.js"
import {
  getSections,
  getSectionContent,
  getRevisionHistory,
  getRevision,
  createSection,
  editSection,
  revertSection,
  approveRevision,
  rejectRevision,
} from "./wiki-store.js"
import { moderateText, sanitizeWikiContent, sanitizeWikiTitle } from "./text-moderation.js"

const router = Router()

function param(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] : value ?? ""
}

function validateId(id: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(id) && id.length < 200
}

router.get("/:eventId", async (req: AuthRequest, res: Response) => {
  const eventId = param(req.params.eventId)
  if (!validateId(eventId)) {
    res.status(400).json({ error: "Invalid event ID" })
    return
  }

  const sections = await getSections(eventId)
  const result = await Promise.all(
    sections.map(async (section) => {
      const latest = await getSectionContent(eventId, section.id)
      return {
        ...section,
        content: latest?.status === "approved" ? latest.content : "",
        authorName: latest?.authorName || "",
      }
    })
  )

  res.setHeader("Cache-Control", "public, max-age=15")
  res.json(result)
})

router.get("/:eventId/:sectionId/history", async (req: AuthRequest, res: Response) => {
  const eventId = param(req.params.eventId)
  const sectionId = param(req.params.sectionId)
  if (!validateId(eventId) || !validateId(sectionId)) {
    res.status(400).json({ error: "Invalid ID" })
    return
  }

  const history = await getRevisionHistory(eventId, sectionId)
  const approved = history.filter((r) => r.status === "approved")
  res.json(approved)
})

router.get("/:eventId/:sectionId/revision/:revisionId/status", async (req: AuthRequest, res: Response) => {
  const eventId = param(req.params.eventId)
  const sectionId = param(req.params.sectionId)
  const revisionId = param(req.params.revisionId)
  if (!validateId(eventId) || !validateId(sectionId) || !validateId(revisionId)) {
    res.status(400).json({ error: "Invalid ID" })
    return
  }

  const revision = await getRevision(eventId, sectionId, revisionId)
  if (!revision) {
    res.status(404).json({ error: "Revision not found" })
    return
  }

  res.json({
    status: revision.status,
    moderationFlags: revision.moderationFlags,
    toxicityScore: revision.toxicityScore,
  })
})

router.post("/:eventId", requireAuth, async (req: AuthRequest, res: Response) => {
  const eventId = param(req.params.eventId)
  if (!validateId(eventId)) {
    res.status(400).json({ error: "Invalid event ID" })
    return
  }

  const title = sanitizeWikiTitle(req.body.title)
  const content = sanitizeWikiContent(req.body.content)

  if (!title || title.length < 2) {
    res.status(400).json({ error: "Title must be at least 2 characters" })
    return
  }

  if (!content || content.length < 10) {
    res.status(400).json({ error: "Content must be at least 10 characters" })
    return
  }

  const sections = await getSections(eventId)
  if (sections.length >= 20) {
    res.status(400).json({ error: "Maximum 20 sections per event" })
    return
  }

  const { section, revision } = await createSection(
    eventId,
    title,
    content,
    req.userId!,
    req.username!
  )

  runModeration(eventId, section.id, revision.id, `${title}\n\n${content}`).catch((err) =>
    console.error("Wiki moderation failed:", err)
  )

  res.status(201).json({ section, revision })
})

router.put("/:eventId/:sectionId", requireAuth, async (req: AuthRequest, res: Response) => {
  const eventId = param(req.params.eventId)
  const sectionId = param(req.params.sectionId)
  if (!validateId(eventId) || !validateId(sectionId)) {
    res.status(400).json({ error: "Invalid ID" })
    return
  }

  const content = sanitizeWikiContent(req.body.content)
  if (!content || content.length < 10) {
    res.status(400).json({ error: "Content must be at least 10 characters" })
    return
  }

  const sections = await getSections(eventId)
  if (!sections.find((s) => s.id === sectionId)) {
    res.status(404).json({ error: "Section not found" })
    return
  }

  const history = await getRevisionHistory(eventId, sectionId)
  if (history.length >= 100) {
    res.status(400).json({ error: "Maximum revision limit reached for this section" })
    return
  }

  const revision = await editSection(
    eventId,
    sectionId,
    content,
    req.userId!,
    req.username!
  )

  runModeration(eventId, sectionId, revision.id, content).catch((err) =>
    console.error("Wiki moderation failed:", err)
  )

  res.json({ revision })
})

router.post(
  "/:eventId/:sectionId/revert/:revisionId",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const eventId = param(req.params.eventId)
    const sectionId = param(req.params.sectionId)
    const revisionId = param(req.params.revisionId)
    if (!validateId(eventId) || !validateId(sectionId) || !validateId(revisionId)) {
      res.status(400).json({ error: "Invalid ID" })
      return
    }

    const history = await getRevisionHistory(eventId, sectionId)
    if (history.length >= 100) {
      res.status(400).json({ error: "Maximum revision limit reached" })
      return
    }

    const revision = await revertSection(
      eventId,
      sectionId,
      revisionId,
      req.userId!,
      req.username!
    )

    if (!revision) {
      res.status(404).json({ error: "Revision not found or not approved" })
      return
    }

    runModeration(eventId, sectionId, revision.id, revision.content).catch((err) =>
      console.error("Wiki moderation failed:", err)
    )

    res.json({ revision })
  }
)

const MODERATION_TIMEOUT = 30_000

async function runModeration(
  eventId: string,
  sectionId: string,
  revisionId: string,
  content: string
) {
  try {
    const result = await Promise.race([
      moderateText(content),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Moderation timeout")), MODERATION_TIMEOUT)
      ),
    ])

    if (result.safe) {
      await approveRevision(eventId, sectionId, revisionId, result.toxicityScore, result.flags)
      console.log(`Wiki revision ${revisionId} approved (score: ${result.toxicityScore.toFixed(2)})`)
    } else {
      await rejectRevision(eventId, sectionId, revisionId, result.toxicityScore, result.flags)
      console.log(`Wiki revision ${revisionId} rejected: ${result.flags.join(", ")}`)
    }
  } catch (err) {
    console.error(`Wiki moderation failed for ${revisionId}, auto-rejecting:`, err)
    await rejectRevision(eventId, sectionId, revisionId, 1, ["moderation_error"]).catch(() => {})
  }
}

export default router
