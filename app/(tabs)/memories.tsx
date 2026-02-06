// app/(tabs)/memories.tsx
import React, { useCallback } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

export default function MemoriesScreen() {
  const router = useRouter();

  const goAdd = useCallback(() => {
    // Same destination as Home -> "MY MOMENT"
    router.push("/field");
  }, [router]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Memories</Text>

      <View style={styles.emptyWrap}>
        <Text style={styles.emptyTitle}>No memories yet</Text>
        <Text style={styles.emptyText}>
          Tap + Add to post your first one.
        </Text>

        <Pressable style={styles.addBtn} onPress={goAdd}>
          <Ionicons name="add" size={22} color="#0B0E12" />
          <Text style={styles.addBtnText}>Add Memory</Text>
        </Pressable>

        <Text style={styles.hint}>
          This opens Field Mode (camera capture).
        </Text>
      </View>

      {/* Floating + button (useful later even when list exists) */}
      <Pressable style={styles.fab} onPress={goAdd} accessibilityLabel="Add Memory">
        <Ionicons name="add" size={28} color="#0B0E12" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0B0E12", padding: 16 },

  title: {
    color: "white",
    fontSize: 34,
    fontWeight: "900",
    marginTop: 8,
    marginBottom: 10,
    letterSpacing: -0.4,
  },

  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 40,
  },

  emptyTitle: { color: "white", fontSize: 18, fontWeight: "900", marginBottom: 8 },

  emptyText: {
    color: "rgba(255,255,255,0.7)",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 18,
    paddingHorizontal: 24,
    fontWeight: "700",
  },

  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "white",
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 16,
    minWidth: 220,
    justifyContent: "center",
  },
  addBtnText: { color: "#0B0E12", fontSize: 16, fontWeight: "900" },

  hint: {
    marginTop: 12,
    color: "rgba(255,255,255,0.55)",
    fontSize: 12,
    fontWeight: "700",
  },

  fab: {
    position: "absolute",
    right: 16,
    bottom: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "white",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
});
