// app/field/stats.tsx
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { auth } from "@/lib/firebase";
import { getActiveCampId, getActiveCampName } from "@/lib/localMemories";
import {
  CAMP_STAT_LABELS,
  type CampStatType,
  type CampStatsSummary,
  type CampStatsSyncSummary,
  DEFAULT_CAMP_STAT_SUMMARY,
  DEFAULT_CAMP_STAT_SYNC_SUMMARY,
  getCampStatsSummary,
  getCampStatsSyncSummary,
  clearLocalCampStats,
  saveLocalCampStat,
} from "../../lib/localCampStats";
import { syncPendingCampStats } from "../../lib/publishCampStats";

type StandOption = {
  id: string;
  name: string;
};

const STAND_SLOT_COUNT = 10;
const CAMP_STANDS_STORAGE_KEY_PREFIX = "deercamp.campStatsMgr.stands.v1";

const createEmptyStandInputs = () => Array.from({ length: STAND_SLOT_COUNT }, () => "");

function getCampStandsStorageKey(campId: string) {
  return `${CAMP_STANDS_STORAGE_KEY_PREFIX}.${campId || "default"}`;
}

function createStandOptionsFromNames(names: string[]): StandOption[] {
  return names
    .map((name, index) => ({
      id: `stand-${index + 1}`,
      name: name.trim(),
    }))
    .filter((stand) => stand.name.length > 0);
}

async function getSavedStandNames(campId: string) {
  const raw = await AsyncStorage.getItem(getCampStandsStorageKey(campId));

  if (!raw) return createEmptyStandInputs();

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return createEmptyStandInputs();

    return Array.from({ length: STAND_SLOT_COUNT }, (_, index) =>
      typeof parsed[index] === "string" ? parsed[index] : ""
    );
  } catch {
    return createEmptyStandInputs();
  }
}

async function saveStandNames(campId: string, names: string[]) {
  const normalized = Array.from({ length: STAND_SLOT_COUNT }, (_, index) =>
    (names[index] || "").trim()
  );

  await AsyncStorage.setItem(getCampStandsStorageKey(campId), JSON.stringify(normalized));
  return normalized;
}

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
  const [standNameInputs, setStandNameInputs] = useState<string[]>(createEmptyStandInputs);
  const [standOptions, setStandOptions] = useState<StandOption[]>([]);
  const [editingStands, setEditingStands] = useState(true);
  const [selectedStand, setSelectedStand] = useState<StandOption | null>(null);
  const [standSaveMessage, setStandSaveMessage] = useState("");
  const [selectedStatType, setSelectedStatType] = useState<CampStatType>("buckAm");
  const [sightingCount, setSightingCount] = useState(0);
  const [summary, setSummary] = useState<CampStatsSummary>(DEFAULT_CAMP_STAT_SUMMARY);
  const [syncSummary, setSyncSummary] = useState<CampStatsSyncSummary>(DEFAULT_CAMP_STAT_SYNC_SUMMARY);
  const [syncingStats, setSyncingStats] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");
  const [lastSaved, setLastSaved] = useState("");
  const didInitialSyncRef = useRef(false);
  const [countSaved, setCountSaved] = useState(false);
  const [countReadyToSave, setCountReadyToSave] = useState(false);
  const [unsavedWarning, setUnsavedWarning] = useState("");
  const saveButtonScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let alive = true;

    void (async () => {
      try {
        const campId = await getActiveCampId();
        const campName = await getActiveCampName(campId);
        const nextSummary = await getCampStatsSummary(campId);
        const nextSyncSummary = await getCampStatsSyncSummary(campId);
        const savedStandNames = await getSavedStandNames(campId);
        const savedStandOptions = createStandOptionsFromNames(savedStandNames);

        if (!alive) return;

        setActiveCampId(campId);
        setActiveCampName(campName || "Camp Swede");
        setSummary(nextSummary);
        setSyncSummary(nextSyncSummary);
        setStandNameInputs(savedStandNames);
        setStandOptions(savedStandOptions);
        setSelectedStand(savedStandOptions[0] || null);
        setEditingStands(savedStandOptions.length === 0);
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
  }, []);


  useEffect(() => {
    if (loading || !activeCampId || didInitialSyncRef.current) return;

    didInitialSyncRef.current = true;
    void attemptSyncCampStats(activeCampId);
  }, [activeCampId, loading]);

  function pulseSaveButton() {
    saveButtonScale.stopAnimation(() => {
      saveButtonScale.setValue(1);
      Animated.sequence([
        Animated.timing(saveButtonScale, {
          toValue: 1.055,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(saveButtonScale, {
          toValue: 1,
          duration: 170,
          useNativeDriver: true,
        }),
        Animated.timing(saveButtonScale, {
          toValue: 1.035,
          duration: 130,
          useNativeDriver: true,
        }),
        Animated.timing(saveButtonScale, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    });
  }

  useEffect(() => {
    if (!loading && selectedStand && !saving && countReadyToSave) {
      pulseSaveButton();
    }
  }, [loading, selectedStand?.id, selectedStatType, sightingCount, countReadyToSave]);

  async function refreshSummary(campId = activeCampId) {
    const nextSummary = await getCampStatsSummary(campId);
    setSummary(nextSummary);
  }

  async function refreshSyncSummary(campId = activeCampId) {
    const nextSyncSummary = await getCampStatsSyncSummary(campId);
    setSyncSummary(nextSyncSummary);
  }

  async function attemptSyncCampStats(campId = activeCampId) {
    if (syncingStats) return;

    try {
      setSyncingStats(true);
      setSyncMessage(auth.currentUser ? "Syncing saved CSM counts..." : "Saved locally. Sign in to sync.");
      const result = await syncPendingCampStats(campId);

      if (result.skippedReason === "not-signed-in") {
        setSyncMessage("Saved locally. Sign in to sync when connected.");
      } else if (result.skippedReason === "no-pending-records") {
        setSyncMessage("All CSM counts are synced.");
      } else if (result.failed > 0) {
        setSyncMessage(`${result.synced} synced. ${result.failed} still pending retry.`);
      } else if (result.synced > 0) {
        setSyncMessage(`${result.synced} CSM count${result.synced === 1 ? "" : "s"} synced.`);
      }

      await refreshSyncSummary(campId);
    } catch (error: any) {
      console.error("sync CampStatsMgr stats failed:", error);
      setSyncMessage(error?.message || "Sync failed. Counts remain saved locally.");
      await refreshSyncSummary(campId);
    } finally {
      setSyncingStats(false);
    }
  }

  async function handleClearLocalCsmTestData() {
    Alert.alert(
      "Clear local CSM test data?",
      "This only clears CampStatsMgr records saved on this device. It will not delete field memories or cloud-synced records already in DeerCamp.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear Test Data",
          style: "destructive",
          onPress: () => {
            void (async () => {
              try {
                await clearLocalCampStats(activeCampId);
                await refreshSummary(activeCampId);
                await refreshSyncSummary(activeCampId);
                setLastSaved("");
                setSyncMessage("Local CSM test data cleared on this device.");
                setUnsavedWarning("");
                setCountSaved(false);
                setCountReadyToSave(false);
                setSightingCount(0);
              } catch (error: any) {
                console.error("clear CampStatsMgr local data failed:", error);
                Alert.alert("Clear failed", error?.message ?? "Please try again.");
              }
            })();
          },
        },
      ]
    );
  }

  function changeSightingCount(delta: number) {
    setLastSaved("");
    setUnsavedWarning("");
    setCountSaved(false);
    setCountReadyToSave(true);
    setSightingCount((current) => {
      const next = current + delta;
      return Math.min(MAX_SIGHTING_COUNT, Math.max(0, next));
    });
  }

  function updateStandName(index: number, value: string) {
    setStandSaveMessage("");
    setStandNameInputs((current) =>
      current.map((name, nameIndex) => (nameIndex === index ? value : name))
    );
  }

  async function handleSaveStands() {
    try {
      const savedNames = await saveStandNames(activeCampId, standNameInputs);
      const nextStandOptions = createStandOptionsFromNames(savedNames);

      if (nextStandOptions.length === 0) {
        Alert.alert(
          "Name at least one stand",
          "Add one stand name before saving your CampStatsMgr stand list."
        );
        return;
      }

      setStandNameInputs(savedNames);
      setStandOptions(nextStandOptions);
      setSelectedStand((current) => {
        if (!current) return nextStandOptions[0] || null;
        return nextStandOptions.find((stand) => stand.id === current.id) || nextStandOptions[0] || null;
      });
      setEditingStands(false);
      setStandSaveMessage("Stand names saved. Use them every time you log sightings.");
      setLastSaved("");
      setUnsavedWarning("");
      setCountSaved(false);
      setCountReadyToSave(false);
    } catch (error: any) {
      console.error("save CampStatsMgr stands failed:", error);
      Alert.alert("Save failed", error?.message ?? "Please try again.");
    }
  }

  function hasUnsavedCount() {
    return countReadyToSave && !countSaved;
  }

  function selectStand(stand: StandOption) {
    if (selectedStand?.id !== stand.id && hasUnsavedCount()) {
      setUnsavedWarning(
        `Save ${sightingCount} ${CAMP_STAT_LABELS[selectedStatType]} for ${selectedStand?.name || "this stand"} before changing stands.`
      );
      pulseSaveButton();
      return;
    }

    setSelectedStand(stand);
    setLastSaved("");
    setUnsavedWarning("");
    setCountSaved(false);
    setCountReadyToSave(false);
  }

  function selectStatType(statType: CampStatType) {
    if (statType !== selectedStatType && hasUnsavedCount()) {
      setUnsavedWarning(
        `Save ${sightingCount} ${CAMP_STAT_LABELS[selectedStatType]} before switching to ${CAMP_STAT_LABELS[statType]}.`
      );
      pulseSaveButton();
      return;
    }

    setSelectedStatType(statType);
    setLastSaved("");
    setUnsavedWarning("");
    setCountSaved(false);
    setCountReadyToSave(true);
  }

  function resetForAnotherSighting() {
    setSightingCount(0);
    setLastSaved("");
    setUnsavedWarning("");
    setCountSaved(false);
    setCountReadyToSave(false);
  }

  async function saveSighting() {
    if (!selectedStand || saving || !countReadyToSave) return;

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
        `${record.count} ${record.statLabel} saved for ${record.standName}. Pending sync.`
      );
      setSyncMessage(auth.currentUser ? "Saved locally. Syncing now..." : "Saved locally. Sign in to sync when connected.");
      setUnsavedWarning("");
      setCountSaved(true);
      setCountReadyToSave(false);
      setSightingCount(0);
      await refreshSummary(activeCampId);
      await refreshSyncSummary(activeCampId);
      await attemptSyncCampStats(activeCampId);
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
          Name your stands once, then use them to log each sighting count fast in the field.
          DeerCamp keeps it local and ready to sync later.
        </Text>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.cardKicker}>1. {editingStands ? "Name Your Stands" : "Select Stand"}</Text>
          {!editingStands && (
            <Pressable
              style={({ pressed }) => [styles.editStandsButton, pressed && styles.pressed]}
              onPress={() => {
                setEditingStands(true);
                setStandSaveMessage("");
              }}
            >
              <Text style={styles.editStandsButtonText}>Edit Names</Text>
            </Pressable>
          )}
        </View>

        {editingStands ? (
          <>
            <Text style={styles.standHelperText}>
              Add the stand names your camp actually uses. Save them once, then reuse them every time you log sightings.
            </Text>

            <View style={styles.standSetupGrid}>
              {standNameInputs.map((name, index) => (
                <View key={`stand-input-${index + 1}`} style={styles.standInputSlot}>
                  <Text style={styles.standInputLabel}>Stand {index + 1}</Text>
                  <TextInput
                    value={name}
                    placeholder="Text Input"
                    placeholderTextColor="rgba(255,255,255,0.42)"
                    autoCapitalize="words"
                    autoCorrect={false}
                    returnKeyType="done"
                    style={styles.standInput}
                    onChangeText={(value) => updateStandName(index, value)}
                  />
                </View>
              ))}
            </View>

            <Pressable
              style={({ pressed }) => [styles.saveStandsButton, pressed && styles.pressed]}
              onPress={handleSaveStands}
            >
              <Text style={styles.saveStandsButtonText}>Save Stands</Text>
            </Pressable>
          </>
        ) : (
          <>
            {!!standSaveMessage && <Text style={styles.standSaveMessage}>{standSaveMessage}</Text>}
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
                    onPress={() => selectStand(stand)}
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
          </>
        )}
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
                onPress={() => selectStatType(statType)}
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
              sightingCount <= 0 && styles.disabled,
              pressed && styles.pressed,
            ]}
            disabled={saving || sightingCount <= 0}
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

        <Text style={styles.saveHint}>
          Set the number seen, including zero when you saw none, then save once for each sighting type you counted.
        </Text>

        {!!unsavedWarning && (
          <Text style={styles.unsavedWarning}>{unsavedWarning}</Text>
        )}

        <Animated.View
          style={[
            styles.saveButtonPulseWrap,
            { transform: [{ scale: saveButtonScale }] },
          ]}
        >
          <Pressable
            style={({ pressed }) => [
              styles.saveButton,
              pressed && styles.pressed,
              (saving || !selectedStand || !countReadyToSave) && styles.disabled,
            ]}
            disabled={saving || !selectedStand || !countReadyToSave}
            onPress={saveSighting}
          >
            {saving ? (
              <ActivityIndicator color="#0B0E12" />
            ) : (
              <Text style={styles.saveButtonText}>Save This Count</Text>
            )}
          </Pressable>
        </Animated.View>

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

      <View style={styles.summaryCard}>
        <Text style={styles.cardKicker}>CSM Sync Status</Text>
        <Text style={styles.syncStatusHeadline}>
          {syncingStats ? "Syncing..." : syncMessage || "Saved locally until sync runs."}
        </Text>

        <View style={styles.summaryGrid}>
          <View style={styles.summaryPill}>
            <Text style={styles.summaryPillNumber}>{syncSummary.pending}</Text>
            <Text style={styles.summaryPillLabel}>Pending</Text>
          </View>
          <View style={styles.summaryPill}>
            <Text style={styles.summaryPillNumber}>{syncSummary.synced}</Text>
            <Text style={styles.summaryPillLabel}>Synced</Text>
          </View>
          <View style={styles.summaryPill}>
            <Text style={styles.summaryPillNumber}>{syncSummary.failed}</Text>
            <Text style={styles.summaryPillLabel}>Retry</Text>
          </View>
          <View style={styles.summaryPill}>
            <Text style={styles.summaryPillNumber}>{syncSummary.syncing}</Text>
            <Text style={styles.summaryPillLabel}>Syncing</Text>
          </View>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.logAnotherButton,
            pressed && styles.pressed,
            syncingStats && styles.disabled,
          ]}
          disabled={syncingStats}
          onPress={() => attemptSyncCampStats(activeCampId)}
        >
          <Text style={styles.logAnotherButtonText}>
            {syncingStats ? "Syncing CSM Counts..." : "Sync CSM Counts"}
          </Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.clearTestDataButton,
            pressed && styles.pressed,
            syncingStats && styles.disabled,
          ]}
          disabled={syncingStats}
          onPress={handleClearLocalCsmTestData}
        >
          <Text style={styles.clearTestDataButtonText}>Clear Local CSM Test Data</Text>
        </Pressable>
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
    marginBottom: 0,
  },

  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 12,
  },

  editStandsButton: {
    minHeight: 36,
    borderRadius: 999,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },

  editStandsButtonText: {
    color: "white",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },

  standHelperText: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 20,
    marginBottom: 14,
  },

  standSetupGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },

  standInputSlot: {
    flexGrow: 1,
    flexBasis: "47%",
    minWidth: 140,
  },

  standInputLabel: {
    color: "rgba(255,255,255,0.62)",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 6,
  },

  standInput: {
    minHeight: 50,
    borderRadius: 16,
    paddingHorizontal: 13,
    color: "white",
    fontSize: 15,
    fontWeight: "900",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },

  saveStandsButton: {
    minHeight: 54,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "white",
    marginTop: 14,
  },

  saveStandsButtonText: {
    color: "#0B0E12",
    fontSize: 16,
    fontWeight: "900",
  },

  standSaveMessage: {
    color: "#D0B17A",
    fontSize: 14,
    fontWeight: "900",
    lineHeight: 20,
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

  saveHint: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 20,
    marginBottom: 10,
    textAlign: "center",
  },

  unsavedWarning: {
    marginBottom: 12,
    color: "#FFDFA8",
    fontSize: 14,
    fontWeight: "900",
    lineHeight: 20,
    textAlign: "center",
  },

  saveButtonPulseWrap: {
    borderRadius: 999,
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

  clearTestDataButton: {
    marginTop: 10,
    minHeight: 44,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
  },

  clearTestDataButtonText: {
    color: "rgba(255,255,255,0.68)",
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0.8,
    textTransform: "uppercase",
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

  syncStatusHeadline: {
    color: "rgba(255,255,255,0.82)",
    fontSize: 15,
    fontWeight: "800",
    lineHeight: 22,
    marginBottom: 14,
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
