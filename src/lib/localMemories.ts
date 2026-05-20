import AsyncStorage from "@react-native-async-storage/async-storage";

export type LocalMemorySegment = {
  id: string;
  memoryId: string;
  index: number;
  uri: string;
  mediaType: "audio" | "video";
  durationMs?: number;
  sizeBytes?: number;
  createdAt: number;
  syncStatus?: "pending" | "uploading" | "uploaded" | "failed";
  uploadUrl?: string;
  uploadError?: string;
  transcript?: string;
  transcriptionStatus?: "pending" | "complete" | "failed";
};

export type LocalMemoryItem = {
  id: string;
  title?: string;
  details?: string;
  clientCreatedAt: number;
  authorId: string;
  authorName?: string;

  photoUri?: string;
  photoUrl?: string;
  audioUri?: string;
  voiceUri?: string;
  voiceUrl?: string;
  videoUri?: string;
  videoUrl?: string;

  type?: "photo" | "text" | "voice" | "video" | "fieldMemory";

  syncStatus?: "pending" | "publishing" | "synced" | "failed";

  // Capture Engine V2
  captureVersion?: 1 | 2;
  isSegmented?: boolean;
  segmentCount?: number;
  totalDurationMs?: number;
  segments?: LocalMemorySegment[];
  parentMemoryTitle?: string;

  // Feed publish fields
  feedDocId?: string;
  publishedAt?: number;
  publishError?: string;
  campId?: string;

  // Cloud-generated metadata fields
  transcript?: string;
  transcriptPreview?: string;
  transcriptionStatus?: "pending" | "complete" | "failed";
  transcriptionError?: string;
  generatedTitle?: string;
  generatedCaption?: string;
  titleSource?: "manual" | "generated" | "fallback";
  captionSource?: "manual" | "generated" | "fallback";
};

const STORAGE_KEY = "deercamp.localMemories.v1";
const ACTIVE_CAMP_ID_KEY = "deercamp.activeCampId.v1";

function normalizeMemory(item: any): LocalMemoryItem {
  return {
    ...item,
    syncStatus: item?.syncStatus ?? "pending",
    captureVersion: item?.captureVersion ?? 1,
    isSegmented: item?.isSegmented ?? false,
    segments: Array.isArray(item?.segments) ? item.segments : undefined,
    segmentCount:
      item?.segmentCount ??
      (Array.isArray(item?.segments) ? item.segments.length : undefined),
    transcriptionStatus: item?.transcriptionStatus ?? undefined,
  };
}

async function readAll(): Promise<LocalMemoryItem[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(normalizeMemory) : [];
  } catch (error) {
    console.error("readAll local memories failed:", error);
    return [];
  }
}

async function writeAll(items: LocalMemoryItem[]) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export async function getLocalMemories(authorId?: string) {
  const items = await readAll();
  return authorId ? items.filter((item) => item.authorId === authorId) : items;
}

export async function getLocalMemoryById(id: string) {
  const items = await readAll();
  return items.find((item) => item.id === id) ?? null;
}

export async function saveLocalMemory(item: LocalMemoryItem) {
  const normalized: LocalMemoryItem = {
    ...item,
    syncStatus: item.syncStatus ?? "pending",
    captureVersion: item.captureVersion ?? 1,
    isSegmented: item.isSegmented ?? false,
    segmentCount:
      item.segmentCount ??
      (Array.isArray(item.segments) ? item.segments.length : undefined),
  };

  const items = await readAll();
  const next = [normalized, ...items.filter((existing) => existing.id !== item.id)];
  await writeAll(next);
  return normalized;
}

export async function removeLocalMemory(id: string) {
  const items = await readAll();
  await writeAll(items.filter((item) => item.id !== id));
}

export async function updateLocalMemory(
  id: string,
  patch: Partial<LocalMemoryItem>
) {
  const items = await readAll();
  const next = items.map((item) => (item.id === id ? { ...item, ...patch } : item));
  await writeAll(next);
}

export async function getActiveCampId() {
  try {
    const raw = await AsyncStorage.getItem(ACTIVE_CAMP_ID_KEY);
    const clean = String(raw || "").trim();
    return clean || null;
  } catch (error) {
    console.error("getActiveCampId failed:", error);
    return null;
  }
}

export async function setActiveCampId(campId?: string | null) {
  const clean = String(campId || "").trim();

  try {
    if (!clean) {
      await AsyncStorage.removeItem(ACTIVE_CAMP_ID_KEY);
      return;
    }

    await AsyncStorage.setItem(ACTIVE_CAMP_ID_KEY, clean);
  } catch (error) {
    console.error("setActiveCampId failed:", error);
  }
}

export async function markMemoryPublishing(id: string) {
  await updateLocalMemory(id, {
    syncStatus: "publishing",
    publishError: undefined,
  });
}

export async function markMemoryPublished(
  id: string,
  data: {
    feedDocId: string;
    campId?: string;
  }
) {
  await updateLocalMemory(id, {
    syncStatus: "synced",
    feedDocId: data.feedDocId,
    campId: data.campId,
    publishedAt: Date.now(),
    publishError: undefined,
  });
}

export async function markMemoryPublishFailed(id: string, message: string) {
  await updateLocalMemory(id, {
    syncStatus: "failed",
    publishError: String(message || "Publish failed.").trim() || "Publish failed.",
  });
}