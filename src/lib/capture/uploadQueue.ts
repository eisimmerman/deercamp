// src/lib/capture/uploadQueue.ts
import AsyncStorage from "@react-native-async-storage/async-storage";

export type UploadQueueStatus = "pending" | "uploading" | "uploaded" | "failed";

export type UploadQueueItem = {
  id: string;
  memoryId: string;
  segmentId: string;
  segmentIndex: number;
  uri: string;
  mediaType: "audio" | "video" | "photo";
  status: UploadQueueStatus;
  createdAt: number;
  updatedAt: number;
  retryCount: number;
  lastError?: string;
  uploadedUrl?: string;
  campId?: string;
  authorId?: string;
};

const UPLOAD_QUEUE_KEY = "deercamp.uploadQueue.v1";

function normalizeQueueItem(item: any): UploadQueueItem {
  const now = Date.now();

  return {
    id: String(item?.id || ""),
    memoryId: String(item?.memoryId || ""),
    segmentId: String(item?.segmentId || ""),
    segmentIndex: Number(item?.segmentIndex || 0),
    uri: String(item?.uri || ""),
    mediaType:
      item?.mediaType === "video" || item?.mediaType === "photo"
        ? item.mediaType
        : "audio",
    status:
      item?.status === "uploading" ||
      item?.status === "uploaded" ||
      item?.status === "failed"
        ? item.status
        : "pending",
    createdAt: Number(item?.createdAt || now),
    updatedAt: Number(item?.updatedAt || now),
    retryCount: Number(item?.retryCount || 0),
    lastError: item?.lastError ? String(item.lastError) : undefined,
    uploadedUrl: item?.uploadedUrl ? String(item.uploadedUrl) : undefined,
    campId: item?.campId ? String(item.campId) : undefined,
    authorId: item?.authorId ? String(item.authorId) : undefined,
  };
}

async function readQueue(): Promise<UploadQueueItem[]> {
  try {
    const raw = await AsyncStorage.getItem(UPLOAD_QUEUE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(normalizeQueueItem) : [];
  } catch (error) {
    console.error("read upload queue failed:", error);
    return [];
  }
}

async function writeQueue(items: UploadQueueItem[]) {
  await AsyncStorage.setItem(UPLOAD_QUEUE_KEY, JSON.stringify(items));
}

export async function getUploadQueue() {
  return readQueue();
}

export async function getUploadQueueItemsForMemory(memoryId: string) {
  const cleanMemoryId = String(memoryId || "").trim();
  if (!cleanMemoryId) return [];

  const items = await readQueue();
  return items
    .filter((item) => item.memoryId === cleanMemoryId)
    .sort((a, b) => {
      if (a.mediaType === "photo" && b.mediaType !== "photo") return -1;
      if (a.mediaType !== "photo" && b.mediaType === "photo") return 1;
      return a.segmentIndex - b.segmentIndex;
    });
}

export async function getPendingUploadQueueItems(memoryId?: string) {
  const items = await readQueue();
  const cleanMemoryId = String(memoryId || "").trim();

  return items.filter((item) => {
    const statusMatches = item.status === "pending" || item.status === "failed";
    const memoryMatches = cleanMemoryId ? item.memoryId === cleanMemoryId : true;
    return statusMatches && memoryMatches;
  });
}

export async function enqueueUploadItem(
  item: Omit<UploadQueueItem, "status" | "createdAt" | "updatedAt" | "retryCount">
) {
  const now = Date.now();

  const normalized: UploadQueueItem = {
    ...item,
    status: "pending",
    createdAt: now,
    updatedAt: now,
    retryCount: 0,
  };

  const items = await readQueue();
  const next = [
    normalized,
    ...items.filter((existing) => existing.id !== normalized.id),
  ];

  await writeQueue(next);
  return normalized;
}

export async function enqueueUploadItems(
  items: Array<
    Omit<UploadQueueItem, "status" | "createdAt" | "updatedAt" | "retryCount">
  >
) {
  const now = Date.now();

  const normalizedItems: UploadQueueItem[] = items.map((item) => ({
    ...item,
    status: "pending",
    createdAt: now,
    updatedAt: now,
    retryCount: 0,
  }));

  const existing = await readQueue();
  const newIds = new Set(normalizedItems.map((item) => item.id));

  const next = [
    ...normalizedItems,
    ...existing.filter((item) => !newIds.has(item.id)),
  ];

  await writeQueue(next);
  return normalizedItems;
}

export async function updateUploadQueueItem(
  id: string,
  patch: Partial<UploadQueueItem>
) {
  const items = await readQueue();

  const next = items.map((item) =>
    item.id === id
      ? {
          ...item,
          ...patch,
          updatedAt: Date.now(),
        }
      : item
  );

  await writeQueue(next);
}

export async function markUploadItemUploading(id: string) {
  await updateUploadQueueItem(id, {
    status: "uploading",
    lastError: undefined,
  });
}

export async function markUploadItemUploaded(id: string, uploadedUrl: string) {
  await updateUploadQueueItem(id, {
    status: "uploaded",
    uploadedUrl,
    lastError: undefined,
  });
}

export async function markUploadItemFailed(id: string, message: string) {
  const items = await readQueue();
  const item = items.find((entry) => entry.id === id);
  const retryCount = (item?.retryCount || 0) + 1;

  await updateUploadQueueItem(id, {
    status: "failed",
    retryCount,
    lastError: String(message || "Upload failed.").trim() || "Upload failed.",
  });
}

export async function removeUploadQueueItem(id: string) {
  const items = await readQueue();
  await writeQueue(items.filter((item) => item.id !== id));
}

export async function removeUploadQueueItemsForMemory(memoryId: string) {
  const items = await readQueue();
  await writeQueue(items.filter((item) => item.memoryId !== memoryId));
}

export async function clearUploadedQueueItems() {
  const items = await readQueue();
  await writeQueue(items.filter((item) => item.status !== "uploaded"));
}
