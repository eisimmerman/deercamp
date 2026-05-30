// lib/localCampStats.ts
import AsyncStorage from "@react-native-async-storage/async-storage";

export type CampStatType = "buckAm" | "doeAm" | "buckPm" | "doePm";

export type CampStatSyncStatus = "pending" | "syncing" | "synced" | "failed";

export type LocalCampStatRecord = {
  id: string;
  campId: string;
  campName?: string;
  standId: string;
  standName: string;
  statType: CampStatType;
  statLabel: string;
  count: number;
  clientCreatedAt: number;
  authorId: string;
  authorName: string;
  syncStatus: CampStatSyncStatus;
  firestoreDocId?: string;
  syncedAt?: number;
  syncError?: string;
  source: "CampStatsMgr";
  schemaVersion: 1;
};

export type CampStatsSummary = {
  total: number;
  byType: Record<CampStatType, number>;
  byStand: Record<string, number>;
};

export type CampStatsSyncSummary = {
  pending: number;
  syncing: number;
  synced: number;
  failed: number;
};

const CAMP_STATS_STORAGE_KEY = "deercamp.localCampStats.v1";

export const CAMP_STAT_LABELS: Record<CampStatType, string> = {
  buckAm: "Buck AM",
  doeAm: "Doe AM",
  buckPm: "Buck PM",
  doePm: "Doe PM",
};

export const DEFAULT_CAMP_STAT_SUMMARY: CampStatsSummary = {
  total: 0,
  byType: {
    buckAm: 0,
    doeAm: 0,
    buckPm: 0,
    doePm: 0,
  },
  byStand: {},
};

export const DEFAULT_CAMP_STAT_SYNC_SUMMARY: CampStatsSyncSummary = {
  pending: 0,
  syncing: 0,
  synced: 0,
  failed: 0,
};

function safeJsonParse(value: string | null): LocalCampStatRecord[] {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizeRecord(record: any): LocalCampStatRecord | null {
  if (!record || typeof record !== "object") return null;

  const statType = record.statType as CampStatType;
  if (!CAMP_STAT_LABELS[statType]) return null;

  const count = Number.isFinite(Number(record.count)) ? Number(record.count) : 1;
  const syncStatus = ["pending", "syncing", "synced", "failed"].includes(record.syncStatus)
    ? record.syncStatus
    : "pending";

  return {
    id: String(record.id || createCampStatId(record.authorId || "member")),
    campId: String(record.campId || ""),
    campName: typeof record.campName === "string" ? record.campName : undefined,
    standId: String(record.standId || ""),
    standName: String(record.standName || "Unknown Stand"),
    statType,
    statLabel: CAMP_STAT_LABELS[statType],
    count,
    clientCreatedAt: Number(record.clientCreatedAt || Date.now()),
    authorId: String(record.authorId || "anonymous"),
    authorName: String(record.authorName || "DeerCamp Member"),
    syncStatus,
    firestoreDocId: typeof record.firestoreDocId === "string" ? record.firestoreDocId : undefined,
    syncedAt: Number.isFinite(Number(record.syncedAt)) ? Number(record.syncedAt) : undefined,
    syncError: typeof record.syncError === "string" ? record.syncError : undefined,
    source: "CampStatsMgr",
    schemaVersion: 1,
  };
}

async function writeLocalCampStats(records: LocalCampStatRecord[]) {
  await AsyncStorage.setItem(CAMP_STATS_STORAGE_KEY, JSON.stringify(records));
}

export function createCampStatId(authorId: string) {
  return `local-stat-${authorId || "member"}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

export async function getLocalCampStats() {
  const raw = await AsyncStorage.getItem(CAMP_STATS_STORAGE_KEY);
  return safeJsonParse(raw).map(normalizeRecord).filter(Boolean) as LocalCampStatRecord[];
}

export async function clearLocalCampStats(campId?: string) {
  if (!campId) {
    await writeLocalCampStats([]);
    return [];
  }

  const records = await getLocalCampStats();
  const nextRecords = records.filter((record) => record.campId !== campId);
  await writeLocalCampStats(nextRecords);
  return nextRecords;
}

export async function saveLocalCampStat(
  input: Omit<LocalCampStatRecord, "id" | "statLabel" | "count" | "syncStatus" | "source" | "schemaVersion"> & {
    id?: string;
    count?: number;
    syncStatus?: LocalCampStatRecord["syncStatus"];
  }
) {
  const existing = await getLocalCampStats();
  const record: LocalCampStatRecord = {
    ...input,
    id: input.id || createCampStatId(input.authorId),
    statLabel: CAMP_STAT_LABELS[input.statType],
    count: input.count ?? 1,
    syncStatus: input.syncStatus || "pending",
    source: "CampStatsMgr",
    schemaVersion: 1,
  };

  await writeLocalCampStats([record, ...existing]);

  return record;
}

export async function markLocalCampStatSyncStatus(
  id: string,
  syncStatus: CampStatSyncStatus,
  extra?: {
    firestoreDocId?: string;
    syncedAt?: number;
    syncError?: string;
  }
) {
  const records = await getLocalCampStats();
  const nextRecords = records.map((record) =>
    record.id === id
      ? {
          ...record,
          syncStatus,
          firestoreDocId: extra?.firestoreDocId ?? record.firestoreDocId,
          syncedAt: extra?.syncedAt ?? record.syncedAt,
          syncError: extra?.syncError,
        }
      : record
  );

  await writeLocalCampStats(nextRecords);
  return nextRecords.find((record) => record.id === id) || null;
}

export async function getPendingCampStats(campId?: string) {
  const records = await getLocalCampStats();

  return records.filter(
    (record) =>
      (!campId || record.campId === campId) &&
      (record.syncStatus === "pending" || record.syncStatus === "failed")
  );
}

export async function getCampStatsSummary(campId?: string) {
  const records = await getLocalCampStats();
  const summary: CampStatsSummary = {
    total: 0,
    byType: { ...DEFAULT_CAMP_STAT_SUMMARY.byType },
    byStand: {},
  };

  records
    .filter((record) => !campId || record.campId === campId)
    .forEach((record) => {
      const count = Number(record.count ?? 1);
      summary.total += count;
      summary.byType[record.statType] += count;
      summary.byStand[record.standName] =
        (summary.byStand[record.standName] || 0) + count;
    });

  return summary;
}

export async function getCampStatsSyncSummary(campId?: string) {
  const records = await getLocalCampStats();
  const summary: CampStatsSyncSummary = { ...DEFAULT_CAMP_STAT_SYNC_SUMMARY };

  records
    .filter((record) => !campId || record.campId === campId)
    .forEach((record) => {
      const status = record.syncStatus || "pending";
      if (status in summary) {
        summary[status as CampStatSyncStatus] += 1;
      }
    });

  return summary;
}
