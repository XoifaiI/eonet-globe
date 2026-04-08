import crypto from "crypto";
import { readPath, writePath, modifyJson } from "./db.js";

export interface WikiSection {
  id: string;
  eventId: string;
  title: string;
  latestRevisionId: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface WikiRevision {
  id: string;
  sectionId: string;
  eventId: string;
  content: string;
  authorId: string;
  authorName: string;
  status: "pending" | "approved" | "rejected";
  toxicityScore: number | null;
  moderationFlags: string[];
  createdAt: string;
  action: "create" | "edit" | "revert";
  revertedFrom: string | null;
}

export interface WikiSectionWithContent extends WikiSection {
  content: string;
  authorName: string;
}

const ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

function validateStoreId(id: string, label: string): void {
  if (!id || !ID_PATTERN.test(id) || id.length > 200) {
    throw new Error(`Invalid ${label}`);
  }
}

function sectionsPath(eventId: string) {
  return `meta/wiki/${eventId}/sections.json`;
}

function latestPath(eventId: string, sectionId: string) {
  return `meta/wiki/${eventId}/${sectionId}/latest.json`;
}

function revisionPath(eventId: string, sectionId: string, revisionId: string) {
  return `meta/wiki/${eventId}/${sectionId}/revisions/${revisionId}.json`;
}

function revisionsIndexPath(eventId: string, sectionId: string) {
  return `meta/wiki/${eventId}/${sectionId}/revisions/_index.json`;
}

export async function getSections(eventId: string): Promise<WikiSection[]> {
  validateStoreId(eventId, "eventId");
  return readPath<WikiSection[]>(sectionsPath(eventId), []);
}

export async function getSectionContent(
  eventId: string,
  sectionId: string,
): Promise<WikiRevision | null> {
  validateStoreId(eventId, "eventId");
  validateStoreId(sectionId, "sectionId");
  return readPath<WikiRevision | null>(latestPath(eventId, sectionId), null);
}

export async function getRevisionHistory(
  eventId: string,
  sectionId: string,
): Promise<WikiRevision[]> {
  validateStoreId(eventId, "eventId");
  validateStoreId(sectionId, "sectionId");
  return readPath<WikiRevision[]>(revisionsIndexPath(eventId, sectionId), []);
}

export async function getRevision(
  eventId: string,
  sectionId: string,
  revisionId: string,
): Promise<WikiRevision | null> {
  validateStoreId(eventId, "eventId");
  validateStoreId(sectionId, "sectionId");
  validateStoreId(revisionId, "revisionId");
  return readPath<WikiRevision | null>(
    revisionPath(eventId, sectionId, revisionId),
    null,
  );
}

export async function createSection(
  eventId: string,
  title: string,
  content: string,
  authorId: string,
  authorName: string,
): Promise<{ section: WikiSection; revision: WikiRevision }> {
  validateStoreId(eventId, "eventId");

  const sectionId = crypto.randomUUID();
  const revisionId = crypto.randomUUID();
  const now = new Date().toISOString();

  const revision: WikiRevision = {
    id: revisionId,
    sectionId,
    eventId,
    content,
    authorId,
    authorName,
    status: "pending",
    toxicityScore: null,
    moderationFlags: [],
    createdAt: now,
    action: "create",
    revertedFrom: null,
  };

  const section: WikiSection = {
    id: sectionId,
    eventId,
    title,
    latestRevisionId: revisionId,
    createdBy: authorId,
    createdAt: now,
    updatedAt: now,
  };

  await writePath(revisionPath(eventId, sectionId, revisionId), revision);
  await writePath(revisionsIndexPath(eventId, sectionId), [revision]);
  await writePath(latestPath(eventId, sectionId), revision);

  await modifyJson<WikiSection[]>(sectionsPath(eventId), [], (sections) => [
    ...sections,
    section,
  ]);

  return { section, revision };
}

export async function editSection(
  eventId: string,
  sectionId: string,
  content: string,
  authorId: string,
  authorName: string,
): Promise<WikiRevision> {
  validateStoreId(eventId, "eventId");
  validateStoreId(sectionId, "sectionId");

  const revisionId = crypto.randomUUID();
  const now = new Date().toISOString();

  const revision: WikiRevision = {
    id: revisionId,
    sectionId,
    eventId,
    content,
    authorId,
    authorName,
    status: "pending",
    toxicityScore: null,
    moderationFlags: [],
    createdAt: now,
    action: "edit",
    revertedFrom: null,
  };

  await writePath(revisionPath(eventId, sectionId, revisionId), revision);

  await modifyJson<WikiRevision[]>(
    revisionsIndexPath(eventId, sectionId),
    [],
    (history) => [...history, revision],
  );

  return revision;
}

export async function approveRevision(
  eventId: string,
  sectionId: string,
  revisionId: string,
  toxicityScore: number,
  flags: string[] = [],
): Promise<void> {
  validateStoreId(eventId, "eventId");
  validateStoreId(sectionId, "sectionId");
  validateStoreId(revisionId, "revisionId");

  const revision = await getRevision(eventId, sectionId, revisionId);
  if (!revision) return;

  revision.status = "approved";
  revision.toxicityScore = toxicityScore;
  revision.moderationFlags = flags;

  await writePath(revisionPath(eventId, sectionId, revisionId), revision);
  await writePath(latestPath(eventId, sectionId), revision);

  await modifyJson<WikiRevision[]>(
    revisionsIndexPath(eventId, sectionId),
    [],
    (history) => history.map((r) => (r.id === revisionId ? revision : r)),
  );

  await modifyJson<WikiSection[]>(sectionsPath(eventId), [], (sections) =>
    sections.map((s) =>
      s.id === sectionId
        ? { ...s, latestRevisionId: revisionId, updatedAt: revision.createdAt }
        : s,
    ),
  );
}

export async function revertSection(
  eventId: string,
  sectionId: string,
  targetRevisionId: string,
  authorId: string,
  authorName: string,
): Promise<WikiRevision | null> {
  validateStoreId(eventId, "eventId");
  validateStoreId(sectionId, "sectionId");
  validateStoreId(targetRevisionId, "revisionId");

  const target = await getRevision(eventId, sectionId, targetRevisionId);
  if (!target || target.status !== "approved") return null;

  const revisionId = crypto.randomUUID();
  const now = new Date().toISOString();

  const revision: WikiRevision = {
    id: revisionId,
    sectionId,
    eventId,
    content: target.content,
    authorId,
    authorName,
    status: "pending",
    toxicityScore: null,
    moderationFlags: [],
    createdAt: now,
    action: "revert",
    revertedFrom: targetRevisionId,
  };

  await writePath(revisionPath(eventId, sectionId, revisionId), revision);

  await modifyJson<WikiRevision[]>(
    revisionsIndexPath(eventId, sectionId),
    [],
    (history) => [...history, revision],
  );

  return revision;
}
