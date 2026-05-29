// lib/localCampStats.ts
import AsyncStorage from "@react-native-async-storage/async-storage";

export type CampStatType = "buckAm" | "doeAm" | "buckPm" | "doePm";

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
  syncStatus: "pending" | "synced" | "failed";
  source: "CampStatsMgr";
  schemaVersion: 1;
};

export type CampStatsSummary = {
  total: number;
  byType: Record<CampStatType, number>;
  byStand: Record<string, number>;
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

function safeJsonParse(value: string | null): LocalCampStatRecord[] {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function createCampStatId(authorId: string) {
  return `local-stat-${authorId || "member"}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

export async function getLocalCampStats() {
  const raw = await AsyncStorage.getItem(CAMP_STATS_STORAGE_KEY);
  return safeJsonParse(raw);
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
    count: input.count || 1,
    syncStatus: input.syncStatus || "pending",
    source: "CampStatsMgr",
    schemaVersion: 1,
  };

  await AsyncStorage.setItem(
    CAMP_STATS_STORAGE_KEY,
    JSON.stringify([record, ...existing])
  );

  return record;
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
      const count = Number(record.count || 1);
      summary.total += count;
      summary.byType[record.statType] += count;
      summary.byStand[record.standName] =
        (summary.byStand[record.standName] || 0) + count;
    });

  return summary;
}
