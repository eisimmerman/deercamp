// src/lib/capture/uploadQueueState.ts
import {
  clearStaleFailedUploadQueueItems,
  getUploadQueue,
  type UploadQueueItem,
} from "@/lib/capture/uploadQueue";

export type UploadQueueTotals = {
  total: number;
  pending: number;
  uploading: number;
  uploaded: number;
  failed: number;
};

export function calculateUploadQueueTotals(
  items: UploadQueueItem[]
): UploadQueueTotals {
  return items.reduce(
    (totals, item) => {
      totals.total += 1;
      totals[item.status] += 1;
      return totals;
    },
    {
      total: 0,
      pending: 0,
      uploading: 0,
      uploaded: 0,
      failed: 0,
    } as UploadQueueTotals
  );
}

export async function getUploadQueueTotals() {
  await clearStaleFailedUploadQueueItems();
  const items = await getUploadQueue();
  return calculateUploadQueueTotals(items);
}

export function hasUploadQueueWork(totals: UploadQueueTotals) {
  return totals.pending > 0 || totals.uploading > 0 || totals.failed > 0;
}

export function getUploadQueueStatusLabel(totals: UploadQueueTotals) {
  if (totals.failed > 0) {
    return `${totals.failed} failed upload${totals.failed === 1 ? "" : "s"}`;
  }

  if (totals.uploading > 0) {
    return `${totals.uploading} uploading`;
  }

  if (totals.pending > 0) {
    return `${totals.pending} queued upload${totals.pending === 1 ? "" : "s"}`;
  }

  if (totals.uploaded > 0) {
    return "All uploads complete";
  }

  return "No uploads queued";
}