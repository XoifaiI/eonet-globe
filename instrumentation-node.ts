import { MS_PER_HOUR } from "@/lib/server/constants";
import {
  getExpiredImages,
  removeImageRecords,
} from "@/lib/server/images-store";
import { deleteImages } from "@/lib/server/storage";

const MAX_AGE_DAYS = Number(process.env.IMAGE_MAX_AGE_DAYS) || 60;
const CLEANUP_INTERVAL = 6 * MS_PER_HOUR;

async function runCleanup() {
  try {
    const expired = await getExpiredImages(MAX_AGE_DAYS);
    if (expired.length === 0) return;
    await deleteImages(expired.map((e) => e.filename));
    await removeImageRecords(expired.map((e) => e.id));
    console.log(
      `Cleanup: removed ${expired.length} images older than ${MAX_AGE_DAYS} days`,
    );
  } catch (err) {
    console.error("Cleanup failed:", err);
  }
}

runCleanup();
setInterval(runCleanup, CLEANUP_INTERVAL);
