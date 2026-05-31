// app/entry/local/[id].tsx
import React, { useEffect, useMemo, useState } from "react";
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
  DEFAULT_ACTIVE_CAMP_ID,
  getLocalMemoryById,
  markMemoryPublished,
  markMemoryPublishFailed,
  markMemoryPublishing,
  type LocalMemoryItem,
  type LocalMemorySegment,
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

function VoicePlayer({
  uri,
  durationMs,
  label,
}: {
  uri: string;
  durationMs?: number;
  label?: string;
}) {
  const player = useAudioPlayer(uri, { downloadFirst: false });
  const status = useAudioPlayerStatus(player);

  const buttonLabel = useMemo(() => {
    if (!status.isLoaded) return "Loading…";
    if (status.playing) return label ? `Pause ${label}` : "Pause Voice";
    return label ? `Play ${label}` : "Play Voice";
  }, [label, status.isLoaded, status.playing]);

  const meta = useMemo(() => {
    const durStr = formatDuration(durationMs);
    if (!status.isLoaded) return durStr ? `(${durStr})` : "";

    const curSec = Math.floor(status.currentTime ?? 0);
    const durSec = Math.floor(status.duration ?? 0);

    if (durSec > 0) {
      return `${curSec}s / ${durSec}s${durStr ? ` (${durStr})` : ""}`;
    }

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
      <Pressable
        onPress={onPress}
        disabled={!status.isLoaded}
        style={({ pressed }) => [
          styles.voiceBtn,
          pressed && styles.voiceBtnPressed,
          !status.isLoaded && styles.voiceBtnDisabled,
        ]}
      >
        <Text style={styles.voiceBtnText}>{buttonLabel}</Text>
      </Pressable>

      {!!meta && <Text style={styles.voiceMeta}>{meta}</Text>}
    </View>
  );
}

function SegmentVoiceList({
  segments,
  totalDurationMs,
}: {
  segments: LocalMemorySegment[];
  totalDurationMs?: number;
}) {
  const playableSegments = segments
    .filter((segment) => segment.uri?.trim())
    .sort((a, b) => a.index - b.index);

  if (playableSegments.length === 0) return null;

  const durationLabel = formatDuration(totalDurationMs);
  const isSingleRecording = playableSegments.length === 1;

  return (
    <View style={styles.segmentCard}>
      <View style={styles.segmentHeader}>
        <Text style={styles.segmentTitle}>Voice Saved</Text>
        <Text style={styles.segmentMeta}>
          {durationLabel
            ? `${durationLabel} recording saved locally.`
            : "Recording saved locally."}
        </Text>
      </View>

      <Text style={styles.segmentHelp}>
        Your Field Memory is safely stored on this phone. DeerCamp will
        automatically publish it when service becomes available.
      </Text>

      {isSingleRecording ? (
        <VoicePlayer
          key={playableSegments[0].id}
          uri={playableSegments[0].uri}
          durationMs={playableSegments[0].durationMs || totalDurationMs}
          label="Recording"
        />
      ) : (
        <View style={styles.segmentPickerList}>
          {playableSegments.map((segment, displayIndex) => {
            const clipNumber = displayIndex + 1;

            return (
              <View key={segment.id} style={styles.segmentItem}>
                <Text style={styles.segmentLabel}>
                  Recording Clip {clipNumber}
                </Text>
                <VoicePlayer
                  uri={segment.uri}
                  durationMs={segment.durationMs}
                  label={`Clip ${clipNumber}`}
                />
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

export default function LocalEntryDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const [loading, setLoading] = useState(true);
  const [entry, setEntry] = useState<LocalMemoryItem | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [retryStatus, setRetryStatus] = useState("");

  useEffect(() => {
    let alive = true;

    async function run() {
      try {
        if (!id) {
          if (alive) {
            setEntry(null);
            setLoading(false);
          }
          return;
        }

        const next = await getLocalMemoryById(id);

        if (!alive) return;

        setEntry(next);
        setLoading(false);
      } catch (error) {
        console.error("Local entry detail load error:", error);
        if (alive) {
          setEntry(null);
          setLoading(false);
        }
      }
    }

    run();

    return () => {
      alive = false;
    };
  }, [id]);

  async function refreshEntry(memoryId: string) {
    const next = await getLocalMemoryById(memoryId);
    setEntry(next);
    return next;
  }

  function getFriendlyUploadError(error: any) {
    const rawMessage = String(
      error?.message || "Upload failed. Check connection and try again."
    ).trim();

    if (
      rawMessage.toLowerCase().includes("permission") ||
      rawMessage.toLowerCase().includes("unauthorized")
    ) {
      return "Upload did not finish because DeerCamp could not confirm upload permission. Your memory is still safe on this device. Try again after permissions are updated.";
    }

    if (
      rawMessage.toLowerCase().includes("network") ||
      rawMessage.toLowerCase().includes("offline") ||
      rawMessage.toLowerCase().includes("failed to fetch")
    ) {
      return "Upload did not finish because the connection dropped. Your memory is still safe on this device. Try again when signal or Wi-Fi is better.";
    }

    return "Upload did not finish. Your memory is still safe on this device. Tap Retry Upload when you are ready to try again.";
  }

  async function onRetryUpload() {
    if (!entry || retrying) return;

    const campId =
      String(entry.campId || DEFAULT_ACTIVE_CAMP_ID).trim() || DEFAULT_ACTIVE_CAMP_ID;

    try {
      setRetrying(true);
      setRetryStatus("Uploading now. Keep this screen open…");

      // Persist the in-progress state without refreshing the screen into a new
      // status layout. This keeps the failed-memory screen calm instead of
      // jumping between failed/uploading states while the retry runs.
      await markMemoryPublishing(entry.id);

      const result = await publishMemoryToFeed(entry, {
        campId,
        defaultTitle: entry.title || entry.generatedTitle || "Field Memory",
        defaultCaption:
          entry.details ||
          entry.generatedCaption ||
          "Photo + voice captured in DeerCamp Field Mode.",
      });

      await markMemoryPublished(entry.id, {
        feedDocId: result.feedDocId,
        campId: result.campId,
        photoUrl: result.imageUrl,
        audioUrl: result.audioUrl,
        voiceUrl: result.audioUrl,
      });

      await refreshEntry(entry.id);
      setRetryStatus("Uploaded to CampFeed.");
      Alert.alert("Upload complete", "This field memory was posted to CampFeed.");
    } catch (error: any) {
      const friendlyMessage = getFriendlyUploadError(error);
      console.error("Retry local memory upload failed:", error);

      try {
        await markMemoryPublishFailed(entry.id, friendlyMessage);
        await refreshEntry(entry.id);
      } catch (markError) {
        console.error("Failed to mark retry error:", markError);
      }

      setRetryStatus(friendlyMessage);
    } finally {
      setRetrying(false);
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
        <Text style={styles.muted}>
          This local memory could not be found on this device.
        </Text>
      </View>
    );
  }

  const photoUri = entry.photoUri?.trim() || entry.photoUrl?.trim() || "";
  const fallbackVoiceUri =
    entry.voiceUri?.trim() ||
    entry.audioUri?.trim() ||
    entry.voiceUrl?.trim() ||
    "";

  const segments = Array.isArray(entry.segments) ? entry.segments : [];
  const playableSegments = segments.filter((segment) => segment.uri?.trim());
  const hasSegmentedVoice = playableSegments.length > 0;
  const hasFallbackVoice = fallbackVoiceUri.length > 0;
  const hasPhoto = photoUri.length > 0;
  const hasVoice = hasSegmentedVoice || hasFallbackVoice;

  const title =
    entry.title?.trim() || entry.generatedTitle?.trim() || "Local Memory";
  const details =
    entry.details?.trim() || entry.generatedCaption?.trim() || "";

  const statusLabel =
    entry.syncStatus === "failed"
      ? "Upload failed"
      : entry.syncStatus === "synced"
      ? "Published"
      : entry.syncStatus === "publishing"
      ? "Uploading"
      : "Field Memory Saved";

  const savedText = hasVoice
    ? "Your Field Memory is safe. DeerCamp will automatically publish it to CampFeed when service becomes available."
    : "Your Field Memory is safe. DeerCamp will automatically publish it to CampFeed when service becomes available.";

  const statusText =
    entry.syncStatus === "failed"
      ? "Upload did not finish. Your field memory is still safe on this phone."
      : entry.syncStatus === "synced"
      ? "Your field memory is now in CampFeed."
      : entry.syncStatus === "publishing"
      ? "Publishing to CampFeed... DeerCamp is working behind the curtain."
      : savedText;

  const targetCampId =
    String(entry.campId || DEFAULT_ACTIVE_CAMP_ID).trim() || DEFAULT_ACTIVE_CAMP_ID;
  const targetCampName =
    entry.targetCampName?.trim() ||
    (targetCampId === DEFAULT_ACTIVE_CAMP_ID ? "Camp Swede" : "Selected DeerCamp");
  const canRetryUpload = entry.syncStatus !== "synced" && hasPhoto;

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

        <View style={styles.targetCampCard}>
          <Text style={styles.targetCampLabel}>Current Camp</Text>
          <Text style={styles.targetCampName}>{targetCampName}</Text>
          <Text style={styles.targetCampId}>{targetCampId}</Text>
        </View>

        {canRetryUpload ? (
          <Pressable
            style={[styles.retryBtn, retrying && styles.retryBtnDisabled]}
            onPress={onRetryUpload}
            disabled={retrying}
          >
            {retrying ? (
              <ActivityIndicator color="#0B0E12" />
            ) : (
              <Ionicons name="cloud-upload-outline" size={18} color="#0B0E12" />
            )}
            <Text style={styles.retryBtnText}>
              {retrying ? "Retrying Upload…" : "Retry Upload"}
            </Text>
          </Pressable>
        ) : null}

        {!!retryStatus && <Text style={styles.retryStatus}>{retryStatus}</Text>}
      </View>

      <Text style={styles.entryTitle}>{title}</Text>

      {hasPhoto && <Image source={{ uri: photoUri }} style={styles.photo} />}

      {!!details && <Text style={styles.body}>{details}</Text>}

      {hasSegmentedVoice ? (
        <SegmentVoiceList
          segments={playableSegments}
          totalDurationMs={entry.totalDurationMs}
        />
      ) : hasFallbackVoice ? (
        <VoicePlayer uri={fallbackVoiceUri} durationMs={entry.totalDurationMs} label="Recording" />
      ) : null}

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

  targetCampCard: {
    marginTop: 14,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: 14,
    padding: 12,
    gap: 3,
  },

  targetCampLabel: {
    color: "rgba(255,255,255,0.56)",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },

  targetCampName: {
    color: "white",
    fontSize: 16,
    fontWeight: "900",
  },

  targetCampId: {
    color: "rgba(255,255,255,0.58)",
    fontSize: 12,
    fontWeight: "700",
  },

  retryBtn: {
    marginTop: 14,
    minHeight: 50,
    borderRadius: 16,
    backgroundColor: "white",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    paddingHorizontal: 16,
  },

  retryBtnDisabled: {
    opacity: 0.68,
  },

  retryBtnText: {
    color: "#0B0E12",
    fontSize: 16,
    fontWeight: "900",
  },

  retryStatus: {
    marginTop: 10,
    color: "rgba(255,255,255,0.72)",
    lineHeight: 19,
    fontWeight: "800",
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

  segmentCard: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: 18,
    padding: 14,
    gap: 12,
  },

  segmentHeader: {
    gap: 4,
  },

  segmentTitle: {
    color: "white",
    fontSize: 18,
    fontWeight: "900",
  },

  segmentMeta: {
    color: "rgba(255,255,255,0.58)",
    fontSize: 13,
    fontWeight: "800",
  },

  segmentHelp: {
    color: "rgba(255,255,255,0.68)",
    lineHeight: 20,
    fontWeight: "700",
  },

  segmentPickerList: {
    gap: 8,
  },

  segmentPickerBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },

  segmentPickerBtnActive: {
    backgroundColor: "rgba(208,177,122,0.18)",
    borderColor: "rgba(208,177,122,0.42)",
  },

  segmentPickerText: {
    color: "rgba(255,255,255,0.78)",
    fontWeight: "900",
  },

  segmentPickerTextActive: {
    color: "white",
  },

  segmentPickerMeta: {
    color: "rgba(255,255,255,0.5)",
    fontWeight: "800",
  },

  segmentItem: {
    gap: 8,
  },

  segmentLabel: {
    color: "rgba(255,255,255,0.78)",
    fontWeight: "900",
  },

  voiceWrap: {
    gap: 8,
    marginTop: 4,
  },

  voiceBtn: {
    backgroundColor: "white",
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