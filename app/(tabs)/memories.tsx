import React, { useCallback, useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";

import { auth } from "@/lib/firebase";
import { getLocalMemories, type LocalMemoryItem } from "@/lib/localMemories";

type EntryItem = {
  id: string;
  title?: string;
  details?: string;
  clientCreatedAt?: number;
  authorName?: string;
  photoUrl?: string;
  photoUri?: string;
  voiceUrl?: string;
  voiceUri?: string;
  audioUri?: string;
  syncStatus?: "pending" | "publishing" | "synced" | "failed";
  isLocal?: boolean;
};

function toSortMs(item: EntryItem) {
  return item.clientCreatedAt ?? 0;
}

function formatWhen(item: EntryItem) {
  if (item.clientCreatedAt) return new Date(item.clientCreatedAt).toLocaleString();
  return "";
}

export default function MemoriesScreen() {
  const router = useRouter();
  const [localItems, setLocalItems] = useState<EntryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const user = auth.currentUser;

  const goAdd = useCallback(() => {
    router.push("/field");
  }, [router]);

  const loadLocal = useCallback(async () => {
    if (!user?.uid) {
      setLocalItems([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const next = await getLocalMemories(user.uid);
      const mapped: EntryItem[] = next.map((item: LocalMemoryItem) => ({
        ...item,
        isLocal: true,
      }));

      mapped.sort((a, b) => toSortMs(b) - toSortMs(a));
      setLocalItems(mapped);
    } catch (error) {
      console.error("loadLocal memories failed:", error);
      setLocalItems([]);
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  useFocusEffect(
    useCallback(() => {
      loadLocal();
    }, [loadLocal])
  );

  const items = useMemo(() => {
    const merged = [...localItems];
    merged.sort((a, b) => toSortMs(b) - toSortMs(a));
    return merged;
  }, [localItems]);

  const showEmpty = useMemo(() => !loading && items.length === 0, [loading, items.length]);

  const renderItem = ({ item }: { item: EntryItem }) => {
    const title = item.title?.trim() || "(Untitled)";
    const details = (item.details || "").trim();

    const statusLabel =
      item.syncStatus === "publishing"
        ? "Publishing"
        : item.syncStatus === "synced"
        ? "Published to Feed"
        : item.syncStatus === "failed"
        ? "Publish failed"
        : "Saved locally";

    const metaBits = [
      statusLabel,
      formatWhen(item),
      item.photoUrl || item.photoUri ? "📷" : "",
      item.voiceUrl || item.voiceUri || item.audioUri ? "🎙️" : "",
    ].filter(Boolean);

    return (
      <Pressable
        style={styles.card}
        onPress={() => {
          router.push(`/entry/local/${item.id}`);
        }}
      >
        <View style={styles.cardTopRow}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.cardMeta} numberOfLines={1}>
            {metaBits.join(" • ")}
          </Text>
        </View>

        {details.length > 0 ? (
          <Text style={styles.cardBody} numberOfLines={2}>
            {details}
          </Text>
        ) : (
          <Text style={styles.cardBodyMuted} numberOfLines={1}>
            Saved on device
          </Text>
        )}
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Memories</Text>

      {showEmpty ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyTitle}>No memories yet</Text>
          <Text style={styles.emptyText}>
            Tap Add Memory to save your first field photo or note.
          </Text>

          <Pressable style={styles.addBtn} onPress={goAdd}>
            <Ionicons name="add" size={22} color="#0B0E12" />
            <Text style={styles.addBtnText}>Add Memory</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(m) => m.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ListFooterComponent={<View style={{ height: 90 }} />}
        />
      )}

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

  emptyWrap: { flex: 1, alignItems: "center", justifyContent: "center", paddingBottom: 40 },
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

  listContent: { paddingTop: 6 },

  card: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },

  cardTopRow: { flexDirection: "row", justifyContent: "space-between", gap: 10 },
  cardTitle: { color: "white", fontSize: 16, fontWeight: "900", flex: 1 },
  cardMeta: { color: "rgba(255,255,255,0.5)", fontSize: 12, fontWeight: "700" },
  cardBody: {
    color: "rgba(255,255,255,0.8)",
    marginTop: 6,
    lineHeight: 18,
    fontWeight: "700",
  },
  cardBodyMuted: { color: "rgba(255,255,255,0.45)", marginTop: 6, fontWeight: "700" },

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
