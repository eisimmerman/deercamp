// app/field/stats.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";

import { auth } from "@/lib/firebase";
import { getActiveCampId, getActiveCampName } from "@/lib/localMemories";
import {
  CAMP_STAT_LABELS,
  type CampStatType,
  type CampStatsSummary,
  DEFAULT_CAMP_STAT_SUMMARY,
  getCampStatsSummary,
  saveLocalCampStat,
} from "../../lib/localCampStats";

type StandOption = {
  id: string;
  name: string;
};

const DEFAULT_STANDS: StandOption[] = [
  { id: "north-stand", name: "North Stand" },
  { id: "south-stand", name: "South Stand" },
  { id: "east-stand", name: "East Stand" },
  { id: "west-stand", name: "West Stand" },
];

const STAT_OPTIONS: CampStatType[] = ["buckAm", "doeAm", "buckPm", "doePm"];

export default function CampStatsMgrScreen() {
  const user = auth.currentUser;
  const authorId = user?.uid || "anonymous";
  const authorName =
    user?.displayName?.trim() || user?.email?.trim() || "DeerCamp Member";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeCampId, setActiveCampId] = useState("");
  const [activeCampName, setActiveCampName] = useState("Camp Swede");
  const [selectedStand, setSelectedStand] = useState<StandOption | null>(null);
  const [summary, setSummary] = useState<CampStatsSummary>(DEFAULT_CAMP_STAT_SUMMARY);
  const [lastSaved, setLastSaved] = useState("");

  const standOptions = useMemo(() => DEFAULT_STANDS, []);

  useEffect(() => {
    let alive = true;

    void (async () => {
      try {
        const campId = await getActiveCampId();
        const campName = await getActiveCampName(campId);
        const nextSummary = await getCampStatsSummary(campId);

        if (!alive) return;

        setActiveCampId(campId);
        setActiveCampName(campName || "Camp Swede");
        setSummary(nextSummary);
        setSelectedStand(standOptions[0] || null);
      } catch (error) {
        console.error("load CampStatsMgr failed:", error);
        Alert.alert(
          "Stats unavailable",
          "CampStatsMgr could not load. Please try again."
        );
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [standOptions]);

  async function refreshSummary(campId = activeCampId) {
    const nextSummary = await getCampStatsSummary(campId);
    setSummary(nextSummary);
  }

  async function logStat(statType: CampStatType) {
    if (!selectedStand || saving) return;

    try {
      setSaving(true);

      const record = await saveLocalCampStat({
        campId: activeCampId,
        campName: activeCampName,
        standId: selectedStand.id,
        standName: selectedStand.name,
        statType,
        clientCreatedAt: Date.now(),
        authorId,
        authorName,
      });

      setLastSaved(`${record.statLabel} saved for ${record.standName}`);
      await refreshSummary(activeCampId);
    } catch (error: any) {
      console.error("save CampStatsMgr stat failed:", error);
      Alert.alert("Save failed", error?.message ?? "Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.centerScreen}>
        <ActivityIndicator />
        <Text style={styles.loadingText}>Loading CampStatsMgr...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.topRow}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Back</Text>
        </Pressable>
      </View>

      <View style={styles.header}>
        <Text style={styles.brand}>DeerCamp</Text>
        <Text style={styles.appName}>CampStatsMgr</Text>
        <Text style={styles.campName}>Current Camp: {activeCampName}</Text>
        <Text style={styles.headerText}>
          Tap a stand, then tap what you saw. DeerCamp saves the count now and
          keeps it ready for sync later.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardKicker}>1. Select Stand</Text>
        <View style={styles.standGrid}>
          {standOptions.map((stand) => {
            const selected = selectedStand?.id === stand.id;

            return (
              <Pressable
                key={stand.id}
                style={({ pressed }) => [
                  styles.standButton,
                  selected && styles.standButtonSelected,
                  pressed && styles.pressed,
                ]}
                onPress={() => setSelectedStand(stand)}
              >
                <Text
                  style={[
                    styles.standButtonText,
                    selected && styles.standButtonSelectedText,
                  ]}
                >
                  {stand.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardKicker}>2. Log Sighting</Text>
        <Text style={styles.selectedStandText}>
          {selectedStand ? selectedStand.name : "Choose a stand"}
        </Text>

        <View style={styles.statGrid}>
          {STAT_OPTIONS.map((statType) => (
            <Pressable
              key={statType}
              style={({ pressed }) => [
                styles.statButton,
                pressed && styles.pressed,
                saving && styles.disabled,
              ]}
              disabled={saving || !selectedStand}
              onPress={() => logStat(statType)}
            >
              <Text style={styles.statButtonText}>{CAMP_STAT_LABELS[statType]}</Text>
            </Pressable>
          ))}
        </View>

        {!!lastSaved && <Text style={styles.savedText}>{lastSaved}</Text>}
      </View>

      <View style={styles.summaryCard}>
        <Text style={styles.cardKicker}>Saved Locally</Text>
        <Text style={styles.summaryTotal}>{summary.total}</Text>
        <Text style={styles.summaryLabel}>total CSM field taps</Text>

        <View style={styles.summaryGrid}>
          {STAT_OPTIONS.map((statType) => (
            <View key={statType} style={styles.summaryPill}>
              <Text style={styles.summaryPillNumber}>{summary.byType[statType]}</Text>
              <Text style={styles.summaryPillLabel}>{CAMP_STAT_LABELS[statType]}</Text>
            </View>
          ))}
        </View>
      </View>
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
    paddingTop: 14,
    paddingBottom: 30,
  },

  centerScreen: {
    flex: 1,
    backgroundColor: "#0B0E12",
    alignItems: "center",
    justifyContent: "center",
    padding: 22,
  },

  loadingText: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 15,
    fontWeight: "800",
    marginTop: 12,
  },

  topRow: {
    alignItems: "flex-start",
    marginBottom: 8,
  },

  backButton: {
    minHeight: 40,
    borderRadius: 999,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },

  backButtonText: {
    color: "white",
    fontSize: 14,
    fontWeight: "900",
  },

  header: {
    alignItems: "center",
    marginBottom: 16,
  },

  brand: {
    color: "white",
    fontSize: 38,
    fontWeight: "900",
    letterSpacing: -0.7,
    textAlign: "center",
  },

  appName: {
    marginTop: 4,
    color: "#D0B17A",
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: -0.2,
    textAlign: "center",
  },

  campName: {
    marginTop: 10,
    color: "rgba(255,255,255,0.48)",
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    textAlign: "center",
  },

  headerText: {
    marginTop: 10,
    color: "rgba(255,255,255,0.72)",
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 22,
    textAlign: "center",
    maxWidth: 420,
  },

  card: {
    marginTop: 12,
    padding: 16,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.052)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },

  cardKicker: {
    color: "#D0B17A",
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 12,
  },

  standGrid: {
    gap: 10,
  },

  standButton: {
    minHeight: 54,
    borderRadius: 18,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },

  standButtonSelected: {
    backgroundColor: "white",
    borderColor: "white",
  },

  standButtonText: {
    color: "white",
    fontSize: 17,
    fontWeight: "900",
  },

  standButtonSelectedText: {
    color: "#0B0E12",
  },

  selectedStandText: {
    color: "white",
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: -0.4,
    marginBottom: 14,
  },

  statGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },

  statButton: {
    flexGrow: 1,
    flexBasis: "47%",
    minHeight: 72,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(208,177,122,0.16)",
    borderWidth: 1,
    borderColor: "rgba(208,177,122,0.30)",
    paddingHorizontal: 10,
  },

  statButtonText: {
    color: "white",
    fontSize: 19,
    fontWeight: "900",
    textAlign: "center",
  },

  savedText: {
    marginTop: 12,
    color: "#D0B17A",
    fontSize: 15,
    fontWeight: "900",
    textAlign: "center",
  },

  summaryCard: {
    marginTop: 12,
    padding: 18,
    borderRadius: 24,
    backgroundColor: "rgba(208,177,122,0.13)",
    borderWidth: 1,
    borderColor: "rgba(208,177,122,0.24)",
    alignItems: "center",
  },

  summaryTotal: {
    color: "white",
    fontSize: 54,
    fontWeight: "900",
    letterSpacing: -1.5,
    lineHeight: 60,
  },

  summaryLabel: {
    color: "rgba(255,255,255,0.66)",
    fontSize: 14,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 16,
  },

  summaryGrid: {
    width: "100%",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },

  summaryPill: {
    flexGrow: 1,
    flexBasis: "47%",
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },

  summaryPillNumber: {
    color: "white",
    fontSize: 25,
    fontWeight: "900",
  },

  summaryPillLabel: {
    color: "rgba(255,255,255,0.62)",
    fontSize: 12,
    fontWeight: "900",
    marginTop: 2,
    textTransform: "uppercase",
  },

  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.99 }],
  },

  disabled: {
    opacity: 0.55,
  },
});
