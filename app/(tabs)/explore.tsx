// app/(tabs)/explore.tsx
import React, { useCallback, useState } from "react";
import { Alert, ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";

import AppButton from "../../components/AppButton";

export default function ExploreScreen() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const onNewMemory = useCallback(async () => {
    if (saving) return;

    try {
      setSaving(true);

      // Journal capture system isn’t present in the repo right now.
      // Keep the UI stable and route the user to the existing flow instead.
      Alert.alert(
        "Coming next",
        "Quick-capture isn’t wired yet. For now, use the existing Memories flow."
      );

      // Safe default navigation (won’t crash if route exists)
      router.push("/(tabs)/memories");
    } finally {
      setSaving(false);
    }
  }, [saving, router]);

  return (
    <View style={styles.container}>
      <Text style={styles.h1}>Explore</Text>
      <Text style={styles.sub}>
        If you can see this, the Explore tab is stable on Android.
      </Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Quick Actions</Text>

        <AppButton
          label="View Memories"
          onPress={() => router.push("/(tabs)/memories")}
          compact
          style={{ marginTop: 12 }}
        />

        <AppButton
          label={saving ? "Working…" : "+ New Memory"}
          onPress={onNewMemory}
          secondary
          compact
          style={{ marginTop: 12 }}
        />

        {saving ? (
          <View style={styles.savingRow}>
            <ActivityIndicator />
            <Text style={styles.savingText}>Opening…</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#000", gap: 12 },
  h1: { fontSize: 40, fontWeight: "900", color: "#fff", marginTop: 10 },
  sub: { fontSize: 16, color: "#aaa", lineHeight: 22 },
  card: {
    marginTop: 10,
    borderWidth: 2,
    borderColor: "#222",
    borderRadius: 18,
    padding: 14,
    backgroundColor: "#0b0b0b",
  },
  cardTitle: { fontSize: 18, fontWeight: "900", color: "#fff" },

  savingRow: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  savingText: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 12,
    fontWeight: "700",
  },
});
