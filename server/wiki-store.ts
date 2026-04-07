import { Storage } from "@google-cloud/storage"
import crypto from "crypto"

const BUCKET_NAME = process.env.GCS_BUCKET || "eonet-globe-images"
const storage = new Storage(
  process.env.GCS_KEY_FILE ? { keyFilename: process.env.GCS_KEY_FILE } : undefined
)
const bucket = storage.bucket(BUCKET_NAME)

const cache = new globalThis.Map<string, { data: unknown; generation: number; ts: number }>()
const CACHE_TTL = 10_000
const MAX_RETRIES = 3

async function readJsonWithGeneration<T>(path: string, fallback: T): Promise<{ data: T; generation: number }> {
  const cached = cache.get(path)
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return { data: cached.data as T, generation: cached.generation }
  }

  try {
    const file = bucket.file(path)
    const [metadata] = await file.getMetadata()
    const generation = Number(metadata.generation) || 0
    const [contents] = await file.download()
    const data = JSON.parse(contents.toString("utf-8")) as T
    cache.set(path, { data, generation, ts: Date.now() })
    return { data, generation }
  } catch {
    return { data: fallback, generation: 0 }
  }
}

async function readJson<T>(path: string, fallback: T): Promise<T> {
  const { data } = await readJsonWithGeneration(path, fallback)
  return data
}

async function writeJson<T>(path: string, data: T): Promise<void> {
  const file = bucket.file(path)
  await file.save(JSON.stringify(data), {
    resumable: false,
    contentType: "application/json",
  })
  const [metadata] = await file.getMetadata()
  cache.set(path, { data, generation: Number(metadata.generation) || 0, ts: Date.now() })
}

async function modifyJson<T>(
  path: string,
  fallback: T,
  modifier: (data: T) => T
): Promise<T> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const { data, generation } = await readJsonWithGeneration(path, fallback)
    const modified = modifier(data)
    const file = bucket.file(path)

    try {
      await file.save(JSON.stringify(modified), {
        resumable: false,
        contentType: "application/json",
        preconditionOpts: generation > 0
          ? { ifGenerationMatch: generation }
          : { ifGenerationMatch: 0 },
      })
      const [metadata] = await file.getMetadata()
      cache.set(path, { data: modified, generation: Number(metadata.generation) || 0, ts: Date.now() })
      return modified
    } catch (err: unknown) {
      const status = (err as { code?: number }).code
      if (status === 412 && attempt < MAX_RETRIES - 1) {
        cache.delete(path)
        continue
      }
      throw err
    }
  }

  throw new Error("Failed to write after retries — concurrent modification conflict")
}

export interface WikiSection {
  id: string
  eventId: string
  title: string
  latestRevisionId: string
  createdBy: string
  createdAt: string
  updatedAt: string
}

export interface WikiRevision {
  id: string
  sectionId: string
  eventId: string
  content: string
  authorId: string
  authorName: string
  status: "pending" | "approved" | "rejected"
  toxicityScore: number | null
  createdAt: string
  action: "create" | "edit" | "revert"
  revertedFrom: string | null
}

export interface WikiSectionWithContent extends WikiSection {
  content: string
  authorName: string
}

function sectionsPath(eventId: string) {
  return `meta/wiki/${eventId}/sections.json`
}

function latestPath(eventId: string, sectionId: string) {
  return `meta/wiki/${eventId}/${sectionId}/latest.json`
}

function revisionPath(eventId: string, sectionId: string, revisionId: string) {
  return `meta/wiki/${eventId}/${sectionId}/revisions/${revisionId}.json`
}

function revisionsIndexPath(eventId: string, sectionId: string) {
  return `meta/wiki/${eventId}/${sectionId}/revisions/_index.json`
}

export async function getSections(eventId: string): Promise<WikiSection[]> {
  return readJson<WikiSection[]>(sectionsPath(eventId), [])
}

export async function getSectionContent(
  eventId: string,
  sectionId: string
): Promise<WikiRevision | null> {
  return readJson<WikiRevision | null>(latestPath(eventId, sectionId), null)
}

export async function getRevisionHistory(
  eventId: string,
  sectionId: string
): Promise<WikiRevision[]> {
  return readJson<WikiRevision[]>(revisionsIndexPath(eventId, sectionId), [])
}

export async function getRevision(
  eventId: string,
  sectionId: string,
  revisionId: string
): Promise<WikiRevision | null> {
  return readJson<WikiRevision | null>(revisionPath(eventId, sectionId, revisionId), null)
}

export async function createSection(
  eventId: string,
  title: string,
  content: string,
  authorId: string,
  authorName: string
): Promise<{ section: WikiSection; revision: WikiRevision }> {
  const sectionId = crypto.randomUUID()
  const revisionId = crypto.randomUUID()
  const now = new Date().toISOString()

  const revision: WikiRevision = {
    id: revisionId,
    sectionId,
    eventId,
    content,
    authorId,
    authorName,
    status: "pending",
    toxicityScore: null,
    createdAt: now,
    action: "create",
    revertedFrom: null,
  }

  const section: WikiSection = {
    id: sectionId,
    eventId,
    title,
    latestRevisionId: revisionId,
    createdBy: authorId,
    createdAt: now,
    updatedAt: now,
  }

  await writeJson(revisionPath(eventId, sectionId, revisionId), revision)
  await writeJson(revisionsIndexPath(eventId, sectionId), [revision])
  await writeJson(latestPath(eventId, sectionId), revision)

  await modifyJson<WikiSection[]>(sectionsPath(eventId), [], (sections) => [
    ...sections,
    section,
  ])

  return { section, revision }
}

export async function editSection(
  eventId: string,
  sectionId: string,
  content: string,
  authorId: string,
  authorName: string
): Promise<WikiRevision> {
  const revisionId = crypto.randomUUID()
  const now = new Date().toISOString()

  const revision: WikiRevision = {
    id: revisionId,
    sectionId,
    eventId,
    content,
    authorId,
    authorName,
    status: "pending",
    toxicityScore: null,
    createdAt: now,
    action: "edit",
    revertedFrom: null,
  }

  await writeJson(revisionPath(eventId, sectionId, revisionId), revision)

  await modifyJson<WikiRevision[]>(revisionsIndexPath(eventId, sectionId), [], (history) => [
    ...history,
    revision,
  ])

  return revision
}

export async function approveRevision(
  eventId: string,
  sectionId: string,
  revisionId: string,
  toxicityScore: number
): Promise<void> {
  const revision = await getRevision(eventId, sectionId, revisionId)
  if (!revision) return

  revision.status = "approved"
  revision.toxicityScore = toxicityScore

  await writeJson(revisionPath(eventId, sectionId, revisionId), revision)
  await writeJson(latestPath(eventId, sectionId), revision)

  await modifyJson<WikiRevision[]>(revisionsIndexPath(eventId, sectionId), [], (history) =>
    history.map((r) => (r.id === revisionId ? revision : r))
  )

  await modifyJson<WikiSection[]>(sectionsPath(eventId), [], (sections) =>
    sections.map((s) =>
      s.id === sectionId
        ? { ...s, latestRevisionId: revisionId, updatedAt: revision.createdAt }
        : s
    )
  )
}

export async function rejectRevision(
  eventId: string,
  sectionId: string,
  revisionId: string,
  toxicityScore: number
): Promise<void> {
  const revision = await getRevision(eventId, sectionId, revisionId)
  if (!revision) return

  revision.status = "rejected"
  revision.toxicityScore = toxicityScore

  await writeJson(revisionPath(eventId, sectionId, revisionId), revision)

  await modifyJson<WikiRevision[]>(revisionsIndexPath(eventId, sectionId), [], (history) =>
    history.map((r) => (r.id === revisionId ? revision : r))
  )
}

export async function revertSection(
  eventId: string,
  sectionId: string,
  targetRevisionId: string,
  authorId: string,
  authorName: string
): Promise<WikiRevision | null> {
  const target = await getRevision(eventId, sectionId, targetRevisionId)
  if (!target || target.status !== "approved") return null

  const revisionId = crypto.randomUUID()
  const now = new Date().toISOString()

  const revision: WikiRevision = {
    id: revisionId,
    sectionId,
    eventId,
    content: target.content,
    authorId,
    authorName,
    status: "pending",
    toxicityScore: null,
    createdAt: now,
    action: "revert",
    revertedFrom: targetRevisionId,
  }

  await writeJson(revisionPath(eventId, sectionId, revisionId), revision)

  await modifyJson<WikiRevision[]>(revisionsIndexPath(eventId, sectionId), [], (history) => [
    ...history,
    revision,
  ])

  return revision
}
