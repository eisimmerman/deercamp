// DeerCamp/app/new-entry.tsx

import auth from "@react-native-firebase/auth";
import firestore from "@react-native-firebase/firestore";
import storage from "@react-native-firebase/storage";
import { Audio } from "expo-av";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import BottomNav, { BOTTOM_NAV_BASE_HEIGHT } from "../components/BottomNav";
import { useUserProfile } from "../lib/useUserProfile";

type Visibility = "public" | "camp";

type MicStatus = "unknown" | "granted" | "denied";

export default function NewEntryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile } = useUserProfile();
  const user = auth().currentUser;

  // --- Form fields ---
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("public");

  // --- Photo (optional) ---
  const [photoUri, setPhotoUri] = useState<string>(""); // local
  const [photoUrl, setPhotoUrl] = useState<string>(""); // uploaded

  // --- Voice note ---
  const recordingRef = useRef<Audio.Recording | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);

  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  const [voiceUri, setVoiceUri] = useState<string>(""); // local file uri
  const [voiceUrl, setVoiceUrl] = useState<string>(""); // uploaded url
  const [voiceDurationMs, setVoiceDurationMs] = useState<number>(0);

  // --- Posting ---
  const [posting, setPosting] = useState(false);

  // --- Mic permission UX ---
  const [micStatus, setMicStatus] = useState<MicStatus>("unknown");
  const [showMicSettingsCard, setShowMicSettingsCard] = useState(false);

  const displayName = useMemo(() => {
    const n = profile?.displayName?.trim();
    return n || "Hunter";
  }, [profile?.displayName]);

  const canPost = useMemo(() => {
    return !!user && title.trim().length > 0 && details.trim().length > 0 && !posting;
  }, [user, title, details, posting]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      (async () => {
        try {
          if (recordingRef.current) {
            await recordingRef.current.stopAndUnloadAsync();
            recordingRef.current = null;
          }
        } catch {}
        try {
          if (soundRef.current) {
            await soundRef.current.unloadAsync();
            soundRef.current = null;
          }
        } catch {}
      })();
    };
  }, []);

  // --------------------------
  // Mic Permission (Ask once + Settings flow + re-check on return)
  // --------------------------
  const checkMicPermission = async (): Promise<boolean> => {
    try {
      const current = await Audio.getPermissionsAsync();
      const granted = !!current.granted;
      setMicStatus(granted ? "granted" : "denied");
      if (granted) setShowMicSettingsCard(false);
      return granted;
    } catch {
      setMicStatus("denied");
      return false;
    }
  };

  // Initial check on mount
  useEffect(() => {
    void checkMicPermission();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-check mic permission when returning from Settings / app foreground
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void checkMicPermission();
      }
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openSettings = async () => {
    try {
      await Linking.openSettings();
    } catch {
      Alert.alert("Open Settings", "Please open Settings and turn on Microphone access for DeerCamp.");
    }
  };

  const requestMicPermissionOnce = async (): Promise<boolean> => {
    try {
      const current = await Audio.getPermissionsAsync();
      if (current.granted) {
        setMicStatus("granted");
        setShowMicSettingsCard(false);
        return true;
      }

      const req = await Audio.requestPermissionsAsync();
      if (req.granted) {
        setMicStatus("granted");
        setShowMicSettingsCard(false);
        return true;
      }

      // Denied: show our simple elderly-friendly UI (no repeated alerts)
      setMicStatus("denied");
      setShowMicSettingsCard(true);
      return false;
    } catch (e: any) {
      setMicStatus("denied");
      setShowMicSettingsCard(true);
      Alert.alert("Permission error", e?.message || "Could not request microphone permission.");
      return false;
    }
  };

  // --------------------------
  // Photo picker (optional)
  // --------------------------
  const pickPhoto = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Permission needed", "Please allow photo access to attach an image.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.85,
      });

      if (result.canceled) return;
      const asset = result.assets?.[0];
      if (!asset?.uri) return;

      setPhotoUri(asset.uri);
      setPhotoUrl(""); // reset uploaded url (will re-upload on post)
    } catch (e: any) {
      Alert.alert("Photo pick failed", e?.message || "Unknown error.");
    }
  };

  // --------------------------
  // Audio helpers
  // --------------------------
  const stopAndUnloadSound = async () => {
    try {
      if (soundRef.current) {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
    } catch {}
    setIsPlaying(false);
  };

  // --------------------------
  // Voice recording
  // --------------------------
  const startRecording = async () => {
    if (!user) {
      Alert.alert("Not signed in", "Sign in to post memories with voice notes.");
      return;
    }

    // ✅ Ask once. If denied, show Settings card UI.
    const ok = await requestMicPermissionOnce();
    if (!ok) return;

    try {
      // Stop any playback first
      await stopAndUnloadSound();

      // Set audio mode for recording
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      const recording = new Audio.Recording();
      recordingRef.current = recording;

      await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await recording.startAsync();

      setIsRecording(true);

      // reset previous audio
      setVoiceUri("");
      setVoiceUrl("");
      setVoiceDurationMs(0);
    } catch (e: any) {
      setIsRecording(false);
      recordingRef.current = null;
      Alert.alert("Recording failed", e?.message || "Could not start recording.");
    }
  };

  const stopRecording = async () => {
    try {
      const recording = recordingRef.current;
      if (!recording) return;

      setIsRecording(false);

      await recording.stopAndUnloadAsync();
      const uri = recording.getURI() || "";
      const status = await recording.getStatusAsync();

      recordingRef.current = null;

      if (!uri) {
        Alert.alert("No recording saved", "Try recording again.");
        return;
      }

      setVoiceUri(uri);
      setVoiceDurationMs((status as any)?.durationMillis || 0);

      // Reset audio mode for playback
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
    } catch (e: any) {
      setIsRecording(false);
      recordingRef.current = null;
      Alert.alert("Stop failed", e?.message || "Could not stop recording.");
    }
  };

  const togglePlay = async () => {
    try {
      if (!voiceUri && !voiceUrl) return;

      const sourceUri = voiceUri || voiceUrl;

      // If already loaded, toggle play/pause
      if (soundRef.current) {
        const status = await soundRef.current.getStatusAsync();
        const s = status as any;
        if (!s?.isLoaded) return;

        if (s.isPlaying) {
          await soundRef.current.pauseAsync();
          setIsPlaying(false);
        } else {
          await soundRef.current.playAsync();
          setIsPlaying(true);
        }
        return;
      }

      // Load new sound (no looping)
      const { sound } = await Audio.Sound.createAsync(
        { uri: sourceUri },
        { shouldPlay: true, isLooping: false }
      );

      soundRef.current = sound;
      setIsPlaying(true);

      sound.setOnPlaybackStatusUpdate((status: any) => {
        if (!status?.isLoaded) return;
        setIsPlaying(!!status.isPlaying);

        // When finished: reset to 0 and keep Play visible
        if (status.didJustFinish) {
          (async () => {
            try {
              await soundRef.current?.setPositionAsync(0);
            } catch {}
            setIsPlaying(false);
          })();
        }
      });
    } catch (e: any) {
      Alert.alert("Playback failed", e?.message || "Could not play the voice note.");
      await stopAndUnloadSound();
    }
  };

  const removeVoiceNote = async () => {
    await stopAndUnloadSound();
    setIsRecording(false);
    recordingRef.current = null;
    setVoiceUri("");
    setVoiceUrl("");
    setVoiceDurationMs(0);
  };

  const fmtDuration = (ms: number) => {
    if (!ms) return "";
    const total = Math.floor(ms / 1000);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  // --------------------------
  // Upload helpers
  // --------------------------
  const uploadFileToStorage = async (localUri: string, path: string) => {
    const ref = storage().ref(path);
    await ref.putFile(localUri);
    return await ref.getDownloadURL();
  };

  // --------------------------
  // Post entry (with step-specific errors)
  // --------------------------
  const postEntry = async () => {
    try {
      if (!user) {
        Alert.alert("Not signed in", "Please sign in to post a memory.");
        router.push("/sign-in" as any);
        return;
      }

      if (!title.trim() || !details.trim()) {
        Alert.alert("Missing info", "Please add a Title and Details.");
        return;
      }

      setPosting(true);

      // Upload photo (if selected)
      let finalPhotoUrl = photoUrl;
      if (photoUri && !finalPhotoUrl) {
        try {
          const ext = photoUri.toLowerCase().includes(".png") ? "png" : "jpg";
          const path = `entries/${user.uid}/photos/photo_${Date.now()}.${ext}`;
          finalPhotoUrl = await uploadFileToStorage(photoUri, path);
        } catch (e: any) {
          Alert.alert("Photo upload failed", e?.message || "Could not upload photo.");
          return;
        }
      }

      // Upload voice note (if recorded)
      let finalVoiceUrl = voiceUrl;
      if (voiceUri && !finalVoiceUrl) {
        try {
          const ext = "m4a";
          const path = `entries/${user.uid}/audio/voice_${Date.now()}.${ext}`;
          finalVoiceUrl = await uploadFileToStorage(voiceUri, path);
        } catch (e: any) {
          Alert.alert("Voice upload failed", e?.message || "Could not upload voice note.");
          return;
        }
      }

      // Create Firestore doc
      try {
        await firestore().collection("entries").add({
          title: title.trim(),
          details: details.trim(),
          visibility, // ✅ "public" or "camp"
          createdAt: firestore.FieldValue.serverTimestamp(),
          clientCreatedAt: Date.now(), // feed sorting stable immediately
          authorId: user.uid,
          authorName: displayName,
          photoUrl: finalPhotoUrl || "",
          voiceUrl: finalVoiceUrl || "",
          voiceDurationMs: finalVoiceUrl ? voiceDurationMs : 0,
        });
      } catch (e: any) {
        Alert.alert("Saving memory failed", e?.message || "Could not save your memory.");
        return;
      }

      Alert.alert("Posted!", "Your memory is live.");

      // Optional: clear form state (keeps UX clean if user returns)
      setTitle("");
      setDetails("");
      setPhotoUri("");
      setPhotoUrl("");
      await stopAndUnloadSound();
      setVoiceUri("");
      setVoiceUrl("");
      setVoiceDurationMs(0);
      setIsRecording(false);

      router.replace("/feed" as any);
    } catch (e: any) {
      Alert.alert("Post failed", e?.message || "Unknown error.");
    } finally {
      setPosting(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 14,
          paddingBottom: BOTTOM_NAV_BASE_HEIGHT + Math.max(insets.bottom, 10) + 24,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.h1}>+ Add Memory</Text>

        {/* Title */}
        <Text style={styles.label}>Title</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="e.g., New Memory"
          placeholderTextColor="#aaa"
          style={styles.input}
        />

        {/* Details */}
        <Text style={styles.label}>Details</Text>
        <TextInput
          value={details}
          onChangeText={setDetails}
          placeholder="What happened?"
          placeholderTextColor="#aaa"
          style={[styles.input, styles.textArea]}
          multiline
        />

        {/* Photo attach */}
        <View style={{ marginTop: 14 }}>
          <Text style={styles.sectionTitle}>Photo (optional)</Text>

          {photoUri ? (
            <View style={styles.photoBox}>
              <Image source={{ uri: photoUri }} style={styles.photo} />
            </View>
          ) : null}

          <Pressable style={[styles.btn, styles.btnLight]} onPress={pickPhoto}>
            <Text style={styles.btnTextDark}>{photoUri ? "Change Photo" : "Add Photo"}</Text>
          </Pressable>
        </View>

        {/* Voice note */}
        <View style={{ marginTop: 18 }}>
          <Text style={styles.sectionTitle}>Voice note (optional)</Text>

          {/* ✅ Permission-denied UI (simple, elderly-friendly) */}
          {showMicSettingsCard && micStatus === "denied" ? (
            <View style={styles.micCard}>
              <Text style={styles.micTitle}>Microphone access is needed</Text>
              <Text style={styles.micBody}>
                To record a voice memory, DeerCamp needs access to your microphone.
              </Text>

              <Pressable style={[styles.btn, styles.btnDark]} onPress={openSettings}>
                <Text style={styles.btnTextLight}>Open Settings</Text>
                <Text style={styles.btnTextLightSub}>
                  Turn on <Text style={{ fontWeight: "900" }}>Microphone</Text> for DeerCamp, then come back.
                </Text>
              </Pressable>

              <Pressable
                style={[styles.btn, styles.btnLight, { marginTop: 12 }]}
                onPress={() => {
                  // user can retry without alert loops
                  setShowMicSettingsCard(false);
                }}
              >
                <Text style={styles.btnTextDark}>Not now</Text>
              </Pressable>
            </View>
          ) : null}

          {!isRecording ? (
            <Pressable style={[styles.btn, styles.btnDark]} onPress={startRecording}>
              <Text style={styles.btnTextLight}>Tap to Record</Text>
              <Text style={styles.btnTextLightSub}>Voice Note</Text>
            </Pressable>
          ) : (
            <Pressable style={[styles.btn, styles.btnStop]} onPress={stopRecording}>
              <Text style={styles.btnTextStop}>Tap to Stop</Text>
              <Text style={styles.btnTextStopSub}>Recording…</Text>
            </Pressable>
          )}

          {(voiceUri || voiceUrl) && !isRecording ? (
            <View style={styles.voiceActionsRow}>
              <Pressable style={[styles.smallBtn, styles.smallBtnDark]} onPress={togglePlay}>
                <Text style={styles.smallBtnTextLight}>{isPlaying ? "Pause" : "Play"}</Text>
                <Text style={styles.smallBtnSubLight}>{fmtDuration(voiceDurationMs)}</Text>
              </Pressable>

              <Pressable style={[styles.smallBtn, styles.smallBtnLight]} onPress={removeVoiceNote}>
                <Text style={styles.smallBtnTextDark}>Remove</Text>
                <Text style={styles.smallBtnSubDark}>Voice Note</Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        {/* Posting as / visibility */}
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Posting as</Text>
          <Text style={styles.metaValue}>{displayName}</Text>
        </View>

        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Visibility</Text>
          <Pressable
            onPress={() => setVisibility((v) => (v === "public" ? "camp" : "public"))}
            style={styles.visibilityPill}
          >
            <Text style={styles.visibilityText}>{visibility === "public" ? "Public" : "Camp"}</Text>
          </Pressable>
        </View>

        {/* Post */}
        <Pressable
          disabled={!canPost}
          style={[styles.postBtn, !canPost ? styles.postBtnDisabled : null]}
          onPress={postEntry}
        >
          {posting ? <ActivityIndicator /> : <Text style={styles.postText}>Post</Text>}
        </Pressable>

        {!user ? (
          <Text style={styles.helpText}>You’re not signed in. Tap Home → Sign in to post.</Text>
        ) : null}
      </ScrollView>

      <BottomNav />
    </View>
  );
}

const styles = StyleSheet.create({
  h1: { fontSize: 44, fontWeight: "900", marginBottom: 14 },
  label: { fontSize: 22, fontWeight: "900", marginTop: 12, marginBottom: 8 },

  input: {
    borderWidth: 3,
    borderColor: "#111",
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 20,
    fontWeight: "700",
  },
  textArea: { minHeight: 140, textAlignVertical: "top" },

  sectionTitle: { fontSize: 18, fontWeight: "900", color: "#777", marginBottom: 10 },

  micCard: {
    borderWidth: 3,
    borderColor: "#111",
    borderRadius: 18,
    padding: 14,
    marginBottom: 14,
    backgroundColor: "#fff",
  },
  micTitle: { fontSize: 22, fontWeight: "900", color: "#111" },
  micBody: { marginTop: 6, fontSize: 18, fontWeight: "800", color: "#555", lineHeight: 24 },

  btn: {
    height: 72,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#111",
    marginTop: 10,
    paddingHorizontal: 14,
  },
  btnLight: { backgroundColor: "#fff" },
  btnDark: { backgroundColor: "#111" },

  btnStop: { backgroundColor: "#fff", borderColor: "#111" },

  btnTextDark: { fontSize: 20, fontWeight: "900", color: "#111" },
  btnTextLight: { fontSize: 22, fontWeight: "900", color: "#fff", lineHeight: 24 },
  btnTextLightSub: {
    marginTop: 6,
    fontSize: 14,
    fontWeight: "900",
    color: "#fff",
    opacity: 0.95,
    textAlign: "center",
  },
  btnTextStop: { fontSize: 22, fontWeight: "900", color: "#111", lineHeight: 24 },
  btnTextStopSub: { marginTop: 4, fontSize: 16, fontWeight: "900", color: "#111", opacity: 0.75 },

  voiceActionsRow: { flexDirection: "row", gap: 12, marginTop: 12 },
  smallBtn: {
    flex: 1,
    height: 66,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#111",
  },
  smallBtnDark: { backgroundColor: "#111" },
  smallBtnLight: { backgroundColor: "#fff" },

  smallBtnTextLight: { fontSize: 20, fontWeight: "900", color: "#fff", lineHeight: 22 },
  smallBtnSubLight: { marginTop: 2, fontSize: 14, fontWeight: "900", color: "#fff", opacity: 0.9 },
  smallBtnTextDark: { fontSize: 20, fontWeight: "900", color: "#111", lineHeight: 22 },
  smallBtnSubDark: { marginTop: 2, fontSize: 14, fontWeight: "900", color: "#111", opacity: 0.7 },

  photoBox: {
    borderWidth: 1,
    borderColor: "#e5e5e5",
    borderRadius: 18,
    overflow: "hidden",
    marginBottom: 10,
  },
  photo: { width: "100%", height: 220 },

  metaRow: { marginTop: 18, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  metaLabel: { fontSize: 22, fontWeight: "900", color: "#999" },
  metaValue: { fontSize: 22, fontWeight: "900", color: "#111" },

  visibilityPill: {
    borderWidth: 2,
    borderColor: "#e5e5e5",
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: "#fff",
  },
  visibilityText: { fontSize: 18, fontWeight: "900" },

  postBtn: {
    marginTop: 18,
    height: 76,
    borderRadius: 24,
    backgroundColor: "#111",
    alignItems: "center",
    justifyContent: "center",
  },
  postBtnDisabled: { backgroundColor: "#aaa" },
  postText: { fontSize: 24, fontWeight: "900", color: "#fff" },

  helpText: { marginTop: 12, color: "#666", fontSize: 14, fontWeight: "700" },
});
