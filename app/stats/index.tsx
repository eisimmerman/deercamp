// app/stats/index.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { auth } from "@/lib/firebase";
import { getActiveCampId, getActiveCampName } from "@/lib/localMemories";
import {
  DEFAULT_STAND_NAMES,
  getLastStatsStandName,
  getLocalStatsEntries,
  getSavedStandNames,
  saveLocalStatsEntry,
  saveStandName,
  setLastStatsStandName,
  type HuntSession,
} from "@/lib/localStats";

function suggestSession(): HuntSession {
  return new Date().getHours() < 12 ? "AM" : "PM";
}

function todayKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function clampCount(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(99, Math.round(value)));
}

export default function CampStatsManagerScreen() {
  const router = useRouter();
  const scheme = useColorScheme();
  const isLight = scheme === "light";
  const user = auth.currentUser;

  const [campId, setCampId] = useState("");
  const [campName, setCampName] = useState("Camp Swede");
  const [standNames, setStandNames] = useState<string[]>(DEFAULT_STAND_NAMES);
  const [selectedStand, setSelectedStand] = useState(DEFAULT_STAND_NAMES[0]);
  const [newStandName, setNewStandName] = useState("");
  const [showStandList, setShowStandList] = useState(false);
  const [session, setSession] = useState<HuntSession>(suggestSession());
  const [buckCount, setBuckCount] = useState(0);
  const [doeCount, setDoeCount] = useState(0);
  const [todayTotal, setTodayTotal] = useState(0);
  const [seasonTotal, setSeasonTotal] = useState(0);

  const theme = {
    screen: isLight ? "#F2E8D5" : "#050608",
    card: isLight ? "rgba(255,255,255,0.78)" : "rgba(255,255,255,0.06)",
    cardStrong: isLight ? "#FFF7EA" : "#11161D",
    border: isLight ? "rgba(63,43,26,0.18)" : "rgba(255,255,255,0.12)",
    text: isLight ? "#1B120C" : "white",
    muted: isLight ? "rgba(27,18,12,0.68)" : "rgba(255,255,255,0.66)",
    action: isLight ? "#3D2A17" : "white",
    actionText: isLight ? "white" : "#0B0E12",
    gold: "#D0B17A",
  };

  useEffect(() => {
    let alive = true;

    void (async () => {
      const activeCampId = await getActiveCampId();
      const activeCampName = await getActiveCampName(activeCampId);
      const savedStands = await getSavedStandNames();
      const lastStand = await getLastStatsStandName();
      const entries = await getLocalStatsEntries();

      if (!alive) return;

      const names = savedStands.length ? savedStands : DEFAULT_STAND_NAMES;
      setCampId(activeCampId);
      setCampName(activeCampName || "Camp Swede");
      setStandNames(names);
      setSelectedStand(lastStand && names.includes(lastStand) ? lastStand : names[0] || DEFAULT_STAND_NAMES[0]);

      const today = todayKey();
      setTodayTotal(entries.filter((entry) => entry.huntDate === today).reduce((sum, entry) => sum + entry.totalSightings, 0));
      setSeasonTotal(entries.reduce((sum, entry) => sum + entry.totalSightings, 0));
    })();

    return () => {
      alive = false;
    };
  }, []);

  const effectiveStandName = useMemo(() => newStandName.trim() || selectedStand.trim(), [newStandName, selectedStand]);
  const canSubmit = !!effectiveStandName && !!user && (buckCount > 0 || doeCount > 0);

  async function chooseStand(name: string) {
    setSelectedStand(name);
    setNewStandName("");
    setShowStandList(false);
    await setLastStatsStandName(name);
  }

  async function onSubmit() {
    if (!canSubmit || !user) {
      Alert.alert("Nothing to submit", "Choose a stand and enter at least one buck or doe sighting.");
      return;
    }

    const cleanStand = effectiveStandName.trim();
    const cleanBuck = clampCount(buckCount);
    const cleanDoe = clampCount(doeCount);
    const total = cleanBuck + cleanDoe;

    await saveStandName(cleanStand);
    await setLastStatsStandName(cleanStand);

    await saveLocalStatsEntry({
      id: `stats-${user.uid}-${Date.now()}`,
      campId,
      campName,
      standName: cleanStand,
      huntDate: todayKey(),
      session,
      buckCount: cleanBuck,
      doeCount: cleanDoe,
      totalSightings: total,
      submittedAt: Date.now(),
      authorId: user.uid,
      authorName: user.displayName?.trim() || user.email?.trim() || "DeerCamp Member",
      syncStatus: "pending",
    });

    setTodayTotal((current) => current + total);
    setSeasonTotal((current) => current + total);
    setBuckCount(0);
    setDoeCount(0);
    setSelectedStand(cleanStand);
    setNewStandName("");
    setStandNames(await getSavedStandNames());

    Alert.alert("Session saved", `${session} sit saved for ${cleanStand}: ${cleanBuck} buck${cleanBuck === 1 ? "" : "s"}, ${cleanDoe} doe${cleanDoe === 1 ? "" : "s"}.`);
  }

  function CountControl({ label, value, onChange }: { label: string; value: number; onChange: (next: number) => void }) {
    return (
      <View style={[styles.countCard, { backgroundColor: theme.cardStrong, borderColor: theme.border }]}>
        <Text style={[styles.countLabel, { color: theme.text }]}>{label}</Text>
        <View style={styles.countRow}>
          <Pressable
            style={({ pressed }) => [styles.countBtn, { backgroundColor: theme.action }, pressed && styles.pressed]}
            onPress={() => onChange(clampCount(value - 1))}
          >
            <Text style={[styles.countBtnText, { color: theme.actionText }]}>−</Text>
          </Pressable>

          <Text style={[styles.countValue, { color: theme.text }]}>{value}</Text>

          <Pressable
            style={({ pressed }) => [styles.countBtn, { backgroundColor: theme.gold }, pressed && styles.pressed]}
            onPress={() => onChange(clampCount(value + 1))}
          >
            <Text style={styles.countBtnGoldText}>+</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={[styles.screen, { backgroundColor: theme.screen }]} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.topRow}>
        <Pressable style={[styles.backBtn, { backgroundColor: theme.card, borderColor: theme.border }]} onPress={() => router.replace("/")}>
          <Ionicons name="arrow-back" size={20} color={theme.text} />
          <Text style={[styles.backText, { color: theme.text }]}>Back</Text>
        </Pressable>

        <View style={[styles.visibilityPill, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Ionicons name={isLight ? "sunny-outline" : "moon-outline"} size={17} color={theme.text} />
          <Text style={[styles.visibilityText, { color: theme.muted }]}>{isLight ? "Daylight" : "Low Light"}</Text>
        </View>
      </View>

      <Text style={[styles.title, { color: theme.text }]}>Camp Stats Manager</Text>
      <Text style={[styles.subtitle, { color: theme.muted }]}>Big-button sighting logs for cold hands, gloves, and quick lunch-break entry.</Text>

      <View style={[styles.summaryCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View>
          <Text style={[styles.summaryLabel, { color: theme.muted }]}>Current Camp</Text>
          <Text style={[styles.summaryValue, { color: theme.text }]}>{campName}</Text>
        </View>
        <View style={styles.summaryTotals}>
          <View>
            <Text style={[styles.summaryLabel, { color: theme.muted }]}>Today</Text>
            <Text style={[styles.summaryNumber, { color: theme.text }]}>{todayTotal}</Text>
          </View>
          <View>
            <Text style={[styles.summaryLabel, { color: theme.muted }]}>Season</Text>
            <Text style={[styles.summaryNumber, { color: theme.text }]}>{seasonTotal}</Text>
          </View>
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Text style={[styles.label, { color: theme.text }]}>Stand</Text>

        <Pressable style={[styles.dropdownBtn, { backgroundColor: theme.cardStrong, borderColor: theme.border }]} onPress={() => setShowStandList((current) => !current)}>
          <Text style={[styles.dropdownText, { color: theme.text }]}>{selectedStand}</Text>
          <Ionicons name={showStandList ? "chevron-up" : "chevron-down"} size={24} color={theme.text} />
        </Pressable>

        {showStandList ? (
          <View style={styles.standList}>
            {standNames.map((name) => (
              <Pressable key={name} style={[styles.standOption, { backgroundColor: theme.cardStrong, borderColor: theme.border }]} onPress={() => chooseStand(name)}>
                <Text style={[styles.standOptionText, { color: theme.text }]}>{name}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        <Text style={[styles.orText, { color: theme.muted }]}>or enter a new stand</Text>
        <TextInput
          value={newStandName}
          onChangeText={setNewStandName}
          placeholder="New stand name"
          placeholderTextColor={isLight ? "rgba(27,18,12,0.38)" : "rgba(255,255,255,0.38)"}
          style={[styles.input, { color: theme.text, backgroundColor: theme.cardStrong, borderColor: theme.border }]}
          autoCapitalize="words"
          returnKeyType="done"
        />
      </View>

      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Text style={[styles.label, { color: theme.text }]}>Session</Text>
        <View style={styles.sessionRow}>
          {(["AM", "PM"] as HuntSession[]).map((item) => {
            const active = session === item;
            return (
              <Pressable
                key={item}
                style={[styles.sessionBtn, { backgroundColor: active ? theme.gold : theme.cardStrong, borderColor: active ? theme.gold : theme.border }]}
                onPress={() => setSession(item)}
              >
                <Text style={[styles.sessionText, { color: active ? "#0B0E12" : theme.text }]}>{item} SIT</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <CountControl label="BUCKS" value={buckCount} onChange={setBuckCount} />
      <CountControl label="DOES" value={doeCount} onChange={setDoeCount} />

      <Pressable style={[styles.submitBtn, { backgroundColor: canSubmit ? theme.gold : "rgba(255,255,255,0.18)" }]} disabled={!canSubmit} onPress={onSubmit}>
        <Text style={[styles.submitText, { color: canSubmit ? "#0B0E12" : theme.muted }]}>SUBMIT {session} SIT</Text>
      </Pressable>

      <Text style={[styles.helperText, { color: theme.muted }]}>Saved offline first. Sync/reporting will run behind the curtain when DeerCamp service is available.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 32 },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  backBtn: { minHeight: 50, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  backText: { fontSize: 15, fontWeight: "900" },
  visibilityPill: { minHeight: 42, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 7 },
  visibilityText: { fontSize: 12, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.7 },
  title: { fontSize: 34, lineHeight: 38, fontWeight: "900", letterSpacing: -0.6 },
  subtitle: { marginTop: 8, fontSize: 15, fontWeight: "800", lineHeight: 22 },
  summaryCard: { marginTop: 16, borderWidth: 1, borderRadius: 20, padding: 14, flexDirection: "row", justifyContent: "space-between", gap: 12 },
  summaryLabel: { fontSize: 11, fontWeight: "900", letterSpacing: 1.2, textTransform: "uppercase" },
  summaryValue: { fontSize: 20, fontWeight: "900", marginTop: 3 },
  summaryTotals: { flexDirection: "row", gap: 20 },
  summaryNumber: { fontSize: 24, fontWeight: "900", marginTop: 1, textAlign: "center" },
  card: { marginTop: 14, borderWidth: 1, borderRadius: 22, padding: 14 },
  label: { fontSize: 19, fontWeight: "900", marginBottom: 10 },
  dropdownBtn: { minHeight: 68, borderWidth: 1, borderRadius: 18, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  dropdownText: { fontSize: 20, fontWeight: "900" },
  standList: { gap: 8, marginTop: 10 },
  standOption: { minHeight: 58, borderWidth: 1, borderRadius: 16, paddingHorizontal: 14, justifyContent: "center" },
  standOptionText: { fontSize: 18, fontWeight: "900" },
  orText: { marginTop: 14, marginBottom: 8, fontSize: 13, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.8 },
  input: { minHeight: 64, borderWidth: 1, borderRadius: 18, paddingHorizontal: 16, fontSize: 19, fontWeight: "900" },
  sessionRow: { flexDirection: "row", gap: 10 },
  sessionBtn: { flex: 1, minHeight: 72, borderWidth: 2, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  sessionText: { fontSize: 20, fontWeight: "900" },
  countCard: { marginTop: 14, borderWidth: 1, borderRadius: 24, padding: 16 },
  countLabel: { fontSize: 24, fontWeight: "900", letterSpacing: 1.5, textAlign: "center", marginBottom: 14 },
  countRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  countBtn: { width: 92, height: 86, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  countBtnText: { fontSize: 46, fontWeight: "900", marginTop: -4 },
  countBtnGoldText: { color: "#0B0E12", fontSize: 42, fontWeight: "900", marginTop: -2 },
  countValue: { minWidth: 90, textAlign: "center", fontSize: 56, fontWeight: "900" },
  pressed: { opacity: 0.84, transform: [{ scale: 0.98 }] },
  submitBtn: { minHeight: 84, borderRadius: 24, alignItems: "center", justifyContent: "center", marginTop: 18 },
  submitText: { fontSize: 23, fontWeight: "900", letterSpacing: 0.5 },
  helperText: { marginTop: 12, textAlign: "center", fontSize: 13, lineHeight: 19, fontWeight: "800" },
});
