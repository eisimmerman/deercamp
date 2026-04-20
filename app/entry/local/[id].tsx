import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";

import {
  getActiveCampId,
  getLocalMemoryById,
  markMemoryPublished,
  markMemoryPublishFailed,
  markMemoryPublishing,
  setActiveCampId,
  type LocalMemoryItem,
} from "@/lib/localMemories";
import { publishMemoryToFeed } from "@/lib/publishMemory";

function formatWhen(ms?: number) {
  if (!ms) return "";
  return new Date(ms).toLocaleString();
}

function formatDuration(ms?: number) {
  if (!ms || ms <= 0) return "";
  const totalSec = Math.round(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function VoicePlayer({ uri, durationMs }: { uri: string; durationMs?: number }) {
  const router = useRouter();
  const player = useAudioPlayer(uri, { downloadFirst: false });
  const status = useAudioPlayerStatus(player);

  const label = useMemo(() => {
    if (!status.isLoaded) return "Loading…";
    return status.playing ? "Pause Voice" : "Play Voice";
  }, [status.isLoaded, status.playing]);

  const meta = useMemo(() => {
    const durStr = formatDuration(durationMs);

    if (!status.isLoaded) return durStr ? `(${durStr})` : "";

    const curSec = Math.floor(status.currentTime ?? 0);
    const durSec = Math.floor(status.duration ?? 0);

    if (durSec > 0) return `${curSec}s / ${durSec}s${durStr ? ` (${durStr})` : ""}`;
    return durStr ? `(${durStr})` : "";
  }, [status.isLoaded, status.currentTime, status.duration, durationMs]);

  const onPress = () => {
    if (!status.isLoaded) return;

    if (status.playing) {
      player.pause();
      return;
    }

    if (status.duration > 0 && status.currentTime >= status.duration) {
      player.seekTo(0);
    }

    player.play();
  };

  return (
    <View style={styles.voiceWrap}>
      <View style={styles.voiceButtonRow}>
        <Pressable
          onPress={onPress}
          disabled={!status.isLoaded}
          style={({ pressed }: { pressed: boolean }) => [
            styles.voiceBtn,
            pressed && styles.voiceBtnPressed,
            !status.isLoaded && styles.voiceBtnDisabled,
          ]}
        >
          <Text style={styles.voiceBtnText}>{label}</Text>
        </Pressable>

        <Pressable
          onPress={() => router.replace("/")}
          style={({ pressed }: { pressed: boolean }) => [styles.homeBtn, pressed && styles.voiceBtnPressed]}
        >
          <Text style={styles.homeBtnText}>Home</Text>
        </Pressable>
      </View>

      {!!meta && <Text style={styles.voiceMeta}>{meta}</Text>}
    </View>
  );
}

export default function LocalEntryDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const [loading, setLoading] = useState(true);
  const [entry, setEntry] = useState<LocalMemoryItem | null>(null);

  const loadEntry = useCallback(async () => {
    try {
      if (!id) {
        setEntry(null);
        setLoading(false);
        return;
      }

      const next = await getLocalMemoryById(id);
      setEntry(next);
      setLoading(false);
    } catch (error) {
      console.error("Local entry detail load error:", error);
      setEntry(null);
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadEntry();
  }, [loadEntry]);

  async function onPublish() {
    if (!entry) return;

    try {
      await markMemoryPublishing(entry.id);
      setEntry((current: LocalMemoryItem | null) =>
        current ? { ...current, syncStatus: "publishing", publishError: undefined } : current
      );

      const resolvedCampId =
        String(entry.campId || "").trim() ||
        String((await getActiveCampId()) || "").trim() ||
        "ourdeercamp";

      const result = await publishMemoryToFeed(entry, {
        campId: resolvedCampId,
        defaultTitle: entry.title?.trim() || "Field Memory",
        defaultCaption: entry.details?.trim() || "Captured in DeerCamp Field Mode.",
      });

      await setActiveCampId(resolvedCampId);

      await markMemoryPublished(entry.id, {
        feedDocId: result.feedDocId,
        campId: resolvedCampId,
      });

      await loadEntry();
      Alert.alert("Published", "This memory is now live in Feed.");
    } catch (error: any) {
      const message =
        error?.message?.trim() || "This memory stayed on your device. Please try again.";

      console.error("Publish memory failed:", error);

      await markMemoryPublishFailed(entry.id, message);
      setEntry((current: LocalMemoryItem | null) =>
        current ? { ...current, syncStatus: "failed", publishError: message } : current
      );

      Alert.alert("Publish failed", message);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.muted}>Loading memory…</Text>
      </View>
    );
  }

  if (!entry) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Not found</Text>
        <Text style={styles.muted}>This local memory could not be found on this device.</Text>
      </View>
    );
  }

  const photoUri = entry.photoUri?.trim() || entry.photoUrl?.trim() || "";
  const voiceUri =
    entry.voiceUri?.trim() || entry.audioUri?.trim() || entry.voiceUrl?.trim() || "";
  const hasPhoto = photoUri.length > 0;
  const hasVoice = voiceUri.length > 0;
  const title = entry.title?.trim() || "Local Memory";
  const details = entry.details?.trim() || "";

  const statusLabel =
    entry.syncStatus === "publishing"
      ? "Publishing..."
      : entry.syncStatus === "failed"
      ? "Publish failed"
      : entry.syncStatus === "synced"
      ? "Published to Feed"
      : "Saved locally";

  const statusText =
    entry.syncStatus === "publishing"
      ? "Your memory is being sent to Feed right now."
      : entry.syncStatus === "failed"
      ? entry.publishError?.trim() ||
        "This memory stayed on your device because publishing did not finish."
      : entry.syncStatus === "synced"
      ? "This memory has been published to Feed."
      : "This memory is on your device and ready to publish to Feed.";

  const canPublish =
    entry.syncStatus !== "publishing" &&
    entry.syncStatus !== "synced" &&
    hasPhoto &&
    hasVoice;

  const publishLabel =
    entry.syncStatus === "publishing"
      ? "Publishing..."
      : entry.syncStatus === "synced"
      ? "Published to Feed ✓"
      : "Publish to Feed";

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.topRow}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={18} color="white" />
          <Text style={styles.backBtnText}>Back</Text>
        </Pressable>
      </View>

      <View style={styles.header}>
        <Text style={styles.author}>
          {entry.authorName?.trim() ? entry.authorName : "DeerCamp Member"}
        </Text>
        <Text style={styles.time}>{formatWhen(entry.clientCreatedAt)}</Text>
        <Text style={styles.badge}>{statusLabel.toUpperCase()}</Text>
      </View>

      <View style={styles.statusCard}>
        <Text style={styles.statusTitle}>{statusLabel}</Text>
        <Text style={styles.statusText}>{statusText}</Text>
      </View>

      <Pressable
        onPress={onPublish}
        disabled={!canPublish}
        style={({ pressed }: { pressed: boolean }) => [
          styles.publishBtn,
          pressed && canPublish && styles.publishBtnPressed,
          !canPublish && styles.publishBtnDisabled,
        ]}
      >
        <Text style={styles.publishBtnText}>{publishLabel}</Text>
      </Pressable>

      {!hasPhoto || !hasVoice ? (
        <View style={styles.infoCard}>
          <Text style={styles.infoCardText}>
            Publish to Feed requires both a photo and a voice recording.
          </Text>
        </View>
      ) : null}

      <Text style={styles.entryTitle}>{title}</Text>

      {hasPhoto && <Image source={{ uri: photoUri }} style={styles.photo} />}

      {!!details && <Text style={styles.body}>{details}</Text>}

      {hasVoice && <VoicePlayer uri={voiceUri} />}

      {!hasPhoto && !hasVoice ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>
            This memory does not have a local photo or audio preview.
          </Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    padding: 14,
    gap: 12,
    backgroundColor: "#0B0E12",
    minHeight: "100%",
  },

  center: {
    flex: 1,
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#0B0E12",
  },

  title: {
    color: "white",
    fontSize: 20,
    fontWeight: "900",
  },

  muted: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
  },

  topRow: {
    flexDirection: "row",
    justifyContent: "flex-start",
  },

  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },

  backBtnText: {
    color: "white",
    fontWeight: "900",
  },

  header: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: 18,
    padding: 14,
  },

  author: {
    color: "white",
    fontSize: 18,
    fontWeight: "900",
  },

  time: {
    color: "rgba(255,255,255,0.58)",
    marginTop: 4,
    fontWeight: "700",
  },

  badge: {
    marginTop: 10,
    alignSelf: "flex-start",
    color: "#0B0E12",
    backgroundColor: "#D0B17A",
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    fontSize: 12,
    fontWeight: "900",
  },

  statusCard: {
    backgroundColor: "rgba(208,177,122,0.12)",
    borderWidth: 1,
    borderColor: "rgba(208,177,122,0.28)",
    borderRadius: 18,
    padding: 14,
  },

  statusTitle: {
    color: "white",
    fontSize: 16,
    fontWeight: "900",
    marginBottom: 6,
  },

  statusText: {
    color: "rgba(255,255,255,0.74)",
    lineHeight: 20,
    fontWeight: "700",
  },

  publishBtn: {
    backgroundColor: "white",
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
  },

  publishBtnPressed: {
    opacity: 0.92,
  },

  publishBtnDisabled: {
    opacity: 0.55,
  },

  publishBtnText: {
    color: "#0B0E12",
    fontSize: 18,
    fontWeight: "900",
  },

  infoCard: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: 18,
    padding: 14,
  },

  infoCardText: {
    color: "rgba(255,255,255,0.72)",
    fontWeight: "700",
    lineHeight: 20,
  },

  entryTitle: {
    color: "white",
    fontSize: 24,
    fontWeight: "900",
  },

  photo: {
    width: "100%",
    aspectRatio: 3 / 4,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.04)",
  },

  body: {
    color: "rgba(255,255,255,0.86)",
    lineHeight: 22,
    fontSize: 16,
    fontWeight: "700",
  },

  voiceWrap: {
    gap: 8,
    marginTop: 4,
  },

  voiceButtonRow: {
    flexDirection: "row",
    gap: 10,
  },

  voiceBtn: {
    flex: 1,
    backgroundColor: "white",
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },

  homeBtn: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },

  voiceBtnPressed: {
    opacity: 0.92,
  },

  voiceBtnDisabled: {
    opacity: 0.55,
  },

  voiceBtnText: {
    color: "#0B0E12",
    fontSize: 16,
    fontWeight: "900",
  },

  homeBtnText: {
    color: "white",
    fontSize: 16,
    fontWeight: "900",
  },

  voiceMeta: {
    color: "rgba(255,255,255,0.58)",
    fontWeight: "700",
  },

  emptyCard: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: 18,
    padding: 14,
  },

  emptyText: {
    color: "rgba(255,255,255,0.65)",
    fontWeight: "700",
    lineHeight: 20,
  },
});