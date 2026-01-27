// DeerCamp/app/entry/[id].tsx

import auth from "@react-native-firebase/auth";
import firestore from "@react-native-firebase/firestore";
import { Audio } from "expo-av";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import BottomNav, { BOTTOM_NAV_BASE_HEIGHT } from "../../components/BottomNav";
import { useUserProfile } from "../../lib/useUserProfile";

type Visibility = "public" | "camp";

type Entry = {
  id: string;
  title: string;
  details: string;

  authorId: string;
  authorName?: string;

  createdAt?: any;
  visibility?: Visibility | string;

  photoUrl?: string | null;

  voiceUrl?: string | null;
  voiceDurationMs?: number | null;
};

type Comment = {
  id: string;
  text: string;
  authorId?: string;
  authorName?: string;
  createdAt?: any;
};

function normalizeVisibility(v?: string): Visibility {
  const s = (v || "").toLowerCase().trim();
  if (s === "public") return "public";
  if (s === "camp") return "camp";
  if (s === "private") return "camp";
  return "camp";
}

function visibilityLabel(v?: string) {
  const norm = normalizeVisibility(v);
  return norm === "public" ? "Public" : "Camp";
}

function fmtDuration(ms?: number | null) {
  const v = ms || 0;
  if (!v) return "";
  const total = Math.floor(v / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function fmtWhen(ts: any) {
  try {
    if (!ts) return "";
    const d = ts?.toDate?.() ? ts.toDate() : new Date(ts);
    if (!(d instanceof Date) || isNaN(d.getTime())) return "";
    // Simple, readable: Jan 20 • 4:12 PM
    return `${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })} • ${d.toLocaleTimeString(
      undefined,
      { hour: "numeric", minute: "2-digit" }
    )}`;
  } catch {
    return "";
  }
}

export default function EntryDetailsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile } = useUserProfile();
  const user = auth().currentUser;

  const params = useLocalSearchParams();
  const entryId = String(params?.id || "");

  const [loading, setLoading] = useState(true);
  const [entry, setEntry] = useState<Entry | null>(null);

  // ✅ Keyboard handling (fix overlap)
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // Comments input
  const [commentText, setCommentText] = useState("");
  const canPostComment = useMemo(
    () => !!user && commentText.trim().length > 0,
    [user, commentText]
  );

  // ✅ Comments list (read + render)
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(true);

  // Audio playback
  const soundRef = useRef<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoadingVoice, setIsLoadingVoice] = useState(false);

  const displayName = useMemo(() => {
    return profile?.displayName?.trim() || "Unknown";
  }, [profile?.displayName]);

  // ✅ Listen to keyboard show/hide + height (Android + iOS)
  useEffect(() => {
    const showSub = Keyboard.addListener("keyboardDidShow", (e) => {
      setKeyboardVisible(true);
      const h = e?.endCoordinates?.height ?? 0;
      setKeyboardHeight(h);
    });
    const hideSub = Keyboard.addListener("keyboardDidHide", () => {
      setKeyboardVisible(false);
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const stopAndUnloadSound = useCallback(async () => {
    try {
      if (soundRef.current) {
        try {
          const st: any = await soundRef.current.getStatusAsync();
          if (st?.isLoaded && st?.isPlaying) {
            await soundRef.current.stopAsync();
          }
        } catch {}
        await soundRef.current.unloadAsync();
        soundRef.current.setOnPlaybackStatusUpdate(null);
        soundRef.current = null;
      }
    } catch {}
    setIsPlaying(false);
    setIsLoadingVoice(false);
  }, []);

  // Stop audio when leaving screen
  useFocusEffect(
    useCallback(() => {
      return () => {
        void stopAndUnloadSound();
      };
    }, [stopAndUnloadSound])
  );

  const togglePlayVoice = useCallback(async () => {
    try {
      if (!entry?.voiceUrl) return;

      if (soundRef.current) {
        const st: any = await soundRef.current.getStatusAsync();
        if (st?.isLoaded && st?.isPlaying) {
          await soundRef.current.pauseAsync();
          setIsPlaying(false);
          return;
        }
        if (st?.isLoaded) {
          await soundRef.current.playAsync();
          setIsPlaying(true);
          return;
        }
      }

      setIsLoadingVoice(true);
      await stopAndUnloadSound();

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        staysActiveInBackground: false,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
      });

      const { sound } = await Audio.Sound.createAsync(
        { uri: entry.voiceUrl },
        { shouldPlay: true, isLooping: false }
      );

      soundRef.current = sound;
      setIsPlaying(true);
      setIsLoadingVoice(false);

      sound.setOnPlaybackStatusUpdate((status: any) => {
        if (!status?.isLoaded) return;
        if (status?.didJustFinish) {
          void stopAndUnloadSound();
        }
      });
    } catch (e: any) {
      setIsLoadingVoice(false);
      Alert.alert("Playback failed", e?.message || "Could not play voice note.");
      await stopAndUnloadSound();
    }
  }, [entry?.voiceUrl, stopAndUnloadSound, entry]);

  const postComment = async () => {
    try {
      if (!user || !entry) {
        Alert.alert("Not signed in", "Sign in to comment.");
        return;
      }

      const text = commentText.trim();
      if (!text) return;

      await firestore()
        .collection("entries")
        .doc(entry.id)
        .collection("comments")
        .add({
          text,
          authorId: user.uid,
          authorName: profile?.displayName?.trim() || "Hunter",
          createdAt: firestore.FieldValue.serverTimestamp(),
        });

      setCommentText("");
      Alert.alert("Posted", "Comment added.");
      // No need to manually refresh: onSnapshot below will update instantly.
    } catch (e: any) {
      Alert.alert("Comment failed", e?.message || "Unknown error.");
    }
  };

  // ✅ Subscribe to the entry doc
  useEffect(() => {
    if (!entryId) return;

    const unsub = firestore()
      .collection("entries")
      .doc(entryId)
      .onSnapshot(
        (snap) => {
          if (!snap.exists()) {
            setEntry(null);
            setLoading(false);
            return;
          }

          const data = snap.data() as any;
          const authorId = data?.authorId || data?.authorUid || data?.uid || "";

          setEntry({
            id: snap.id,
            title: data?.title || "",
            details: data?.details || "",
            authorId,
            authorName: data?.authorName || data?.authorDisplayName || "Unknown",
            createdAt: data?.createdAt,
            visibility: normalizeVisibility(data?.visibility),
            photoUrl: data?.photoUrl || null,
            voiceUrl: data?.voiceUrl || null,
            voiceDurationMs: data?.voiceDurationMs || 0,
          });

          setLoading(false);
        },
        () => setLoading(false)
      );

    return () => {
      unsub();
      void stopAndUnloadSound();
    };
  }, [entryId, stopAndUnloadSound]);

  // ✅ Subscribe to comments (real-time)
  useEffect(() => {
    if (!entryId) return;

    setCommentsLoading(true);

    const unsub = firestore()
      .collection("entries")
      .doc(entryId)
      .collection("comments")
      .orderBy("createdAt", "asc")
      .limit(200)
      .onSnapshot(
        (snap) => {
          const list: Comment[] = snap.docs.map((d) => {
            const data = d.data() as any;
            return {
              id: d.id,
              text: data?.text || "",
              authorId: data?.authorId || "",
              authorName: data?.authorName || "Hunter",
              createdAt: data?.createdAt,
            };
          });
          setComments(list);
          setCommentsLoading(false);
        },
        (err) => {
          console.log("Comments snapshot error:", err);
          setComments([]);
          setCommentsLoading(false);
        }
      );

    return () => unsub();
  }, [entryId]);

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingWrap}>
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  if (!entry) {
    return (
      <SafeAreaView style={styles.notFoundWrap}>
        <Text style={styles.notFoundTitle}>Memory not found</Text>
        <Pressable
          style={[styles.btn, styles.btnLight, { marginTop: 12 }]}
          onPress={() => router.back()}
        >
          <Text style={styles.btnTextDark}>Go Back</Text>
        </Pressable>

        {!keyboardVisible ? <BottomNav /> : null}
      </SafeAreaView>
    );
  }

  const visLabel = visibilityLabel(entry.visibility);
  const isMine = !!user?.uid && entry.authorId === user.uid;

  // ✅ Dynamic bottom padding
  const bottomPad = keyboardVisible
    ? keyboardHeight + 24
    : BOTTOM_NAV_BASE_HEIGHT + Math.max(insets.bottom, 10) + 24;

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 14,
            paddingBottom: bottomPad,
          }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.titleBig}>{entry.title || "Untitled"}</Text>

          <View style={styles.metaRow}>
            <Text style={styles.metaName}>{entry.authorName || displayName}</Text>
            <View style={styles.visPill}>
              <Text style={styles.visText}>{visLabel}</Text>
            </View>
          </View>

          {entry.photoUrl ? (
            <Image source={{ uri: entry.photoUrl }} style={styles.photo} resizeMode="cover" />
          ) : null}

          <Text style={styles.details}>{entry.details || ""}</Text>

          {entry.voiceUrl ? (
            <Pressable
              style={[styles.voiceBtn, isLoadingVoice ? styles.voiceBtnDisabled : null]}
              onPress={() => void togglePlayVoice()}
              disabled={isLoadingVoice}
            >
              <Text style={styles.voiceBtnText}>
                {isLoadingVoice
                  ? "Loading…"
                  : `🎙️ ${isPlaying ? "Pause" : "Play"} Voice${
                      entry.voiceDurationMs ? ` (${fmtDuration(entry.voiceDurationMs)})` : ""
                    }`}
              </Text>
            </Pressable>
          ) : null}

          {/* ✅ Comments section */}
          <Text style={styles.commentsTitle}>Comments</Text>
          <Text style={styles.commentsSub}>Tap to add comments</Text>

          {commentsLoading ? (
            <View style={{ paddingVertical: 10 }}>
              <ActivityIndicator />
            </View>
          ) : comments.length === 0 ? (
            <Text style={styles.emptyComments}>No comments yet.</Text>
          ) : (
            <View style={styles.commentsList}>
              {comments.map((c) => (
                <View key={c.id} style={styles.commentCard}>
                  <View style={styles.commentHeader}>
                    <Text style={styles.commentAuthor}>{c.authorName || "Hunter"}</Text>
                    {!!fmtWhen(c.createdAt) ? (
                      <Text style={styles.commentWhen}>{fmtWhen(c.createdAt)}</Text>
                    ) : null}
                  </View>
                  <Text style={styles.commentText}>{c.text}</Text>
                </View>
              ))}
            </View>
          )}

          <TextInput
            value={commentText}
            onChangeText={setCommentText}
            placeholder="Tap to add comments…"
            placeholderTextColor="#aaa"
            style={styles.commentInput}
            multiline
          />

          <Pressable
            disabled={!canPostComment}
            style={[styles.postCommentBtn, !canPostComment ? styles.postDisabled : null]}
            onPress={postComment}
          >
            <Text style={styles.postCommentText}>Post</Text>
          </Pressable>

          {!isMine && normalizeVisibility(entry.visibility) !== "public" ? (
            <Text style={styles.noteText}>This memory is not public.</Text>
          ) : null}
        </ScrollView>

        {!keyboardVisible ? <BottomNav /> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safe: { flex: 1, backgroundColor: "#fff" },

  loadingWrap: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },

  notFoundWrap: { flex: 1, backgroundColor: "#fff", padding: 16 },
  notFoundTitle: { fontSize: 22, fontWeight: "900" },

  titleBig: { fontSize: 44, fontWeight: "900", marginBottom: 10 },

  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 14,
  },
  metaName: { fontSize: 22, fontWeight: "900", color: "#666", flex: 1 },

  visPill: {
    borderWidth: 2,
    borderColor: "#111",
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: "#fff",
  },
  visText: { fontSize: 18, fontWeight: "900", color: "#111" },

  photo: {
    width: "100%",
    height: 260,
    borderRadius: 18,
    marginBottom: 16,
    backgroundColor: "#f1f1f1",
  },

  details: {
    fontSize: 22,
    fontWeight: "800",
    color: "#111",
    lineHeight: 30,
    marginBottom: 18,
  },

  voiceBtn: {
    borderWidth: 3,
    borderColor: "#111",
    borderRadius: 22,
    paddingVertical: 18,
    paddingHorizontal: 16,
    backgroundColor: "#fff",
    marginBottom: 18,
  },
  voiceBtnDisabled: { opacity: 0.6 },
  voiceBtnText: { fontSize: 20, fontWeight: "900", color: "#111", textAlign: "center" },

  commentsTitle: { fontSize: 40, fontWeight: "900", marginTop: 10, color: "#111" },
  commentsSub: { fontSize: 22, fontWeight: "900", color: "#999", marginTop: 4, marginBottom: 12 },

  emptyComments: {
    fontSize: 18,
    fontWeight: "800",
    color: "#999",
    marginBottom: 12,
  },

  commentsList: { gap: 10, marginBottom: 12 },

  commentCard: {
    borderWidth: 2,
    borderColor: "#111",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "#fff",
  },
  commentHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 10,
  },
  commentAuthor: { fontSize: 18, fontWeight: "900", color: "#111", flex: 1 },
  commentWhen: { fontSize: 14, fontWeight: "800", color: "#777" },
  commentText: { marginTop: 8, fontSize: 20, fontWeight: "800", color: "#111", lineHeight: 28 },

  commentInput: {
    borderWidth: 3,
    borderColor: "#111",
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 22,
    fontWeight: "800",
    minHeight: 70,
  },

  postCommentBtn: {
    marginTop: 12,
    height: 74,
    borderRadius: 22,
    backgroundColor: "#111",
    alignItems: "center",
    justifyContent: "center",
  },
  postDisabled: { backgroundColor: "#aaa" },
  postCommentText: { fontSize: 26, fontWeight: "900", color: "#fff" },

  btn: {
    height: 72,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#111",
  },
  btnLight: { backgroundColor: "#fff" },
  btnTextDark: { fontSize: 20, fontWeight: "900", color: "#111" },

  noteText: { marginTop: 14, fontSize: 14, fontWeight: "800", color: "#666" },
});
