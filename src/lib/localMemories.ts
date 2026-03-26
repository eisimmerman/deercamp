import AsyncStorage from "@react-native-async-storage/async-storage";

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
  syncStatus?: "pending" | "publishing" | "synced" | "failed";
  type?: "photo" | "text" | "voice";

  // Feed publish fields
  feedDocId?: string;
  publishedAt?: number;
  publishError?: string;
  campId?: string;
};

const STORAGE_KEY = "deercamp.localMemories.v1";

function normalizeMemory(item: any): LocalMemoryItem {
  return {
    ...item,
    syncStatus: item?.syncStatus ?? "pending",
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

export async function markMemoryPublishing(id: string) {
  await updateLocalMemory(id, {
    syncStatus: "publishing",
    publishError: undefined,
  });
}

export async function markMemoryPublished(
  id: string,
  payload: {
    feedDocId: string;
    campId?: string;
  }
) {
  await updateLocalMemory(id, {
    syncStatus: "synced",
    feedDocId: payload.feedDocId,
    campId: payload.campId,
    publishedAt: Date.now(),
    publishError: undefined,
  });
}

export async function markMemoryPublishFailed(id: string, error: string) {
  await updateLocalMemory(id, {
    syncStatus: "failed",
    publishError: error,
  });
}