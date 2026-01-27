import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import AppButton from "@/components/AppButton";
import { BOTTOM_NAV_BASE_HEIGHT } from "@/components/BottomNav";

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const bottomPad = BOTTOM_NAV_BASE_HEIGHT + insets.bottom + 12;

  return (
    <View style={[styles.container, { paddingBottom: bottomPad }]}>
      <Text style={styles.title}>DeerCamp</Text>
      <Text style={styles.subtitle}>Your camp journal</Text>

      <View style={styles.cover}>
        <Text style={styles.coverTitle}>DeerCamp Cover Photo</Text>
        <Text style={styles.coverHint}>(tap to add a warm camp image)</Text>
      </View>

      <Text style={styles.quickTitle}>Quick actions</Text>

      <View style={styles.actionRow}>
        <AppButton
          label="Camp Feed"
          onPress={() => router.push("/feed")}
          compact
          style={{ flex: 1 }}
        />
        <AppButton
          label="+ Add Memory"
          onPress={() => router.push("/new-entry")}
          compact
          style={{ flex: 1 }}
        />
      </View>

      <View style={styles.spacer} />

      <AppButton
        label="My Profile"
        onPress={() => router.push("/profile")}
        secondary
        compact
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },

  title: {
    fontSize: 32,
    fontWeight: "900",
  },

  subtitle: {
    fontSize: 18,
    color: "#666",
    marginBottom: 10,
  },

  cover: {
    borderWidth: 2,
    borderColor: "#ddd",
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: "center",
    marginBottom: 12,
  },

  coverTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#888",
    textAlign: "center",
  },

  coverHint: {
    fontSize: 14,
    color: "#aaa",
    marginTop: 6,
    textAlign: "center",
  },

  quickTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#666",
    marginBottom: 8,
  },

  actionRow: {
    flexDirection: "row",
    gap: 12,
  },

  spacer: {
    flex: 1,
  },
});
