// app/feed.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  type Unsubscribe,
} from "firebase/firestore";

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

function VoicePlayButton({
  uri,
  durationMs,
}: {
  uri: string;
  durationMs?: number;
}) {
  const player = useAudioPlayer(uri, { downloadFirst: true });
  const status = useAudioPlayerStatus(player);

  const label = useMemo(() => {
    if (!status.isLoaded) return "Loading…";
    return status.playing ? "Pause Voice" : "Play Voice";
  }, [status.isLoaded, status.playing]);

  const meta = useMemo(() => {
    const dur = formatDuration(durationMs);
    return dur ? `(${dur})` : "";
  }, [durationMs]);

  const onPress = () => {
    if (!status.isLoaded) return;

    if (status.playing) {
      player.pause();
      return;
    }

    // If finished, restart from 0
    if (status.duration > 0 && status.currentTime >= status.duration) {
      player.seekTo(0);
    }
    player.play();
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={!status.isLoaded}
      style={({ pressed }) => [
        styles.voiceBtn,
        pressed && styles.voiceBtnPressed,
        !status.isLoaded && styles.voiceBtnDisabled,
      ]}
    >
      <Text style={styles.voiceBtnText}>
        {label} {meta}
      </Text>
    </Pressable>
  );
}

export default function FeedScreen() {
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<Entry[]>([]);

  useEffect(() => {
    const q = query(collection(db, "entries"), orderBy("createdAt", "desc"));

    const unsub: Unsubscribe = onSnapshot(
      q,
      (snap) => {
        const next: Entry[] = snap.docs.map((d) => {
          const data = d.data() as EntryDoc;
          return { id: d.id, ...data };
        });

        setEntries(next);
        setLoading(false);
      },
      (err) => {
        console.error("Feed snapshot error:", err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  const openEntry = (id: string) => {
    router.push(`/entry/${id}`);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.muted}>Loading feed…</Text>
      </View>
    );
  }

  if (!entries.length) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>No memories yet</Text>
        <Text style={styles.muted}>Add the first memory to get started.</Text>

        <Pressable
          onPress={() => router.push("/new-entry")}
          style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
        >
          <Text style={styles.ctaText}>+ Add Memory</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <FlatList
      data={entries}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => {
        const hasPhoto = !!item.photoUrl && item.photoUrl.trim().length > 0;
        const hasVoice = !!item.voiceUrl && item.voiceUrl.trim().length > 0;

        return (
          <Pressable onPress={() => openEntry(item.id)} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.author}>
                {item.authorName?.trim() ? item.authorName : "Anonymous"}
              </Text>
              <Text style={styles.time}>{formatTimestamp(item.createdAt)}</Text>
            </View>

            {!!item.title?.trim() && (
              <Text style={styles.entryTitle} numberOfLines={2}>
                {item.title}
              </Text>
            )}

            {!!item.details?.trim() && (
              <Text style={styles.body} numberOfLines={4}>
                {item.details}
              </Text>
            )}

            {hasPhoto && (
              <Image source={{ uri: item.photoUrl! }} style={styles.photo} />
            )}

            {hasVoice && (
              <View style={styles.voiceRow}>
                <VoicePlayButton uri={item.voiceUrl!} durationMs={item.voiceDurationMs} />
              </View>
            )}
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    padding: 12,
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

  card: {
    backgroundColor: "white",
    borderRadius: 14,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#e5e7eb",
    gap: 10,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  author: { fontWeight: "800", color: "#111827" },
  time: { color: "#6b7280", fontSize: 12 },

  entryTitle: { fontSize: 18, fontWeight: "800", color: "#111827" },
  body: { color: "#111827", fontSize: 16, lineHeight: 22 },

  photo: {
    width: "100%",
    height: 220,
    borderRadius: 12,
    backgroundColor: "#f3f4f6",
  },

  voiceRow: { flexDirection: "row" },
  voiceBtn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "#111827",
  },
  voiceBtnPressed: { opacity: 0.85 },
  voiceBtnDisabled: { opacity: 0.5 },
  voiceBtnText: { color: "white", fontWeight: "800" },

  cta: {
    marginTop: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: "#111827",
  },
  ctaPressed: { opacity: 0.85 },
  ctaText: { color: "white", fontWeight: "900" },
});
