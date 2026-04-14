import "server-only";
import { readPath, modifyJson } from "./db";

export type ImageStatus = "processing" | "approved" | "rejected";

export interface ImageRecord {
  id: string;
  eventId: string;
  userId: string;
  username: string;
  filename: string;
  originalName: string;
  caption: string;
  width: number;
  height: number;
  size: number;
  compressedSize: number;
  status: ImageStatus;
  moderationRating: number | null;
  createdAt: string;
}

export interface ImageStore {
  byEvent: Record<string, string[]>;
  byDate: string[];
  records: Record<string, ImageRecord>;
}

export const STORE_PATH = "meta/images-v2.json";
export const EMPTY_STORE: ImageStore = {
  byEvent: {},
  byDate: [],
  records: {},
};

export async function getStore(): Promise<ImageStore> {
  const store = await readPath<ImageStore>(STORE_PATH, EMPTY_STORE);
  if (!store.byEvent) store.byEvent = {};
  if (!store.byDate) store.byDate = [];
  if (!store.records) store.records = {};
  return store;
}

export function publicRecord(record: ImageRecord) {
  return {
    id: record.id,
    eventId: record.eventId,
    userId: record.userId,
    username: record.username,
    filename: record.filename,
    originalName: record.originalName,
    caption: record.caption,
    width: record.width,
    height: record.height,
    status: record.status,
    createdAt: record.createdAt,
  };
}

export async function insertImageRecord(record: ImageRecord): Promise<void> {
  await modifyJson<ImageStore>(STORE_PATH, EMPTY_STORE, (store) => {
    if (!store.byEvent) store.byEvent = {};
    if (!store.byDate) store.byDate = [];
    if (!store.records) store.records = {};

    store.records[record.id] = record;
    if (!store.byEvent[record.eventId]) store.byEvent[record.eventId] = [];
    store.byEvent[record.eventId].push(record.id);
    store.byDate.push(record.id);
    return store;
  });
}

export async function getExpiredImages(
  maxAgeDays: number,
): Promise<Array<{ id: string; filename: string; eventId: string }>> {
  const MS_PER_DAY = 86_400_000;
  const cutoff = Date.now() - maxAgeDays * MS_PER_DAY;
  const store = await getStore();
  const expired: Array<{ id: string; filename: string; eventId: string }> = [];

  for (const id of store.byDate) {
    const record = store.records[id];
    if (!record) continue;
    if (new Date(record.createdAt).getTime() >= cutoff) break;
    expired.push({
      id: record.id,
      filename: record.filename,
      eventId: record.eventId,
    });
  }

  return expired;
}

export async function removeImageRecords(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const idSet = new Set(ids);

  await modifyJson<ImageStore>(STORE_PATH, EMPTY_STORE, (store) => {
    for (const id of ids) {
      const record = store.records[id];
      if (record) {
        const eventIds = store.byEvent[record.eventId];
        if (eventIds) {
          store.byEvent[record.eventId] = eventIds.filter(
            (i: string) => i !== id,
          );
          if (store.byEvent[record.eventId].length === 0)
            delete store.byEvent[record.eventId];
        }
        delete store.records[id];
      }
    }

    store.byDate = store.byDate.filter((id: string) => !idSet.has(id));
    return store;
  });
}
