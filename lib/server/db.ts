import "server-only";
import { Storage } from "@google-cloud/storage";
import { DEFAULT_GCS_BUCKET } from "./constants";

const BUCKET_NAME = process.env.GCS_BUCKET || DEFAULT_GCS_BUCKET;
const CACHE_TTL = 5000;
const MAX_RETRIES = 3;

const storage = new Storage(
  process.env.GCS_KEY_FILE
    ? { keyFilename: process.env.GCS_KEY_FILE }
    : undefined,
);

const bucket = storage.bucket(BUCKET_NAME);
const cache = new Map<
  string,
  { data: unknown; generation: number; ts: number }
>();

function gcsPath(name: string): string {
  return name.includes("/") ? name : `meta/${name}.json`;
}

function safeName(name: string): string {
  return name.slice(0, 64).replace(/[^a-zA-Z0-9_-]/g, "");
}

export async function read<T>(name: string, fallback: T): Promise<T> {
  name = safeName(name);
  const path = gcsPath(name);
  const cached = cache.get(path);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data as T;

  try {
    const file = bucket.file(path);
    const [metadata] = await file.getMetadata();
    const generation = Number(metadata.generation) || 0;
    const [contents] = await file.download();
    const data = JSON.parse(contents.toString("utf-8")) as T;
    cache.set(path, { data, generation, ts: Date.now() });
    return data;
  } catch {
    return fallback;
  }
}

export async function write<T>(name: string, data: T): Promise<void> {
  name = safeName(name);
  const path = gcsPath(name);
  const file = bucket.file(path);
  await file.save(JSON.stringify(data), {
    resumable: false,
    contentType: "application/json",
  });
  const [metadata] = await file.getMetadata();
  cache.set(path, {
    data,
    generation: Number(metadata.generation) || 0,
    ts: Date.now(),
  });
}

async function readWithGeneration<T>(
  path: string,
  fallback: T,
): Promise<{ data: T; generation: number }> {
  const cached = cache.get(path);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return { data: cached.data as T, generation: cached.generation };
  }

  try {
    const file = bucket.file(path);
    const [metadata] = await file.getMetadata();
    const generation = Number(metadata.generation) || 0;
    const [contents] = await file.download();
    const data = JSON.parse(contents.toString("utf-8")) as T;
    cache.set(path, { data, generation, ts: Date.now() });
    return { data, generation };
  } catch {
    return { data: fallback, generation: 0 };
  }
}

export async function readPath<T>(path: string, fallback: T): Promise<T> {
  const { data } = await readWithGeneration(path, fallback);
  return data;
}

export async function writePath<T>(path: string, data: T): Promise<void> {
  const file = bucket.file(path);
  await file.save(JSON.stringify(data), {
    resumable: false,
    contentType: "application/json",
  });
  const [metadata] = await file.getMetadata();
  cache.set(path, {
    data,
    generation: Number(metadata.generation) || 0,
    ts: Date.now(),
  });
}

export async function modifyJson<T>(
  path: string,
  fallback: T,
  modifier: (data: T) => T,
): Promise<T> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const { data, generation } = await readWithGeneration(path, fallback);
    const modified = modifier(data);
    const file = bucket.file(path);

    try {
      await file.save(JSON.stringify(modified), {
        resumable: false,
        contentType: "application/json",
        preconditionOpts:
          generation > 0
            ? { ifGenerationMatch: generation }
            : { ifGenerationMatch: 0 },
      });
      const [metadata] = await file.getMetadata();
      cache.set(path, {
        data: modified,
        generation: Number(metadata.generation) || 0,
        ts: Date.now(),
      });
      return modified;
    } catch (err: unknown) {
      const status = (err as { code?: number }).code;
      if (status === 412 && attempt < MAX_RETRIES - 1) {
        cache.delete(path);
        continue;
      }
      throw err;
    }
  }

  throw new Error(
    "Failed to write after retries due to concurrent modification conflict",
  );
}
