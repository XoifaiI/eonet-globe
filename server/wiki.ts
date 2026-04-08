import { Router, type Response } from "express"
import { requireAuth, type AuthRequest } from "./auth.js"
import {
  getSections,
  getSectionContent,
  getRevisionHistory,
  createSection,
  editSection,
  revertSection,
  approveRevision,
} from "./wiki-store.js"
import { moderateText, sanitizeWikiContent, sanitizeWikiTitle, containsDisallowedChars } from "./text-moderation.js"

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
        content: latest?.content || "",
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

router.post("/:eventId", requireAuth, async (req: AuthRequest, res: Response) => {
  const eventId = param(req.params.eventId)
  if (!validateId(eventId)) {
    res.status(400).json({ error: "Invalid event ID" })
    return
  }

  const title = sanitizeWikiTitle(req.body.title)
  const content = sanitizeWikiContent(req.body.content)

  if (!title || title.length < 2 || title.length > 200) {
    res.status(400).json({ error: "Title must be 2 to 200 characters" })
    return
  }

  if (!content || content.length < 10 || content.length > 10_000) {
    res.status(400).json({ error: "Content must be 10 to 10,000 characters" })
    return
  }

  if (containsDisallowedChars(title) || containsDisallowedChars(content)) {
    res.status(400).json({ error: "Only standard Latin characters are allowed" })
    return
  }

  const sections = await getSections(eventId)
  if (sections.length >= 20) {
    res.status(400).json({ error: "Maximum 20 sections per event" })
    return
  }

  const moderation = await moderateText(`${title}\n\n${content}`)
  if (!moderation.safe) {
    res.status(403).json({ error: `Flagged for: ${moderation.flags.join(", ")}` })
    return
  }

  const { section, revision } = await createSection(
    eventId,
    title,
    content,
    req.userId!,
    req.username!
  )

  await approveRevision(eventId, section.id, revision.id, moderation.toxicityScore, moderation.flags)
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
  if (!content || content.length < 10 || content.length > 10_000) {
    res.status(400).json({ error: "Content must be 10 to 10,000 characters" })
    return
  }

  if (containsDisallowedChars(content)) {
    res.status(400).json({ error: "Only standard Latin characters are allowed" })
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

  const moderation = await moderateText(content)
  if (!moderation.safe) {
    res.status(403).json({ error: `Flagged for: ${moderation.flags.join(", ")}` })
    return
  }

  const revision = await editSection(
    eventId,
    sectionId,
    content,
    req.userId!,
    req.username!
  )

  await approveRevision(eventId, sectionId, revision.id, moderation.toxicityScore, moderation.flags)
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

    await approveRevision(eventId, sectionId, revision.id, 0, [])
    res.json({ revision })
  }
)

export default router
