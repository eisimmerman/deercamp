// DeerCamp/app/(tabs)/feed.tsx
// Feed (Camp Memories) screen with photo preview + inline voice pill playback.
// Polished: stops audio on blur/navigation and before opening details.

import auth from "@react-native-firebase/auth";
import firestore from "@react-native-firebase/firestore";
import { Audio } from "expo-av";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

type Visibility = "public" | "camp";

type Entry = {
  id: string;
  title?: string;
  details?: string;
  visibility?: Visibility | string; // older values tolerated
  createdAt?: any; // Firestore Timestamp
  photoUrl?: string | null;
  voiceUrl?: string | null;
  voiceDurationMs?: number | null;
  authorUid?: string;
};

function visibilityLabel(v?: string) {
  const normalized = (v || "").toLowerCase().trim();
  if (normalized === "public") return "Public";
  if (normalized === "camp") return "Camp";
  // Back-compat / unexpected values:
  if (normalized === "private") return "Camp";
  return "Camp";
}

function formatDuration(ms?: number | null) {
  if (!ms || ms <= 0) return "";
  const totalSec = Math.round(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function FeedScreen() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);

  // Audio (single instance for the feed)
  const soundRef = useRef<Audio.Sound | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const uid = auth().currentUser?.uid;

  useEffect(() => {
    // Android audio mode (safe defaults)
    Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
      interruptionModeAndroid: 1,
      interruptionModeIOS: 1,
    }).catch(() => {});
  }, []);

  const stopAndUnload = useCallback(async () => {
    try {
      if (soundRef.current) {
        try {
          const st = await soundRef.current.getStatusAsync();
          if (st.isLoaded && st.isPlaying) {
            await soundRef.current.stopAsync();
          }
        } catch {}
        await soundRef.current.unloadAsync();
        soundRef.current.setOnPlaybackStatusUpdate(null);
        soundRef.current = null;
      }
    } catch {
      // ignore
    } finally {
      setPlayingId(null);
      setIsPlaying(false);
    }
  }, []);

  // ✅ Strong cleanup: when feed loses focus (tab switch / navigate)
  useFocusEffect(
    useCallback(() => {
      return () => {
        void stopAndUnload();
      };
    }, [stopAndUnload])
  );

  useEffect(() => {
    setLoading(true);

    const unsub = firestore()
      .collection("entries")
      .orderBy("createdAt", "desc")
      .limit(100)
      .onSnapshot(
        (snap) => {
          const list: Entry[] = snap.docs.map((d) => {
            const data = d.data() as any;
            return {
              id: d.id,
              title: data.title ?? "",
              details: data.details ?? "",
              visibility: data.visibility ?? "camp",
              createdAt: data.createdAt,
              photoUrl: data.photoUrl ?? null,
              voiceUrl: data.voiceUrl ?? null,
              voiceDurationMs: data.voiceDurationMs ?? null,
              authorUid: data.authorUid ?? data.uid ?? undefined,
            };
          });

          setEntries(list);
          setLoading(false);
        },
        (err) => {
          console.log("Feed snapshot error:", err);
          setEntries([]);
          setLoading(false);
        }
      );

    return () => unsub();
  }, [uid]);

  const playOrToggle = async (entry: Entry) => {
    if (!entry.voiceUrl) return;

    // If tapping the same entry: toggle pause/play
    if (playingId === entry.id && soundRef.current) {
      try {
        const status = await soundRef.current.getStatusAsync();
        if (!status.isLoaded) return;

        if (status.isPlaying) {
          await soundRef.current.pauseAsync();
          setIsPlaying(false);
        } else {
          await soundRef.current.playAsync();
          setIsPlaying(true);
        }
        return;
      } catch {
        await stopAndUnload();
        return;
      }
    }

    // New entry: stop any current audio first
    await stopAndUnload();

    try {
      const { sound } = await Audio.Sound.createAsync(
        { uri: entry.voiceUrl },
        { shouldPlay: true, isLooping: false },
        (status) => {
          if (!status.isLoaded) return;

          // If finished, reset UI + prevent looping / repeated playback
          if (status.didJustFinish) {
            void stopAndUnload();
          }
        }
      );

      soundRef.current = sound;
      setPlayingId(entry.id);
      setIsPlaying(true);
    } catch (e) {
      console.log("Voice play error:", e);
      await stopAndUnload();
    }
  };

  const openDetails = async (id: string) => {
    // ✅ Prevent overlap: stop feed audio before navigating
    await stopAndUnload();
    router.push(`/entry/${id}` as any);
  };

  const renderItem = ({ item }: { item: Entry }) => {
    const pillText = visibilityLabel(item.visibility);
    const hasVoice = !!item.voiceUrl;
    const durationText = formatDuration(item.voiceDurationMs);

    const isThisPlaying = playingId === item.id && isPlaying;

    return (
      <Pressable style={styles.card} onPress={() => void openDetails(item.id)}>
        <View style={styles.cardTopRow}>
          <Text style={styles.title} numberOfLines={2} ellipsizeMode="tail">
            {item.title || "Untitled"}
          </Text>

          <View
            style={[
              styles.pill,
              pillText === "Public" ? styles.pillPublic : styles.pillCamp,
            ]}
          >
            <Text style={styles.pillText}>{pillText}</Text>
          </View>
        </View>

        {item.photoUrl ? (
          <Image source={{ uri: item.photoUrl }} style={styles.photo} resizeMode="cover" />
        ) : null}

        {!!item.details ? (
          <Text style={styles.details} numberOfLines={2} ellipsizeMode="tail">
            {item.details}
          </Text>
        ) : null}

        {hasVoice ? (
          <Pressable
            style={styles.voicePill}
            onPress={(e) => {
              // prevent card navigation
              // @ts-ignore - RN event supports stopPropagation
              e?.stopPropagation?.();
              void playOrToggle(item);
            }}
          >
            <Text style={styles.voicePillText}>
              {isThisPlaying ? "Pause Voice" : "Play Voice"}
              {durationText ? ` • ${durationText}` : ""}
            </Text>
          </Pressable>
        ) : null}
      </Pressable>
    );
  };

  const keyExtractor = useMemo(() => (item: Entry) => item.id, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.loadingText}>Loading memories…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={entries}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={styles.emptyTitle}>No memories yet</Text>
            <Text style={styles.emptyText}>Tap + Add to post your first one.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0B0E12" },
  listContent: { padding: 16, paddingBottom: 28 },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0B0E12",
    padding: 16,
  },
  loadingText: { marginTop: 10, color: "rgba(255,255,255,0.75)" },

  emptyTitle: { color: "white", fontSize: 18, fontWeight: "700" },
  emptyText: {
    marginTop: 6,
    color: "rgba(255,255,255,0.75)",
    textAlign: "center",
  },

  card: {
    backgroundColor: "#121826",
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },

  cardTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },

  title: {
    flex: 1,
    color: "white",
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 20,
  },

  pill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  pillPublic: {
    backgroundColor: "rgba(46, 204, 113, 0.12)",
    borderColor: "rgba(46, 204, 113, 0.35)",
  },
  pillCamp: {
    backgroundColor: "rgba(52, 152, 219, 0.12)",
    borderColor: "rgba(52, 152, 219, 0.35)",
  },
  pillText: { color: "white", fontSize: 12, fontWeight: "700" },

  photo: {
    width: "100%",
    height: 220,
    borderRadius: 12,
    marginTop: 10,
    backgroundColor: "rgba(255,255,255,0.06)",
  },

  details: {
    marginTop: 10,
    color: "rgba(255,255,255,0.78)",
    fontSize: 13,
    lineHeight: 18,
  },

  voicePill: {
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    alignSelf: "flex-start",
  },
  voicePillText: {
    color: "white",
    fontSize: 13,
    fontWeight: "800",
  },
});
