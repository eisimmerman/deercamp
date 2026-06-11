// app/(tabs)/memories.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";

import { auth } from "@/lib/firebase";
import {
  getLocalMemories,
  removeLocalMemory,
  hasConfirmedCampFeedPublish,
  type LocalMemoryItem,
} from "@/lib/localMemories";
import {
  getUploadQueueTotals,
  type UploadQueueTotals,
} from "@/lib/capture/uploadQueueState";
import {
  removeUploadQueueItemsForMemory,
  resetFailedUploadQueueItemsForMemory,
} from "@/lib/capture/uploadQueue";
import { processUploadQueueOnce } from "@/lib/capture/uploadWorker";

type EntryItem = LocalMemoryItem & {
  isLocal?: boolean;
};

function toSortMs(item: EntryItem) {
  return item.clientCreatedAt ?? 0;
}

function formatWhen(item: EntryItem) {
  if (item.clientCreatedAt) return new Date(item.clientCreatedAt).toLocaleString();
  return "";
}

function isConfirmedPublished(item?: EntryItem | null) {
  return hasConfirmedCampFeedPublish(item);
}

function getMemorySummary(item: EntryItem) {
  if (item.type === "photo") {
    if (isConfirmedPublished(item)) return "Photo published to CampFeed. Saved locally as backup.";
    if (item.syncStatus === "synced") return "Photo saved locally. Publish confirmation is missing. Tap Retry Publish.";
    if (item.syncStatus === "publishing") return "Photo is publishing to CampFeed. Saved locally as backup.";
    if (item.syncStatus === "failed") return "Photo saved locally. Publish needs retry when connected.";
    return "Photo saved locally. DeerCamp will publish it when service is available.";
  }

  if (item.type === "fieldMemory") {
    if (isConfirmedPublished(item)) return "Photo + voice published to CampFeed. Saved locally as backup.";
    if (item.syncStatus === "synced") return "Photo + voice saved locally. Publish confirmation is missing. Tap Retry Publish.";
    if (item.syncStatus === "publishing") return "Field Memory is publishing to CampFeed. Saved locally as backup.";
    if (item.syncStatus === "failed") return "Field Memory saved locally. Publish needs retry when connected.";
    return "Photo + voice saved locally. DeerCamp will publish it when service is available.";
  }

  return item.details?.trim() || "Saved locally.";
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
  const autoUploadRunningRef = useRef(false);

  const [localItems, setLocalItems] = useState<EntryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadTotals, setUploadTotals] =
    useState<UploadQueueTotals>(emptyUploadTotals);
  const [uploadingFieldMemories, setUploadingFieldMemories] = useState(false);
  const [showDeferredUploadMessage, setShowDeferredUploadMessage] = useState(false);
  const [uploadBusySinceMs, setUploadBusySinceMs] = useState<number | null>(null);
  const [uploadBusyKey, setUploadBusyKey] = useState<string | null>(null);
  const silentPublishRef = useRef(false);

  const goAdd = useCallback(() => {
    router.replace("/(tabs)");
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

  const runUploadPass = useCallback(async () => {
    if (processingUploadsRef.current) return;

    try {
      processingUploadsRef.current = true;

      const before = await refreshUploadTotals();
      const shouldProcess = before.pending > 0 || before.failed > 0;

      if (!shouldProcess) return;

      await processUploadQueueOnce(10);

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
  }, [loadLocal, refreshUploadTotals]);

  const uploadFieldMemories = useCallback(
    async (source: "auto" | "manual" = "manual") => {
      if (autoUploadRunningRef.current || silentPublishRef.current) return;

      try {
        autoUploadRunningRef.current = true;
        silentPublishRef.current = true;
        setUploadingFieldMemories(true);

        for (let pass = 0; pass < 3; pass += 1) {
          const before = await refreshUploadTotals();

          if (
            before.pending === 0 &&
            before.failed === 0 &&
            before.uploading === 0
          ) {
            break;
          }

          if (
            before.uploading > 0 &&
            before.pending === 0 &&
            before.failed === 0
          ) {
            await new Promise((resolve) => setTimeout(resolve, 1500));
            await loadLocal(false);
            continue;
          }

          await runUploadPass();
          await new Promise((resolve) =>
            setTimeout(resolve, source === "auto" ? 1200 : 900)
          );
          await loadLocal(false);
        }

        await refreshUploadTotals();

        // Give AsyncStorage/local status patches one beat to settle after
        // the final CampFeed doc write, then reload the visible list.
        await new Promise((resolve) => setTimeout(resolve, 650));
        await loadLocal(false);
      } finally {
        autoUploadRunningRef.current = false;
        silentPublishRef.current = false;
        setUploadingFieldMemories(false);

        await refreshUploadTotals();
        await loadLocal(false);
      }
    },
    [loadLocal, refreshUploadTotals, runUploadPass]
  );

  useFocusEffect(
    useCallback(() => {
      let active = true;

      void (async () => {
        await loadLocal(true);

        if (active) {
          void uploadFieldMemories("auto");
        }
      })();

      const interval = setInterval(() => {
        if (active) {
          void (async () => {
            const totals = await refreshUploadTotals();

            if (totals.pending > 0 || totals.failed > 0) {
              if (!autoUploadRunningRef.current) {
                await uploadFieldMemories("auto");
              }
              return;
            }

            await loadLocal(false);
          })();
        }
      }, 5000);

      return () => {
        active = false;
        clearInterval(interval);
      };
    }, [loadLocal, refreshUploadTotals, uploadFieldMemories])
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

  const visibleFieldMemories = items.filter(
    (item) => item.type === "photo" || item.type === "fieldMemory"
  );

  const latestFieldMemory = visibleFieldMemories[0] ?? null;
  const latestPublishError = String(latestFieldMemory?.publishError || "").trim();
  const latestFieldMemoryPublished = isConfirmedPublished(latestFieldMemory);
  const latestFieldMemoryFailed = latestFieldMemory?.syncStatus === "failed";
  const latestFieldMemoryPending =
    latestFieldMemory?.syncStatus === "pending" ||
    latestFieldMemory?.syncStatus === "publishing";

  const allVisibleFieldMemoriesPublished =
    visibleFieldMemories.length > 0 &&
    visibleFieldMemories.every((item) => isConfirmedPublished(item));

  const hasLocalPublishing = latestFieldMemory?.syncStatus === "publishing";
  const hasLocalPending = latestFieldMemory?.syncStatus === "pending";
  const hasUnconfirmedSyncedMemory =
    latestFieldMemory?.syncStatus === "synced" &&
    !isConfirmedPublished(latestFieldMemory);

  const hasFailedWork = latestFieldMemoryFailed || hasUnconfirmedSyncedMemory;

  // The header represents the current/latest capture. Older local test debris
  // should not keep "Working behind the curtain" cycling after the latest
  // memory is already Published to CampFeed.
  const hasPendingWork =
    !latestFieldMemoryPublished &&
    latestFieldMemoryPending &&
    (uploadTotals.pending > 0 || uploadTotals.uploading > 0);

  const hasWorkToUpload =
    !latestFieldMemoryPublished &&
    (hasPendingWork || hasFailedWork || hasLocalPending || hasLocalPublishing);

  const uploadBusy =
    !latestFieldMemoryPublished &&
    (uploadingFieldMemories || hasPendingWork || hasLocalPublishing || hasLocalPending);

  const uploadStatusLabel =
    uploadBusy && showDeferredUploadMessage
      ? "Field Memory safely stored."
      : uploadBusy
        ? "Uploading to CampFeed..."
        : hasFailedWork
          ? "Some field memories need retry."
          : latestFieldMemoryPublished || allVisibleFieldMemoriesPublished
            ? "All Field Memories published to CampFeed."
            : latestFieldMemoryPending || hasLocalPending || hasLocalPublishing
              ? "Field Memory saved locally. DeerCamp will publish when service is available."
              : "No field memories waiting.";

  const activeUploadKey = latestFieldMemory?.id || "field-memory-upload-queue";

  useEffect(() => {
    if (!uploadBusy) {
      setShowDeferredUploadMessage(false);
      setUploadBusySinceMs(null);
      setUploadBusyKey(null);
      return;
    }

    if (uploadBusyKey !== activeUploadKey || !uploadBusySinceMs) {
      setShowDeferredUploadMessage(false);
      setUploadBusyKey(activeUploadKey);
      setUploadBusySinceMs(Date.now());
      return;
    }

    const elapsedMs = Date.now() - uploadBusySinceMs;

    if (elapsedMs >= 15000) {
      setShowDeferredUploadMessage(true);
      return;
    }

    const timer = setTimeout(() => {
      setShowDeferredUploadMessage(true);
    }, 15000 - elapsedMs);

    return () => clearTimeout(timer);
  }, [activeUploadKey, uploadBusy, uploadBusyKey, uploadBusySinceMs]);

  const openLatestFieldMemoryDetails = useCallback(() => {
    if (latestFieldMemory?.id) {
      router.push(`/entry/local/${latestFieldMemory.id}`);
    }
  }, [latestFieldMemory?.id, router]);



  const removeFailedFieldMemory = useCallback(
    async (memoryId: string) => {
      const cleanMemoryId = String(memoryId || "").trim();
      if (!cleanMemoryId) return;

      try {
        await removeUploadQueueItemsForMemory(cleanMemoryId);
        await removeLocalMemory(cleanMemoryId);
        await refreshUploadTotals();
        await loadLocal(false);
      } catch (error) {
        console.error("remove failed field memory failed:", error);
      }
    },
    [loadLocal, refreshUploadTotals]
  );

  const retryFailedFieldMemory = useCallback(
    async (memoryId: string) => {
      const cleanMemoryId = String(memoryId || "").trim();
      if (!cleanMemoryId) return;

      try {
        await resetFailedUploadQueueItemsForMemory(cleanMemoryId);
        await refreshUploadTotals();
        await uploadFieldMemories("manual");
      } catch (error) {
        console.error("retry failed field memory failed:", error);
      }
    },
    [refreshUploadTotals, uploadFieldMemories]
  );

  const renderItem = ({ item }: { item: EntryItem }) => {
    const title = item.title?.trim() || "Field Memory";
    const details = getMemorySummary(item);

    const statusLabel =
      item.syncStatus === "publishing"
        ? "Publishing to CampFeed"
        : isConfirmedPublished(item)
          ? "Published to CampFeed"
          : item.syncStatus === "synced" || item.syncStatus === "failed"
            ? "Upload needs retry"
            : "Ready to upload";

    const mediaLabel = item.type === "photo" ? "Photo" : "Photo + Voice";

    const metaBits = [statusLabel, formatWhen(item), mediaLabel].filter(Boolean);

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
            {metaBits.join(" - ")}
          </Text>
        </View>

        <Text style={styles.cardBody} numberOfLines={2}>
          {details}
        </Text>

        {item.publishError ? (
          <Text style={styles.cardError} numberOfLines={4}>
            Publish error: {item.publishError}
          </Text>
        ) : null}

        {(item.syncStatus === "failed" || item.publishError) ? (
          <View style={styles.cardActions}>
            <Pressable
              style={styles.cardActionBtn}
              onPress={(event) => {
                event.stopPropagation();
                void retryFailedFieldMemory(item.id);
              }}
            >
              <Text style={styles.cardActionText}>Retry</Text>
            </Pressable>

            <Pressable
              style={[styles.cardActionBtn, styles.cardActionDanger]}
              onPress={(event) => {
                event.stopPropagation();
                void removeFailedFieldMemory(item.id);
              }}
            >
              <Text style={styles.cardActionText}>Remove Failed Upload</Text>
            </Pressable>
          </View>
        ) : null}
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topNav}>
        <Pressable style={styles.backBtn} onPress={goAdd}>
          <Ionicons name="arrow-back" size={18} color="white" />
          <Text style={styles.backBtnText}>Back</Text>
        </Pressable>
      </View>

      <Text
        style={styles.title}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.75}
      >
        Upload Field Memories
      </Text>

      <Pressable
        style={styles.uploadCard}
        disabled={!showDeferredUploadMessage || !latestFieldMemory?.id}
        onPress={openLatestFieldMemoryDetails}
      >
        <View style={styles.uploadHeaderRow}>
          <Text style={styles.uploadTitle}>Field Memories</Text>

          <View
            style={[
              styles.uploadStatusDot,
              latestFieldMemoryPublished ||
              allVisibleFieldMemoriesPublished
                ? styles.uploadDotGood
                : hasWorkToUpload
                  ? styles.uploadDotUploading
                  : styles.uploadDotIdle,
            ]}
          />
        </View>

        <Text style={styles.uploadStatusText}>{uploadStatusLabel}</Text>

        {latestPublishError ? (
          <Text style={styles.publishErrorText} numberOfLines={4}>
            Last publish error: {latestPublishError}
          </Text>
        ) : null}

        {uploadBusy && !showDeferredUploadMessage ? (
          <View style={styles.publishingRow}>
            <ActivityIndicator color="white" />
            <Text style={styles.publishingText}>Working behind the curtain...</Text>
          </View>
        ) : null}

        {uploadBusy && showDeferredUploadMessage ? (
          <Text style={styles.tapDetailsText}>Enjoy the moment. DeerCamp will publish it automatically when service is available.</Text>
        ) : null}

        {hasFailedWork && !uploadBusy ? (
          <Pressable
            style={styles.uploadBtn}
            onPress={() => uploadFieldMemories("manual")}
          >
            <Text style={styles.uploadBtnText}>Retry Publish</Text>
          </Pressable>
        ) : null}
      </Pressable>

      {showEmpty ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyTitle}>No field memories yet</Text>
          <Text style={styles.emptyText}>
            Tap the badge on the Field Mode screen to record a memory.
          </Text>

          <Pressable style={styles.addBtn} onPress={goAdd}>
            <Ionicons name="arrow-back" size={20} color="#0B0E12" />
            <Text style={styles.addBtnText}>Back to Field Mode</Text>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0B0E12", paddingHorizontal: 16, paddingBottom: 16 },

  topNav: {
    alignItems: "flex-start",
    paddingTop: 8,
    marginBottom: 6,
  },

  backBtn: {
    minHeight: 40,
    borderRadius: 999,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },

  backBtnText: {
    color: "white",
    fontSize: 14,
    fontWeight: "900",
  },

  title: {
    color: "white",
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "900",
    marginTop: 8,
    marginBottom: 12,
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

  uploadTitle: {
    color: "white",
    fontSize: 16,
    fontWeight: "900",
  },

  uploadStatusText: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 20,
    marginBottom: 12,
  },

  publishErrorText: {
    color: "#FCA5A5",
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 17,
    marginTop: -4,
    marginBottom: 12,
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

  uploadDotIdle: {
    backgroundColor: "rgba(255,255,255,0.28)",
  },

  publishingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 4,
    paddingVertical: 8,
  },

  publishingText: {
    color: "rgba(255,255,255,0.78)",
    fontSize: 13,
    fontWeight: "800",
  },

  tapDetailsText: {
    color: "rgba(255,255,255,0.68)",
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 19,
    marginTop: 2,
  },

  uploadBtn: {
    backgroundColor: "white",
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },

  uploadBtnDisabled: {
    opacity: 0.55,
  },

  uploadBtnText: {
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


  cardActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },

  cardActionBtn: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
  },

  cardActionDanger: {
    backgroundColor: "rgba(252,165,165,0.14)",
    borderColor: "rgba(252,165,165,0.32)",
  },

  cardActionText: {
    color: "white",
    fontSize: 12,
    fontWeight: "900",
  },

  cardError: {
    color: "#FCA5A5",
    marginTop: 8,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "800",
  },
});
