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

const MAX_SIGHTING_COUNT = 99;

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
  const [selectedStatType, setSelectedStatType] = useState<CampStatType>("buckAm");
  const [sightingCount, setSightingCount] = useState(1);
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

  function changeSightingCount(delta: number) {
    setSightingCount((current) => {
      const next = current + delta;
      return Math.min(MAX_SIGHTING_COUNT, Math.max(1, next));
    });
  }

  function resetForAnotherSighting() {
    setSightingCount(1);
    setLastSaved("");
  }

  async function saveSighting() {
    if (!selectedStand || saving) return;

    try {
      setSaving(true);

      const record = await saveLocalCampStat({
        campId: activeCampId,
        campName: activeCampName,
        standId: selectedStand.id,
        standName: selectedStand.name,
        statType: selectedStatType,
        count: sightingCount,
        clientCreatedAt: Date.now(),
        authorId,
        authorName,
      });

      setLastSaved(
        `${record.count} ${record.statLabel} saved for ${record.standName}. Ready to sync when connected.`
      );
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
          Pick a stand, choose what you saw, adjust the count, then save it.
          DeerCamp keeps it local and ready to sync later.
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
        <Text style={styles.cardKicker}>2. Choose Sighting Type</Text>
        <Text style={styles.selectedStandText}>
          {selectedStand ? selectedStand.name : "Choose a stand"}
        </Text>

        <View style={styles.statGrid}>
          {STAT_OPTIONS.map((statType) => {
            const selected = selectedStatType === statType;

            return (
              <Pressable
                key={statType}
                style={({ pressed }) => [
                  styles.statButton,
                  selected && styles.statButtonSelected,
                  pressed && styles.pressed,
                  saving && styles.disabled,
                ]}
                disabled={saving || !selectedStand}
                onPress={() => setSelectedStatType(statType)}
              >
                <Text
                  style={[
                    styles.statButtonText,
                    selected && styles.statButtonSelectedText,
                  ]}
                >
                  {CAMP_STAT_LABELS[statType]}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardKicker}>3. Count Seen</Text>
        <Text style={styles.countContext}>
          {selectedStand?.name || "Selected stand"} • {CAMP_STAT_LABELS[selectedStatType]}
        </Text>

        <View style={styles.counterRow}>
          <Pressable
            style={({ pressed }) => [
              styles.counterButton,
              sightingCount <= 1 && styles.disabled,
              pressed && styles.pressed,
            ]}
            disabled={saving || sightingCount <= 1}
            onPress={() => changeSightingCount(-1)}
          >
            <Text style={styles.counterButtonText}>−</Text>
          </Pressable>

          <View style={styles.counterDisplay}>
            <Text style={styles.counterNumber}>{sightingCount}</Text>
            <Text style={styles.counterLabel}>seen</Text>
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.counterButton,
              sightingCount >= MAX_SIGHTING_COUNT && styles.disabled,
              pressed && styles.pressed,
            ]}
            disabled={saving || sightingCount >= MAX_SIGHTING_COUNT}
            onPress={() => changeSightingCount(1)}
          >
            <Text style={styles.counterButtonText}>+</Text>
          </Pressable>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.saveButton,
            pressed && styles.pressed,
            (saving || !selectedStand) && styles.disabled,
          ]}
          disabled={saving || !selectedStand}
          onPress={saveSighting}
        >
          {saving ? (
            <ActivityIndicator color="#0B0E12" />
          ) : (
            <Text style={styles.saveButtonText}>Save Sighting</Text>
          )}
        </Pressable>

        {!!lastSaved && (
          <View style={styles.savedBox}>
            <Text style={styles.savedTitle}>Saved locally</Text>
            <Text style={styles.savedText}>{lastSaved}</Text>
            <Pressable
              style={({ pressed }) => [styles.logAnotherButton, pressed && styles.pressed]}
              onPress={resetForAnotherSighting}
            >
              <Text style={styles.logAnotherButtonText}>Log Another</Text>
            </Pressable>
          </View>
        )}
      </View>

      <View style={styles.summaryCard}>
        <Text style={styles.cardKicker}>Local CSM Total</Text>
        <Text style={styles.summaryTotal}>{summary.total}</Text>
        <Text style={styles.summaryLabel}>total sightings saved locally</Text>

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
    maxWidth: 440,
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
    minHeight: 66,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(208,177,122,0.16)",
    borderWidth: 1,
    borderColor: "rgba(208,177,122,0.30)",
    paddingHorizontal: 10,
  },

  statButtonSelected: {
    backgroundColor: "#D0B17A",
    borderColor: "#D0B17A",
  },

  statButtonText: {
    color: "white",
    fontSize: 19,
    fontWeight: "900",
    textAlign: "center",
  },

  statButtonSelectedText: {
    color: "#0B0E12",
  },

  countContext: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 14,
    textAlign: "center",
  },

  counterRow: {
    flexDirection: "row",
    alignItems: "stretch",
    justifyContent: "center",
    gap: 12,
    marginBottom: 14,
  },

  counterButton: {
    width: 82,
    minHeight: 82,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },

  counterButtonText: {
    color: "white",
    fontSize: 42,
    fontWeight: "900",
    lineHeight: 48,
  },

  counterDisplay: {
    flex: 1,
    minHeight: 82,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.92)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.92)",
  },

  counterNumber: {
    color: "#0B0E12",
    fontSize: 48,
    fontWeight: "900",
    lineHeight: 54,
  },

  counterLabel: {
    marginTop: 2,
    color: "rgba(11,14,18,0.62)",
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase",
  },

  saveButton: {
    minHeight: 58,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#D0B17A",
    borderWidth: 1,
    borderColor: "#D0B17A",
  },

  saveButtonText: {
    color: "#0B0E12",
    fontSize: 18,
    fontWeight: "900",
  },

  savedBox: {
    marginTop: 14,
    padding: 14,
    borderRadius: 20,
    backgroundColor: "rgba(208,177,122,0.12)",
    borderWidth: 1,
    borderColor: "rgba(208,177,122,0.26)",
  },

  savedTitle: {
    color: "#D0B17A",
    fontSize: 15,
    fontWeight: "900",
    textAlign: "center",
    textTransform: "uppercase",
    letterSpacing: 1,
  },

  savedText: {
    marginTop: 6,
    color: "rgba(255,255,255,0.78)",
    fontSize: 15,
    fontWeight: "800",
    lineHeight: 21,
    textAlign: "center",
  },

  logAnotherButton: {
    marginTop: 12,
    minHeight: 46,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },

  logAnotherButtonText: {
    color: "white",
    fontSize: 15,
    fontWeight: "900",
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
    textAlign: "center",
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
