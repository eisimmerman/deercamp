// app/(tabs)/stats-dashboard.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { collection, getDocs, limit, orderBy, query } from "firebase/firestore";
import { useFocusEffect } from "@react-navigation/native";

import { auth, db } from "@/lib/firebase";
import { getActiveCampId, getActiveCampName } from "@/lib/localMemories";
import {
  CAMP_STAT_LABELS,
  DEFAULT_CAMP_STAT_SYNC_SUMMARY,
  getCampStatsSyncSummary,
  getLocalCampStats,
  type CampStatType,
  type CampStatsSyncSummary,
  type LocalCampStatRecord,
} from "../../lib/localCampStats";

type DashboardRecord = {
  id: string;
  localId?: string;
  standName: string;
  statType: CampStatType;
  statLabel: string;
  count: number;
  clientCreatedAt: number;
  sourceLabel: "Cloud" | "Local";
  syncStatus?: LocalCampStatRecord["syncStatus"];
};

type StandSummary = {
  standName: string;
  total: number;
  buckAm: number;
  doeAm: number;
  buckPm: number;
  doePm: number;
};

const STAT_TYPES: CampStatType[] = ["buckAm", "doeAm", "buckPm", "doePm"];

const emptyTypeTotals: Record<CampStatType, number> = {
  buckAm: 0,
  doeAm: 0,
  buckPm: 0,
  doePm: 0,
};

function toCount(value: unknown) {
  const count = Number(value);
  return Number.isFinite(count) ? count : 0;
}

function toClientCreatedAt(value: unknown) {
  const count = Number(value);
  return Number.isFinite(count) ? count : Date.now();
}

function formatWhen(ms: number) {
  if (!ms) return "";
  return new Date(ms).toLocaleString();
}

function normalizeLocalRecord(record: LocalCampStatRecord): DashboardRecord {
  return {
    id: record.id,
    localId: record.id,
    standName: record.standName || "Unknown Stand",
    statType: record.statType,
    statLabel: record.statLabel || CAMP_STAT_LABELS[record.statType],
    count: toCount(record.count),
    clientCreatedAt: toClientCreatedAt(record.clientCreatedAt),
    sourceLabel: "Local",
    syncStatus: record.syncStatus,
  };
}

function normalizeCloudRecord(docId: string, data: any): DashboardRecord | null {
  const statType = data?.statType as CampStatType;
  if (!STAT_TYPES.includes(statType)) return null;

  return {
    id: docId,
    localId: typeof data?.localId === "string" ? data.localId : undefined,
    standName: String(data?.standName || "Unknown Stand"),
    statType,
    statLabel: String(data?.statLabel || CAMP_STAT_LABELS[statType]),
    count: toCount(data?.count),
    clientCreatedAt: toClientCreatedAt(data?.clientCreatedAt),
    sourceLabel: "Cloud",
  };
}

function buildStandSummaries(records: DashboardRecord[]) {
  const byStand = new Map<string, StandSummary>();

  records.forEach((record) => {
    const current =
      byStand.get(record.standName) ||
      ({
        standName: record.standName,
        total: 0,
        buckAm: 0,
        doeAm: 0,
        buckPm: 0,
        doePm: 0,
      } satisfies StandSummary);

    current.total += record.count;
    current[record.statType] += record.count;
    byStand.set(record.standName, current);
  });

  return Array.from(byStand.values()).sort((a, b) => b.total - a.total);
}

function buildTypeTotals(records: DashboardRecord[]) {
  return records.reduce(
    (totals, record) => {
      totals[record.statType] += record.count;
      return totals;
    },
    { ...emptyTypeTotals }
  );
}

function dedupeCloudAndLocalRecords(
  cloudRecords: DashboardRecord[],
  localRecords: DashboardRecord[]
) {
  if (cloudRecords.length === 0) return localRecords;

  const cloudLocalIds = new Set(
    cloudRecords
      .map((record) => record.localId)
      .filter((id): id is string => !!id)
  );

  const unsyncedLocalRecords = localRecords.filter((record) => {
    if (record.syncStatus === "synced" && record.localId && cloudLocalIds.has(record.localId)) {
      return false;
    }

    return record.syncStatus !== "synced";
  });

  return [...cloudRecords, ...unsyncedLocalRecords].sort(
    (a, b) => b.clientCreatedAt - a.clientCreatedAt
  );
}

async function fetchCloudCampStats(campId: string) {
  if (!campId || !auth.currentUser || auth.currentUser.isAnonymous) return [];

  const statsQuery = query(
    collection(db, "camps", campId, "campStats"),
    orderBy("clientCreatedAt", "desc"),
    limit(250)
  );

  const snapshot = await getDocs(statsQuery);
  return snapshot.docs
    .map((doc) => normalizeCloudRecord(doc.id, doc.data()))
    .filter(Boolean) as DashboardRecord[];
}

export default function CampStatsDashboardScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeCampId, setActiveCampId] = useState("");
  const [activeCampName, setActiveCampName] = useState("DeerCamp");
  const [records, setRecords] = useState<DashboardRecord[]>([]);
  const [syncSummary, setSyncSummary] = useState<CampStatsSyncSummary>(
    DEFAULT_CAMP_STAT_SYNC_SUMMARY
  );
  const [statusMessage, setStatusMessage] = useState("");

  const typeTotals = useMemo(() => buildTypeTotals(records), [records]);
  const standSummaries = useMemo(() => buildStandSummaries(records), [records]);
  const recentRecords = useMemo(() => records.slice(0, 8), [records]);
  const totalSightings = useMemo(
    () => records.reduce((total, record) => total + record.count, 0),
    [records]
  );
  const cloudRecordCount = useMemo(
    () => records.filter((record) => record.sourceLabel === "Cloud").length,
    [records]
  );
  const localRecordCount = useMemo(
    () => records.filter((record) => record.sourceLabel === "Local").length,
    [records]
  );
  const bestStand = standSummaries[0];

  const insightText = useMemo(() => {
    if (!bestStand || totalSightings === 0) {
      return "Log a few sightings to reveal your most active stands and best time-of-day patterns.";
    }

    const standTypeEntries: Array<{ label: string; count: number }> = [
      { label: "Buck AM", count: bestStand.buckAm },
      { label: "Doe AM", count: bestStand.doeAm },
      { label: "Buck PM", count: bestStand.buckPm },
      { label: "Doe PM", count: bestStand.doePm },
    ];

    const leadingType = standTypeEntries.sort((a, b) => b.count - a.count)[0];

    if (!leadingType || leadingType.count === 0) {
      return `${bestStand.standName} has the most activity so far with ${bestStand.total} sightings.`;
    }

    return `${bestStand.standName} has the most activity so far, led by ${leadingType.label} sightings.`;
  }, [bestStand, totalSightings]);

  async function loadDashboard(options?: { quiet?: boolean }) {
    try {
      if (!options?.quiet) setLoading(true);

      const campId = await getActiveCampId();
      const campName = await getActiveCampName(campId);
      const localRecords = (await getLocalCampStats())
        .filter((record) => !campId || record.campId === campId)
        .map(normalizeLocalRecord);
      const nextSyncSummary = await getCampStatsSyncSummary(campId);

      let cloudRecords: DashboardRecord[] = [];
      try {
        cloudRecords = await fetchCloudCampStats(campId);
      } catch (error: any) {
        console.error("load cloud CSM dashboard failed:", error);
        setStatusMessage("Showing local CSM counts. Cloud stats will load when available.");
      }

      const combinedRecords = dedupeCloudAndLocalRecords(cloudRecords, localRecords);

      setActiveCampId(campId);
      setActiveCampName(campName || "DeerCamp");
      setRecords(combinedRecords);
      setSyncSummary(nextSyncSummary);

      if (cloudRecords.length > 0) {
        setStatusMessage("Showing synced DeerCamp stats and any local counts on this phone.");
      } else if (localRecords.length > 0) {
        setStatusMessage("Showing local CSM counts saved on this phone.");
      } else {
        setStatusMessage("No CSM counts logged yet.");
      }
    } catch (error: any) {
      console.error("load CSM dashboard failed:", error);
      setStatusMessage(error?.message || "Could not load CSM dashboard.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void loadDashboard();
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadDashboard({ quiet: true });
    }, [])
  );

  function handleRefresh() {
    setRefreshing(true);
    void loadDashboard({ quiet: true });
  }

  if (loading) {
    return (
      <View style={styles.centerScreen}>
        <ActivityIndicator size="large" color="#D0B17A" />
        <Text style={styles.loadingText}>Loading CampStatsMgr dashboard...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#D0B17A" />
      }
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.brand}>DeerCamp</Text>
        <Text style={styles.appName}>CampStatsMgr Dashboard</Text>
        <Text style={styles.sectionLabel}>{activeCampName}</Text>
        <Text style={styles.headerText}>
          Simple field sightings summarized by stand, time of day, and deer type.
        </Text>
      </View>

      <View style={styles.actionRow}>
        <Pressable style={styles.secondaryBtn} onPress={() => router.back()}>
          <Text style={styles.secondaryBtnText}>Back</Text>
        </Pressable>
        <Pressable style={styles.primaryBtn} onPress={() => router.push("/field/stats")}>
          <Text style={styles.primaryBtnText}>Log Stand Stats</Text>
        </Pressable>
      </View>

      <View style={styles.statusCard}>
        <Text style={styles.statusTitle}>Dashboard Status</Text>
        <Text style={styles.statusText}>{statusMessage}</Text>
        <View style={styles.statusGrid}>
          <View style={styles.statusMetric}>
            <Text style={styles.statusMetricNumber}>{cloudRecordCount}</Text>
            <Text style={styles.statusMetricLabel}>Cloud Records</Text>
          </View>
          <View style={styles.statusMetric}>
            <Text style={styles.statusMetricNumber}>{syncSummary.pending}</Text>
            <Text style={styles.statusMetricLabel}>Local Pending</Text>
          </View>
        </View>
        <Text style={styles.statusMeta}>
          Local records on phone: {localRecordCount} · Retry: {syncSummary.failed} · Syncing:{" "}
          {syncSummary.syncing}
        </Text>
      </View>

      <View style={styles.heroStatCard}>
        <Text style={styles.heroStatLabel}>Total Sightings</Text>
        <Text style={styles.heroStatNumber}>{totalSightings}</Text>
        <Text style={styles.heroStatText}>
          {bestStand
            ? `Most activity: ${bestStand.standName} with ${bestStand.total}.`
            : "Log your first stand sighting to start the dashboard."}
        </Text>
      </View>

      <View style={styles.insightCard}>
        <Text style={styles.insightTitle}>Best Activity So Far</Text>
        <Text style={styles.insightText}>{insightText}</Text>
      </View>

      <View style={styles.typeGrid}>
        {STAT_TYPES.map((type) => (
          <View key={type} style={styles.typeCard}>
            <Text style={styles.typeLabel}>{CAMP_STAT_LABELS[type]}</Text>
            <Text style={styles.typeNumber}>{typeTotals[type]}</Text>
          </View>
        ))}
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.cardTitle}>Totals by Stand</Text>
        {standSummaries.length === 0 ? (
          <Text style={styles.emptyText}>No stand totals yet.</Text>
        ) : (
          standSummaries.map((stand) => (
            <View key={stand.standName} style={styles.standRow}>
              <View style={styles.standHeaderRow}>
                <Text style={styles.standName}>{stand.standName}</Text>
                <Text style={styles.standTotal}>{stand.total}</Text>
              </View>
              <Text style={styles.standBreakdown}>
                Buck AM {stand.buckAm} · Doe AM {stand.doeAm} · Buck PM {stand.buckPm} · Doe PM{" "}
                {stand.doePm}
              </Text>
            </View>
          ))
        )}
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.cardTitle}>Recent Sightings</Text>
        {recentRecords.length === 0 ? (
          <Text style={styles.emptyText}>No recent sightings yet.</Text>
        ) : (
          recentRecords.map((record) => (
            <View key={`${record.sourceLabel === "Cloud" ? "Synced" : "Local"}-${record.id}`} style={styles.recentRow}>
              <View style={styles.recentTopRow}>
                <Text style={styles.recentTitle}>
                  {record.count} {record.statLabel}
                </Text>
                <Text
                  style={[
                    styles.sourcePill,
                    record.sourceLabel === "Cloud" ? styles.sourcePillCloud : styles.sourcePillLocal,
                  ]}
                >
                  {record.sourceLabel === "Cloud" ? "Synced" : "Local"}
                </Text>
              </View>
              <Text style={styles.recentMeta}>{record.standName}</Text>
              <Text style={styles.recentWhen}>{formatWhen(record.clientCreatedAt)}</Text>
            </View>
          ))
        )}
      </View>

      <Pressable style={styles.refreshBtn} onPress={handleRefresh}>
        <Text style={styles.refreshBtnText}>Refresh Dashboard</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#0B0E12",
  },

  content: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 96,
  },

  centerScreen: {
    flex: 1,
    backgroundColor: "#0B0E12",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },

  loadingText: {
    marginTop: 14,
    color: "rgba(255,255,255,0.72)",
    fontSize: 16,
    fontWeight: "800",
    textAlign: "center",
  },

  header: {
    alignItems: "center",
    marginTop: 4,
    marginBottom: 18,
  },

  brand: {
    color: "white",
    fontSize: 40,
    fontWeight: "900",
    letterSpacing: -0.8,
    textAlign: "center",
  },

  appName: {
    marginTop: 6,
    color: "#D0B17A",
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: -0.2,
    textAlign: "center",
  },

  sectionLabel: {
    marginTop: 14,
    color: "rgba(255,255,255,0.45)",
    fontWeight: "900",
    letterSpacing: 3,
    fontSize: 13,
    textAlign: "center",
    textTransform: "uppercase",
  },

  headerText: {
    marginTop: 12,
    color: "rgba(255,255,255,0.72)",
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 23,
    textAlign: "center",
    maxWidth: 430,
  },

  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },

  primaryBtn: {
    flex: 1,
    minHeight: 50,
    borderRadius: 999,
    backgroundColor: "white",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },

  primaryBtnText: {
    color: "#0B0E12",
    fontSize: 14,
    fontWeight: "900",
  },

  secondaryBtn: {
    minHeight: 50,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },

  secondaryBtnText: {
    color: "white",
    fontSize: 14,
    fontWeight: "900",
  },

  statusCard: {
    padding: 16,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.045)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    marginBottom: 14,
  },

  statusTitle: {
    color: "#D0B17A",
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 8,
  },

  statusText: {
    color: "rgba(255,255,255,0.84)",
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 22,
  },

  statusGrid: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },

  statusMetric: {
    flex: 1,
    minHeight: 78,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.055)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.09)",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
  },

  statusMetricNumber: {
    color: "white",
    fontSize: 28,
    fontWeight: "900",
    lineHeight: 32,
  },

  statusMetricLabel: {
    marginTop: 4,
    color: "rgba(255,255,255,0.58)",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
    textAlign: "center",
    textTransform: "uppercase",
  },

  statusMeta: {
    marginTop: 10,
    color: "rgba(255,255,255,0.58)",
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 18,
  },

  heroStatCard: {
    padding: 22,
    borderRadius: 28,
    backgroundColor: "rgba(208,177,122,0.14)",
    borderWidth: 1,
    borderColor: "rgba(208,177,122,0.28)",
    marginBottom: 14,
    alignItems: "center",
  },

  heroStatLabel: {
    color: "#D0B17A",
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 2,
    textTransform: "uppercase",
  },

  heroStatNumber: {
    color: "white",
    fontSize: 68,
    fontWeight: "900",
    lineHeight: 78,
  },

  heroStatText: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 15,
    fontWeight: "800",
    textAlign: "center",
    lineHeight: 22,
  },

  insightCard: {
    padding: 18,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.045)",
    borderWidth: 1,
    borderColor: "rgba(208,177,122,0.22)",
    marginBottom: 14,
  },

  insightTitle: {
    color: "#D0B17A",
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom: 8,
  },

  insightText: {
    color: "rgba(255,255,255,0.82)",
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 24,
  },

  typeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 14,
  },

  typeCard: {
    width: "48.5%",
    minHeight: 92,
    borderRadius: 22,
    padding: 16,
    backgroundColor: "rgba(255,255,255,0.052)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    justifyContent: "center",
  },

  typeLabel: {
    color: "rgba(255,255,255,0.68)",
    fontSize: 13,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1,
  },

  typeNumber: {
    color: "white",
    fontSize: 34,
    fontWeight: "900",
    marginTop: 4,
  },

  sectionCard: {
    padding: 16,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.045)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    marginBottom: 14,
  },

  cardTitle: {
    color: "white",
    fontSize: 19,
    fontWeight: "900",
    marginBottom: 12,
  },

  emptyText: {
    color: "rgba(255,255,255,0.62)",
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 22,
  },

  standRow: {
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
  },

  standHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },

  standName: {
    flex: 1,
    color: "white",
    fontSize: 16,
    fontWeight: "900",
  },

  standTotal: {
    color: "#D0B17A",
    fontSize: 22,
    fontWeight: "900",
  },

  standBreakdown: {
    marginTop: 5,
    color: "rgba(255,255,255,0.58)",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
  },

  recentRow: {
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
  },

  recentTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },

  recentTitle: {
    color: "white",
    fontSize: 16,
    fontWeight: "900",
  },

  recentMeta: {
    marginTop: 4,
    color: "rgba(255,255,255,0.66)",
    fontSize: 14,
    fontWeight: "800",
  },

  recentWhen: {
    marginTop: 3,
    color: "rgba(255,255,255,0.42)",
    fontSize: 12,
    fontWeight: "700",
  },

  sourcePill: {
    overflow: "hidden",
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },

  sourcePillCloud: {
    color: "#0B0E12",
    backgroundColor: "#D0B17A",
  },

  sourcePillLocal: {
    color: "white",
    backgroundColor: "rgba(255,255,255,0.12)",
  },

  refreshBtn: {
    minHeight: 52,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },

  refreshBtnText: {
    color: "white",
    fontSize: 15,
    fontWeight: "900",
  },
});
