// app/(tabs)/memories.tsx
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
import {
  attachPendingAuthMemoriesToUser,
  getLocalMemories,
  getPendingAuthMemories,
  type LocalMemoryItem,
} from "@/lib/localMemories";
import {
  getUploadQueueTotals,
  type UploadQueueTotals,
} from "@/lib/capture/uploadQueueState";
import { processUploadQueueOnce } from "@/lib/capture/uploadWorker";
import { enqueueUploadItems } from "@/lib/capture/uploadQueue";

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

function getCleanAuthorName() {
  const displayName = auth.currentUser?.displayName?.trim() || "";
  if (displayName && displayName.toLowerCase() !== "5pt") return displayName;

  const email = auth.currentUser?.email?.trim() || "";
  if (!email) return "DeerCamp Member";

  const cleaned = email
    .split("@")[0]
    ?.replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return email;

  return cleaned
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

async function enqueueMemoryUploadItems(memory: LocalMemoryItem, authorId: string) {
  const campId = memory.campId || "camp-swede-cornell-wi-54732";
  const uploadItems: any[] = [];

  if (memory.photoUri?.trim()) {
    uploadItems.push({
      id: `${memory.id}-upload-photo-main`,
      memoryId: memory.id,
      segmentId: "photo-main",
      segmentIndex: -1,
      uri: memory.photoUri.trim(),
      mediaType: "photo" as const,
      campId,
      authorId,
    });
  }

  const segments = Array.isArray(memory.segments) ? memory.segments : [];
  segments.forEach((segment) => {
    if (!segment?.uri?.trim()) return;

    uploadItems.push({
      id: `${memory.id}-upload-${String(segment.index).padStart(3, "0")}`,
      memoryId: memory.id,
      segmentId: segment.id,
      segmentIndex: segment.index,
      uri: segment.uri.trim(),
      mediaType: "audio" as const,
      campId,
      authorId,
    });
  });

  if (uploadItems.length > 0) {
    await enqueueUploadItems(uploadItems);
  }
}

function getMemorySummary(item: EntryItem) {
  if (item.pendingAuth) {
    return "Saved on this phone. Sign in to attach and sync when connected.";
  }

  if (item.type === "photo") {
    if (item.syncStatus === "synced") return "Photo captured in Field Mode. Published to CampFeed.";
    if (item.syncStatus === "publishing") return "Photo captured in Field Mode. Publishing to CampFeed.";
    if (item.syncStatus === "failed") return "Photo captured in Field Mode. Upload needs retry.";
    return "Photo captured in Field Mode. Ready to upload.";
  }

  if (item.type === "fieldMemory") {
    if (item.syncStatus === "synced") return "Photo + voice captured in Field Mode. Published to CampFeed.";
    if (item.syncStatus === "publishing") return "Photo + voice captured in Field Mode. Publishing to CampFeed.";
    if (item.syncStatus === "failed") return "Photo + voice captured in Field Mode. Upload needs retry.";
    return "Photo + voice captured in Field Mode. Ready to upload.";
  }

  return item.details?.trim() || "Saved on device.";
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
  const isSignedIn = Boolean(user && !user.isAnonymous);

  const processingUploadsRef = useRef(false);

  const [localItems, setLocalItems] = useState<EntryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadTotals, setUploadTotals] =
    useState<UploadQueueTotals>(emptyUploadTotals);
  const [uploadingFieldMemories, setUploadingFieldMemories] = useState(false);
  const silentPublishRef = useRef(false);

  const goAdd = useCallback(() => {
    router.push("/");
  }, [router]);

  const refreshUploadTotals = useCallback(async () => {
    const totals = await getUploadQueueTotals();
    setUploadTotals(totals);
    return totals;
  }, []);

  const loadLocal = useCallback(
    async (showLoading = true) => {
      try {
        if (showLoading) setLoading(true);

        if (!isSignedIn || !user?.uid) {
          const pending = await getPendingAuthMemories();
          const mapped: EntryItem[] = pending.map((item: LocalMemoryItem) => ({
            ...item,
            isLocal: true,
          }));

          mapped.sort((a, b) => toSortMs(b) - toSortMs(a));
          setLocalItems(mapped);
          setUploadTotals(emptyUploadTotals);
          return;
        }

        const attached = await attachPendingAuthMemoriesToUser({
          authorId: user.uid,
          authorName: getCleanAuthorName(),
        });

        for (const memory of attached) {
          await enqueueMemoryUploadItems(memory, user.uid);
        }

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
    [isSignedIn, refreshUploadTotals, user?.uid]
  );

  const runUploadPass = useCallback(async () => {
    if (!isSignedIn || !user?.uid) return;
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
  }, [isSignedIn, loadLocal, refreshUploadTotals, user?.uid]);

  const uploadFieldMemories = useCallback(
    async (source: "auto" | "manual" = "manual") => {
      if (!isSignedIn || !user?.uid) {
        if (source === "manual") router.push("/sign-in");
        return;
      }

      if (uploadingFieldMemories || silentPublishRef.current) return;

      try {
        silentPublishRef.current = true;
        setUploadingFieldMemories(true);

        for (let pass = 0; pass < 8; pass += 1) {
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
        silentPublishRef.current = false;
        setUploadingFieldMemories(false);

        await refreshUploadTotals();
        await loadLocal(false);
      }
    },
    [isSignedIn, loadLocal, refreshUploadTotals, router, runUploadPass, uploadingFieldMemories, user?.uid]
  );

  useFocusEffect(
    useCallback(() => {
      let active = true;

      void (async () => {
        await loadLocal(true);

        if (active && isSignedIn) {
          void uploadFieldMemories("auto");
        }
      })();

      const interval = setInterval(() => {
        if (active) {
          void (async () => {
            const totals = await refreshUploadTotals();

            if (isSignedIn && (totals.pending > 0 || totals.uploading > 0)) {
              await uploadFieldMemories("auto");
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
    }, [isSignedIn, loadLocal, refreshUploadTotals, uploadFieldMemories])
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
  const latestFieldMemoryPublished = latestFieldMemory?.syncStatus === "synced";
  const latestFieldMemoryFailed = latestFieldMemory?.syncStatus === "failed";
  const latestFieldMemoryPending =
    latestFieldMemory?.syncStatus === "pending" ||
    latestFieldMemory?.syncStatus === "publishing";

  const allVisibleFieldMemoriesPublished =
    visibleFieldMemories.length > 0 &&
    visibleFieldMemories.every((item) => item.syncStatus === "synced");

  const hasLocalPublishing = latestFieldMemory?.syncStatus === "publishing";
  const hasLocalPending = latestFieldMemory?.syncStatus === "pending";
  const hasFailedWork = latestFieldMemoryFailed;

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

  const hasPendingAuthMemories = visibleFieldMemories.some((item) => item.pendingAuth);

  const uploadStatusLabel = hasPendingAuthMemories && !isSignedIn
    ? "Saved on this phone. Sign in to attach and sync when connected."
    : uploadBusy
      ? "Publishing field memories to CampFeed…"
    : hasFailedWork
      ? "Some field memories need retry."
      : latestFieldMemoryPublished ||
          allVisibleFieldMemoriesPublished ||
          uploadTotals.uploaded > 0 ||
          visibleFieldMemories.some((item) => item.syncStatus === "synced")
        ? "All field memories published to CampFeed."
        : "No field memories waiting.";

  const renderItem = ({ item }: { item: EntryItem }) => {
    const title = item.title?.trim() || "Field Memory";
    const details = getMemorySummary(item);

    const statusLabel = item.pendingAuth
      ? "Needs sign in to sync"
      : item.syncStatus === "publishing"
        ? "Publishing to CampFeed"
        : item.syncStatus === "synced"
          ? "Published to CampFeed"
          : item.syncStatus === "failed"
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
            {metaBits.join(" • ")}
          </Text>
        </View>

        <Text style={styles.cardBody} numberOfLines={2}>
          {details}
        </Text>
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.titleRow}>
        <Pressable style={styles.backPill} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={18} color="white" />
          <Text style={styles.backPillText}>Back</Text>
        </Pressable>
        <Text style={styles.title}>Upload Field Memories</Text>
      </View>

      <View style={styles.uploadCard}>
        <View style={styles.uploadHeaderRow}>
          <Text style={styles.uploadTitle}>Field Memories</Text>

          <View
            style={[
              styles.uploadStatusDot,
              latestFieldMemoryPublished ||
              allVisibleFieldMemoriesPublished ||
              uploadTotals.uploaded > 0
                ? styles.uploadDotGood
                : hasWorkToUpload
                  ? styles.uploadDotUploading
                  : styles.uploadDotIdle,
            ]}
          />
        </View>

        <Text style={styles.uploadStatusText}>{uploadStatusLabel}</Text>

        {uploadBusy ? (
          <View style={styles.publishingRow}>
            <ActivityIndicator color="white" />
            <Text style={styles.publishingText}>Working behind the curtain…</Text>
          </View>
        ) : null}

        {hasPendingAuthMemories && !isSignedIn ? (
          <Pressable
            style={styles.uploadBtn}
            onPress={() => router.push("/sign-in")}
          >
            <Text style={styles.uploadBtnText}>Sign In to Sync</Text>
          </Pressable>
        ) : null}

        {hasFailedWork && !uploadBusy ? (
          <Pressable
            style={styles.uploadBtn}
            onPress={() => uploadFieldMemories("manual")}
          >
            <Text style={styles.uploadBtnText}>Retry Publish</Text>
          </Pressable>
        ) : null}
      </View>

      {showEmpty ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyTitle}>No field memories yet</Text>
          <Text style={styles.emptyText}>
            Open CampMemoryMgr to capture a field memory.
          </Text>

          <Pressable style={styles.addBtn} onPress={goAdd}>
            <Ionicons name="arrow-back" size={20} color="#0B0E12" />
            <Text style={styles.addBtnText}>Back to CampFieldApp</Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0B0E12", padding: 16 },

  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 8,
    marginBottom: 12,
  },

  backPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },

  backPillText: {
    color: "white",
    fontSize: 13,
    fontWeight: "900",
  },

  title: {
    color: "white",
    fontSize: 32,
    fontWeight: "900",
    flex: 1,
    marginTop: 0,
    marginBottom: 0,
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
});
