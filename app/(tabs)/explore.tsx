// app/(tabs)/explore.tsx
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";

import AppButton from "@/components/AppButton";

export default function ExploreScreen() {
  const router = useRouter();

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
          label="New Entry"
          onPress={() => router.push("/new-entry")}
          secondary
          compact
          style={{ marginTop: 12 }}
        />
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
});
