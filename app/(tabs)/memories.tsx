import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";

import { auth } from "@/lib/firebase";
import { getLocalMemories, type LocalMemoryItem } from "@/lib/localMemories";
import {
  getUploadQueueTotals,
  getUploadQueueStatusLabel,
  type UploadQueueTotals,
} from "@/lib/capture/uploadQueueState";
import { processUploadQueueOnce } from "@/lib/capture/uploadWorker";

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

const emptyUploadTotals: UploadQueueTotals = {
  total: 0,
  pending: 0,
  uploading: 0,
  uploaded: 0,
  failed: 0,
};

export default function MemoriesScreen() {
  const router = useRouter();
  const user = auth.currentUser;

  const processingUploadsRef = useRef(false);

  const [localItems, setLocalItems] = useState<EntryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadTotals, setUploadTotals] =
    useState<UploadQueueTotals>(emptyUploadTotals);
  const [retryingUploads, setRetryingUploads] = useState(false);

  const goAdd = useCallback(() => {
    router.push("/field");
  }, [router]);

  const refreshUploadTotals = useCallback(async () => {
    const totals = await getUploadQueueTotals();
    setUploadTotals(totals);
    return totals;
  }, []);

  const loadLocal = useCallback(
    async (showLoading = true) => {
      if (!user?.uid) {
        setLocalItems([]);
        setUploadTotals(emptyUploadTotals);
        setLoading(false);
        return;
      }

      try {
        if (showLoading) setLoading(true);

        const next = await getLocalMemories(user.uid);
        const mapped: EntryItem[] = next.map((item: LocalMemoryItem) => ({
          ...item,
          isLocal: true,
        }));

        mapped.sort((a, b) => toSortMs(b) - toSortMs(a));
        setLocalItems(mapped);

        await refreshUploadTotals();
      } catch (error) {
        console.error("loadLocal memories failed:", error);
        setLocalItems([]);
      } finally {
        if (showLoading) setLoading(false);
      }
    },
    [refreshUploadTotals, user?.uid]
  );

  const runUploadPass = useCallback(
    async (mode: "auto" | "manual" = "auto") => {
      if (processingUploadsRef.current) return;

      try {
        processingUploadsRef.current = true;

        const before = await refreshUploadTotals();

        const shouldProcess =
          before.pending > 0 || before.failed > 0 || before.uploading > 0;

        if (!shouldProcess) return;

        // If Firebase/Storage is already actively uploading and there are no queued
        // or failed items yet, let that active attempt finish before starting another pass.
        if (before.uploading > 0 && before.pending === 0 && before.failed === 0) {
          return;
        }

        await processUploadQueueOnce(mode === "manual" ? 10 : 10);

        const after = await refreshUploadTotals();

        if (
          after.pending === 0 &&
          after.uploading === 0 &&
          after.failed === 0
        ) {
          await loadLocal(false);
        }
      } catch (error) {
        console.error("field upload pass failed:", error);
        await refreshUploadTotals();
      } finally {
        processingUploadsRef.current = false;
      }
    },
    [loadLocal, refreshUploadTotals]
  );

  const retryUploads = useCallback(async () => {
    if (retryingUploads) return;

    try {
      setRetryingUploads(true);
      await runUploadPass("manual");
    } finally {
      setRetryingUploads(false);
    }
  }, [retryingUploads, runUploadPass]);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      void (async () => {
        await loadLocal(true);
        if (active) {
          void runUploadPass("auto");
        }
      })();

      const interval = setInterval(() => {
        if (active) {
          void runUploadPass("auto");
        }
      }, 5000);

      return () => {
        active = false;
        clearInterval(interval);
      };
    }, [loadLocal, runUploadPass])
  );

  const items = useMemo(() => {
    const merged = [...localItems];
    merged.sort((a, b) => toSortMs(b) - toSortMs(a));
    return merged;
  }, [localItems]);

  const showEmpty = useMemo(
    () => !loading && items.length === 0,
    [loading, items.length]
  );

  const uploadStatusLabel = getUploadQueueStatusLabel(uploadTotals);
  const hasRetryableUploads = uploadTotals.failed > 0 || uploadTotals.pending > 0;
  const uploadBusy = uploadTotals.uploading > 0 || uploadTotals.pending > 0;

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

      <View style={styles.uploadCard}>
        <View style={styles.uploadHeaderRow}>
          <Text style={styles.uploadTitle}>Field Uploads</Text>

          <View style={styles.uploadHeaderRight}>
            {uploadBusy ? <ActivityIndicator size="small" color="#F9A825" /> : null}

            <View
              style={[
                styles.uploadStatusDot,
                uploadTotals.failed > 0
                  ? styles.uploadDotFailed
                  : uploadTotals.uploading > 0 || uploadTotals.pending > 0
                  ? styles.uploadDotUploading
                  : styles.uploadDotGood,
              ]}
            />
          </View>
        </View>

        <Text style={styles.uploadStatusText}>{uploadStatusLabel}</Text>

        <View style={styles.uploadStatsRow}>
          <Text style={styles.uploadStat}>Queued: {uploadTotals.pending}</Text>
          <Text style={styles.uploadStat}>
            Uploading: {uploadTotals.uploading}
          </Text>
          <Text style={styles.uploadStat}>Failed: {uploadTotals.failed}</Text>
        </View>

        {uploadBusy ? (
          <Text style={styles.uploadHelperText}>
            DeerCamp is finishing uploads in the background.
          </Text>
        ) : null}

        {hasRetryableUploads ? (
          <Pressable
            style={[styles.retryBtn, retryingUploads && styles.retryBtnDisabled]}
            onPress={retryUploads}
            disabled={retryingUploads}
          >
            {retryingUploads ? (
              <ActivityIndicator color="#0B0E12" />
            ) : (
              <Text style={styles.retryBtnText}>
                {uploadTotals.failed > 0 ? "Retry Uploads" : "Upload Now"}
              </Text>
            )}
          </Pressable>
        ) : null}
      </View>

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

  uploadCard: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
  },

  uploadHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },

  uploadHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  uploadTitle: {
    color: "white",
    fontSize: 16,
    fontWeight: "900",
  },

  uploadStatusText: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 10,
  },

  uploadStatsRow: {
    flexDirection: "row",
    gap: 12,
    flexWrap: "wrap",
  },

  uploadStat: {
    color: "rgba(255,255,255,0.92)",
    fontSize: 12,
    fontWeight: "800",
  },

  uploadHelperText: {
    marginTop: 10,
    color: "rgba(255,255,255,0.55)",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18,
  },

  uploadStatusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },

  uploadDotGood: {
    backgroundColor: "#2E7D32",
  },

  uploadDotUploading: {
    backgroundColor: "#F9A825",
  },

  uploadDotFailed: {
    backgroundColor: "#C62828",
  },

  retryBtn: {
    backgroundColor: "white",
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },

  retryBtnDisabled: {
    opacity: 0.55,
  },

  retryBtnText: {
    color: "#0B0E12",
    fontSize: 15,
    fontWeight: "900",
  },

  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 40,
  },

  emptyTitle: {
    color: "white",
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 8,
  },

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

  cardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },

  cardTitle: {
    color: "white",
    fontSize: 16,
    fontWeight: "900",
    flex: 1,
  },

  cardMeta: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 12,
    fontWeight: "700",
  },

  cardBody: {
    color: "rgba(255,255,255,0.8)",
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
  },

  cardBodyMuted: {
    color: "rgba(255,255,255,0.45)",
    marginTop: 6,
    fontSize: 14,
    fontWeight: "700",
  },

  fab: {
    position: "absolute",
    right: 18,
    bottom: 24,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "white",
    alignItems: "center",
    justifyContent: "center",
  },
});