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
  pendingAuth?: boolean;
  pendingUploadAfterAuth?: boolean;

  photoUri?: string;
  photoUrl?: string;
  audioUri?: string;
  audioUrl?: string;
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
  targetCampName?: string;

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

export const PENDING_AUTH_AUTHOR_ID = "pending-auth";
const STORAGE_KEY = "deercamp.localMemories.v1";
const ACTIVE_CAMP_ID_KEY = "deercamp.activeCampId.v1";
export const DEFAULT_ACTIVE_CAMP_ID = "camp-swede-cornell-wi-54732";
export const DEFAULT_ACTIVE_CAMP_NAME = "Camp Swede";
const ACTIVE_CAMP_NAME_KEY = "deercamp.activeCampName.v1";


function resolveMemoryCampId(value?: string | null) {
  const clean = String(value || "").trim();
  if (!clean || clean === "ourdeercamp") return DEFAULT_ACTIVE_CAMP_ID;
  return clean;
}

function resolveMemoryCampName(campId?: string | null, value?: string | null) {
  const clean = String(value || "").trim();
  if (clean) return clean;

  const resolvedCampId = resolveMemoryCampId(campId);
  if (resolvedCampId === DEFAULT_ACTIVE_CAMP_ID) return DEFAULT_ACTIVE_CAMP_NAME;

  return "Selected DeerCamp";
}

function normalizeMemory(item: any): LocalMemoryItem {
  return {
    ...item,
    campId: resolveMemoryCampId(item?.campId),
    targetCampName: resolveMemoryCampName(item?.campId, item?.targetCampName),
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

export async function getPendingAuthMemories() {
  const items = await readAll();
  return items.filter(
    (item) => item.pendingAuth || item.authorId === PENDING_AUTH_AUTHOR_ID
  );
}

export async function attachPendingAuthMemoriesToUser(params: {
  authorId: string;
  authorName?: string | null;
}) {
  const cleanAuthorId = String(params.authorId || "").trim();
  if (!cleanAuthorId) return [];

  const cleanAuthorName =
    String(params.authorName || "").trim() || "DeerCamp Member";

  const items = await readAll();
  const attached: LocalMemoryItem[] = [];

  const next = items.map((item) => {
    if (!(item.pendingAuth || item.authorId === PENDING_AUTH_AUTHOR_ID)) {
      return item;
    }

    const updated: LocalMemoryItem = {
      ...item,
      authorId: cleanAuthorId,
      authorName: cleanAuthorName,
      pendingAuth: false,
      pendingUploadAfterAuth: false,
      syncStatus:
        item.syncStatus === "synced" || item.syncStatus === "publishing"
          ? item.syncStatus
          : "pending",
      details:
        item.type === "photo"
          ? "Photo captured in Field Mode. Ready to upload."
          : "Photo + voice captured in Field Mode. Ready to upload.",
    };

    attached.push(updated);
    return updated;
  });

  if (attached.length > 0) {
    await writeAll(next);
  }

  return attached;
}

export async function getLocalMemoryById(id: string) {
  const items = await readAll();
  return items.find((item) => item.id === id) ?? null;
}

export async function saveLocalMemory(item: LocalMemoryItem) {
  const normalized: LocalMemoryItem = {
    ...item,
    campId: resolveMemoryCampId(item.campId),
    targetCampName: resolveMemoryCampName(item.campId, item.targetCampName),
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
  const sanitizedPatch: Partial<LocalMemoryItem> = {
    ...patch,
    ...(Object.prototype.hasOwnProperty.call(patch, "campId")
      ? { campId: resolveMemoryCampId(patch.campId) }
      : {}),
  };
  const next = items.map((item) =>
    item.id === id ? { ...item, ...sanitizedPatch } : item
  );
  await writeAll(next);
}

export async function getActiveCampId() {
  try {
    const raw = await AsyncStorage.getItem(ACTIVE_CAMP_ID_KEY);
    const clean = String(raw || "").trim();
    return clean || DEFAULT_ACTIVE_CAMP_ID;
  } catch (error) {
    console.error("getActiveCampId failed:", error);
    return DEFAULT_ACTIVE_CAMP_ID;
  }
}

export async function getActiveCampName(campId?: string | null) {
  try {
    const raw = await AsyncStorage.getItem(ACTIVE_CAMP_NAME_KEY);
    return resolveMemoryCampName(campId || (await getActiveCampId()), raw);
  } catch (error) {
    console.error("getActiveCampName failed:", error);
    return resolveMemoryCampName(campId);
  }
}

export async function setActiveCampId(campId?: string | null, campName?: string | null) {
  const clean = String(campId || "").trim();

  try {
    if (!clean) {
      await AsyncStorage.removeItem(ACTIVE_CAMP_ID_KEY);
      await AsyncStorage.removeItem(ACTIVE_CAMP_NAME_KEY);
      return;
    }

    await AsyncStorage.setItem(ACTIVE_CAMP_ID_KEY, clean);

    const cleanName = String(campName || "").trim();
    if (cleanName) {
      await AsyncStorage.setItem(ACTIVE_CAMP_NAME_KEY, cleanName);
    } else if (clean === DEFAULT_ACTIVE_CAMP_ID) {
      await AsyncStorage.setItem(ACTIVE_CAMP_NAME_KEY, DEFAULT_ACTIVE_CAMP_NAME);
    }
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
  targetCampName?: string;
    photoUrl?: string;
    audioUrl?: string;
    voiceUrl?: string;
  }
) {
  await updateLocalMemory(id, {
    syncStatus: "synced",
    feedDocId: data.feedDocId,
    campId: data.campId,
    photoUrl: data.photoUrl,
    audioUrl: data.audioUrl,
    voiceUrl: data.voiceUrl || data.audioUrl,
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