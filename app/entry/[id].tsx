// app/entry/[id].tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { doc, getDoc, Timestamp } from "firebase/firestore";

import { db } from "@/src/lib/firebase";

type EntryDoc = {
  authorId?: string;
  authorName?: string;
  clientCreatedAt?: number;
  createdAt?: Timestamp;
  title?: string;
  details?: string;
  photoUrl?: string;
  visibility?: "public" | "private" | string;
  voiceDurationMs?: number;
  voiceUrl?: string;
};

type Entry = EntryDoc & { id: string };

function formatTimestamp(ts?: Timestamp) {
  if (!ts) return "";
  return ts.toDate().toLocaleString();
}

function formatDuration(ms?: number) {
  if (!ms || ms <= 0) return "";
  const totalSec = Math.round(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function VoicePlayer({ uri, durationMs }: { uri: string; durationMs?: number }) {
  const player = useAudioPlayer(uri, { downloadFirst: true });
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
      <Pressable
        onPress={onPress}
        disabled={!status.isLoaded}
        style={({ pressed }) => [
          styles.voiceBtn,
          pressed && styles.voiceBtnPressed,
          !status.isLoaded && styles.voiceBtnDisabled,
        ]}
      >
        <Text style={styles.voiceBtnText}>{label}</Text>
      </Pressable>

      {!!meta && <Text style={styles.voiceMeta}>{meta}</Text>}
    </View>
  );
}

export default function EntryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
  const [entry, setEntry] = useState<Entry | null>(null);

  useEffect(() => {
    let alive = true;

    async function run() {
      try {
        if (!id) return;

        const ref = doc(db, "entries", id);
        const snap = await getDoc(ref);

        if (!alive) return;

        if (!snap.exists()) {
          setEntry(null);
          setLoading(false);
          return;
        }

        const data = snap.data() as EntryDoc;
        setEntry({ id: snap.id, ...data });
        setLoading(false);
      } catch (e) {
        console.error("Entry detail load error:", e);
        if (alive) setLoading(false);
      }
    }

    run();
    return () => {
      alive = false;
    };
  }, [id]);

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
        <Text style={styles.muted}>This memory may have been deleted.</Text>
      </View>
    );
  }

  const hasPhoto = !!entry.photoUrl && entry.photoUrl.trim().length > 0;
  const hasVoice = !!entry.voiceUrl && entry.voiceUrl.trim().length > 0;

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.header}>
        <Text style={styles.author}>
          {entry.authorName?.trim() ? entry.authorName : "Anonymous"}
        </Text>
        <Text style={styles.time}>{formatTimestamp(entry.createdAt)}</Text>
      </View>

      {!!entry.title?.trim() && <Text style={styles.entryTitle}>{entry.title}</Text>}

      {hasPhoto && <Image source={{ uri: entry.photoUrl! }} style={styles.photo} />}

      {!!entry.details?.trim() && <Text style={styles.body}>{entry.details}</Text>}

      {hasVoice && (
        <VoicePlayer uri={entry.voiceUrl!} durationMs={entry.voiceDurationMs} />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    padding: 14,
    gap: 12,
  },
  center: {
    flex: 1,
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  title: { fontSize: 20, fontWeight: "700" },
  muted: { color: "#6b7280" },

  header: { gap: 2 },
  author: { fontSize: 18, fontWeight: "900", color: "#111827" },
  time: { color: "#6b7280", fontSize: 12 },

  entryTitle: { fontSize: 22, fontWeight: "900", color: "#111827" },

  photo: {
    width: "100%",
    height: 320,
    borderRadius: 14,
    backgroundColor: "#f3f4f6",
  },

  body: { color: "#111827", fontSize: 16, lineHeight: 22 },

  voiceWrap: { marginTop: 6, gap: 8 },
  voiceBtn: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "#111827",
    alignSelf: "flex-start",
  },
  voiceBtnPressed: { opacity: 0.85 },
  voiceBtnDisabled: { opacity: 0.5 },
  voiceBtnText: { color: "white", fontWeight: "900" },
  voiceMeta: { color: "#6b7280", fontSize: 12 },
});
