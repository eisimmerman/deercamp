// src/lib/localStats.ts
import AsyncStorage from "@react-native-async-storage/async-storage";

export type HuntSession = "AM" | "PM";

export type LocalStatsEntry = {
  id: string;
  campId: string;
  campName?: string;
  standName: string;
  huntDate: string;
  session: HuntSession;
  buckCount: number;
  doeCount: number;
  totalSightings: number;
  submittedAt: number;
  authorId: string;
  authorName?: string;
  syncStatus: "pending" | "synced" | "failed";
  syncedAt?: number;
  syncError?: string;
};

const STATS_ENTRIES_KEY = "deercamp.localStatsEntries.v1";
const STAND_NAMES_KEY = "deercamp.localStatsStandNames.v1";
const LAST_STAND_KEY = "deercamp.lastStatsStandName.v1";

export const DEFAULT_STAND_NAMES = [
  "North Ridge",
  "Creek Bottom",
  "Oak Flat",
  "Back 40",
  "South Marsh",
  "Ridge Ladder",
];

function normalizeStandName(value?: string | null) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeEntry(item: any): LocalStatsEntry {
  const buckCount = Math.max(0, Number(item?.buckCount || 0));
  const doeCount = Math.max(0, Number(item?.doeCount || 0));

  return {
    id: String(item?.id || `stats-${Date.now()}`),
    campId: String(item?.campId || "camp-swede-cornell-wi-54732"),
    campName: item?.campName ? String(item.campName) : undefined,
    standName: normalizeStandName(item?.standName) || "Unknown Stand",
    huntDate: String(item?.huntDate || ""),
    session: item?.session === "PM" ? "PM" : "AM",
    buckCount,
    doeCount,
    totalSightings: Math.max(0, Number(item?.totalSightings ?? buckCount + doeCount)),
    submittedAt: Number(item?.submittedAt || Date.now()),
    authorId: String(item?.authorId || "anonymous"),
    authorName: item?.authorName ? String(item.authorName) : undefined,
    syncStatus: item?.syncStatus === "synced" || item?.syncStatus === "failed" ? item.syncStatus : "pending",
    syncedAt: item?.syncedAt ? Number(item.syncedAt) : undefined,
    syncError: item?.syncError ? String(item.syncError) : undefined,
  };
}

async function readJsonArray<T>(key: string): Promise<T[]> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error(`read ${key} failed:`, error);
    return [];
  }
}

async function writeJsonArray<T>(key: string, items: T[]) {
  await AsyncStorage.setItem(key, JSON.stringify(items));
}

export async function getLocalStatsEntries() {
  const raw = await readJsonArray<any>(STATS_ENTRIES_KEY);
  return raw.map(normalizeEntry).sort((a, b) => b.submittedAt - a.submittedAt);
}

export async function saveLocalStatsEntry(entry: LocalStatsEntry) {
  const normalized = normalizeEntry(entry);
  const existing = await getLocalStatsEntries();
  const next = [normalized, ...existing.filter((item) => item.id !== normalized.id)];
  await writeJsonArray(STATS_ENTRIES_KEY, next);
  return normalized;
}

export async function updateLocalStatsEntry(id: string, patch: Partial<LocalStatsEntry>) {
  const existing = await getLocalStatsEntries();
  const next = existing.map((item) => item.id === id ? normalizeEntry({ ...item, ...patch }) : item);
  await writeJsonArray(STATS_ENTRIES_KEY, next);
}

export async function getPendingLocalStatsEntries() {
  const entries = await getLocalStatsEntries();
  return entries.filter((entry) => entry.syncStatus === "pending" || entry.syncStatus === "failed");
}

export async function getSavedStandNames() {
  const saved = await readJsonArray<string>(STAND_NAMES_KEY);
  const combined = [...DEFAULT_STAND_NAMES, ...saved].map(normalizeStandName).filter(Boolean);
  return Array.from(new Set(combined));
}

export async function saveStandName(name: string) {
  const clean = normalizeStandName(name);
  if (!clean) return getSavedStandNames();

  const existing = await getSavedStandNames();
  const next = Array.from(new Set([clean, ...existing]));
  await writeJsonArray(STAND_NAMES_KEY, next);
  return next;
}

export async function getLastStatsStandName() {
  try {
    const raw = await AsyncStorage.getItem(LAST_STAND_KEY);
    return normalizeStandName(raw);
  } catch (error) {
    console.error("getLastStatsStandName failed:", error);
    return "";
  }
}

export async function setLastStatsStandName(name: string) {
  const clean = normalizeStandName(name);
  if (!clean) return;

  try {
    await AsyncStorage.setItem(LAST_STAND_KEY, clean);
  } catch (error) {
    console.error("setLastStatsStandName failed:", error);
  }
}
