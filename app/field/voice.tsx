// app/field/voice.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { CameraView, CameraType, useCameraPermissions } from "expo-camera";
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";

import { auth } from "@/lib/firebase";
import { saveLocalMemory } from "@/lib/localMemories";

const PHOTO_CAPTURE_COUNT_KEY = "deercamp.globalPhotoCaptureCount.v1";

function formatDuration(ms: number) {
  const totalSeconds = Math.max(0, Math.floor((ms || 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function PreviewVoiceControls({ uri }: { uri: string }) {
  const player = useAudioPlayer(uri, { downloadFirst: false });
  const status = useAudioPlayerStatus(player);

  const label = useMemo(() => {
    if (!status.isLoaded) return "Loading Voice…";
    return status.playing ? "Pause Voice" : "Play Voice";
  }, [status.isLoaded, status.playing]);

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
    <Pressable
      style={({ pressed }) => [
        styles.previewSecondaryBtn,
        pressed && styles.previewBtnPressed,
        !status.isLoaded && styles.btnDisabled,
      ]}
      onPress={onPress}
      disabled={!status.isLoaded}
    >
      <Text style={styles.previewSecondaryBtnText}>{label}</Text>
    </Pressable>
  );
}

export default function FieldVoiceScreen() {
  const user = auth.currentUser;
  const authorId = user?.uid || "anonymous";
  const authorName =
    user?.displayName?.trim() || user?.email?.trim() || "DeerCamp Member";

  const cameraRef = useRef<CameraView | null>(null);
  const autoStartedRef = useRef(false);

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>("back");
  const [cameraReady, setCameraReady] = useState(false);
  const [capturedUri, setCapturedUri] = useState("");
  const [previewAudioUri, setPreviewAudioUri] = useState("");
  const [takingPhoto, setTakingPhoto] = useState(false);
  const [bootingAudio, setBootingAudio] = useState(true);
  const [micDenied, setMicDenied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [recordingComplete, setRecordingComplete] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [helperCount, setHelperCount] = useState(0);

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);

  const elapsed = useMemo(
    () => formatDuration(recorderState.durationMillis || 0),
    [recorderState.durationMillis]
  );

  const shouldShowHelper = helperCount < 5 && !recordingComplete;

  useEffect(() => {
    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(PHOTO_CAPTURE_COUNT_KEY);
        const parsed = Number(raw || "0");
        setHelperCount(Number.isFinite(parsed) ? parsed : 0);
      } catch (error) {
        console.error("read photo capture count failed:", error);
      }
    })();
  }, []);

  const incrementPhotoCount = useCallback(async () => {
    try {
      const next = helperCount + 1;
      setHelperCount(next);
      await AsyncStorage.setItem(PHOTO_CAPTURE_COUNT_KEY, String(next));
    } catch (error) {
      console.error("increment photo capture count failed:", error);
    }
  }, [helperCount]);

  const startAutoRecording = useCallback(async () => {
    try {
      setBootingAudio(true);
      setMicDenied(false);

      const mic = await requestRecordingPermissionsAsync();
      if (!mic.granted) {
        setMicDenied(true);
        return;
      }

      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });

      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch (error: any) {
      console.error("auto start recording failed:", error);
      Alert.alert(
        "Audio failed",
        error?.message ?? "Could not start audio recording."
      );
      setMicDenied(true);
    } finally {
      setBootingAudio(false);
    }
  }, [recorder]);

  useEffect(() => {
    if (!user || user.isAnonymous) return;
    if (!cameraPermission?.granted) return;
    if (autoStartedRef.current) return;

    autoStartedRef.current = true;
    void startAutoRecording();
  }, [cameraPermission?.granted, startAutoRecording, user]);

  useEffect(() => {
    return () => {
      void (async () => {
        try {
          if (recorder.isRecording) {
            await recorder.stop();
          }
        } catch {}

        try {
          await setAudioModeAsync({
            allowsRecording: false,
          });
        } catch {}
      })();
    };
  }, [recorder]);

  async function onRetryAudio() {
    autoStartedRef.current = true;
    await startAutoRecording();
  }

  async function onTakePhoto() {
    if (!cameraRef.current || !cameraReady || takingPhoto || saving || recordingComplete) {
      return;
    }

    try {
      setTakingPhoto(true);

      const result = await cameraRef.current.takePictureAsync({
        quality: 0.75,
      });

      if (!result?.uri) {
        throw new Error("No photo was returned by the camera.");
      }

      setCapturedUri(result.uri);
      await incrementPhotoCount();
    } catch (error: any) {
      console.error("take photo failed:", error);
      Alert.alert("Camera failed", error?.message ?? "Please try again.");
    } finally {
      setTakingPhoto(false);
    }
  }

  async function onStopRecording() {
    if (saving || recordingComplete) return;

    if (!capturedUri.trim()) {
      Alert.alert(
        "Take a photo first",
        "Tap the white circle button or anywhere on the screen to take a photo before stopping the recording."
      );
      return;
    }

    try {
      if (recorder.isRecording) {
        await recorder.stop();
      }

      const audioUri = recorder.uri?.trim() || "";

      setPreviewAudioUri(audioUri);
      setRecordingComplete(true);
      setShowPreview(true);

      try {
        await setAudioModeAsync({
          allowsRecording: false,
        });
      } catch {}
    } catch (error: any) {
      console.error("stop recording failed:", error);
      Alert.alert("Stop failed", error?.message ?? "Please try again.");
    }
  }

  async function onSaveMemory() {
    if (saving) return;

    try {
      setSaving(true);

      if (!capturedUri.trim()) {
        Alert.alert("No photo", "Take a photo before saving.");
        return;
      }

      const now = Date.now();

      const payload: any = {
        id: `local-${authorId}-${now}`,
        title: "Field Memory",
        details: "Photo + audio captured in Field Mode.",
        clientCreatedAt: now,
        authorId,
        authorName,
        syncStatus: "pending",
        type: "photo",
        photoUri: capturedUri,
      };

      if (previewAudioUri.trim()) {
        payload.audioUri = previewAudioUri.trim();
        payload.voiceUri = previewAudioUri.trim();
      }

      await saveLocalMemory(payload);
      router.replace("/(tabs)/memories");
    } catch (error: any) {
      console.error("save local voice memory failed:", error);
      Alert.alert("Save failed", error?.message ?? "Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function onRetake() {
    try {
      setShowPreview(false);
      setRecordingComplete(false);
      setCapturedUri("");
      setPreviewAudioUri("");

      await startAutoRecording();
    } catch (error: any) {
      console.error("retake failed:", error);
      Alert.alert("Retake failed", error?.message ?? "Please try again.");
    }
  }

  function onGoHome() {
    setShowPreview(false);
    router.replace("/");
  }

  if (!user || user.isAnonymous) {
    return (
      <View style={styles.centerWrap}>
        <Text style={styles.gateTitle}>Sign in required</Text>
        <Text style={styles.gateText}>
          Please sign in before recording a memory.
        </Text>

        <Pressable
          style={styles.primaryBtn}
          onPress={() => router.replace("/sign-in")}
        >
          <Text style={styles.primaryBtnText}>Go to Sign In</Text>
        </Pressable>
      </View>
    );
  }

  if (!cameraPermission) {
    return (
      <View style={styles.centerWrap}>
        <ActivityIndicator />
        <Text style={styles.gateText}>Loading camera permissions…</Text>
      </View>
    );
  }

  if (!cameraPermission.granted) {
    return (
      <View style={styles.centerWrap}>
        <Ionicons
          name="camera-outline"
          size={40}
          color="white"
          style={{ marginBottom: 14 }}
        />
        <Text style={styles.gateTitle}>Camera access needed</Text>
        <Text style={styles.gateText}>
          DeerCamp needs camera permission so Record Memory can open right into
          the camera.
        </Text>

        <Pressable style={styles.primaryBtn} onPress={requestCameraPermission}>
          <Text style={styles.primaryBtnText}>Allow Camera</Text>
        </Pressable>

        <Pressable onPress={() => router.back()} style={{ marginTop: 14 }}>
          <Text style={styles.secondaryText}>Cancel</Text>
        </Pressable>
      </View>
    );
  }

  if (micDenied) {
    return (
      <View style={styles.centerWrap}>
        <Ionicons
          name="mic-off-outline"
          size={40}
          color="white"
          style={{ marginBottom: 14 }}
        />
        <Text style={styles.gateTitle}>Microphone access needed</Text>
        <Text style={styles.gateText}>
          Record Memory is designed to start audio automatically as soon as the
          camera opens.
        </Text>

        <Pressable style={styles.primaryBtn} onPress={onRetryAudio}>
          <Text style={styles.primaryBtnText}>Allow Microphone</Text>
        </Pressable>

        <Pressable onPress={() => router.back()} style={{ marginTop: 14 }}>
          <Text style={styles.secondaryText}>Back</Text>
        </Pressable>
      </View>
    );
  }

  if (bootingAudio && !recorderState.isRecording && !recordingComplete) {
    return (
      <View style={styles.centerWrap}>
        <ActivityIndicator />
        <Text style={styles.gateTitle}>Starting Record Memory…</Text>
        <Text style={styles.gateText}>
          Opening camera and starting audio automatically.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing={facing}
        onCameraReady={() => setCameraReady(true)}
      />

      {!recordingComplete ? (
        <Pressable
          style={styles.captureAnywhere}
          onPress={onTakePhoto}
          disabled={takingPhoto || saving}
        />
      ) : null}

      <View style={styles.overlayTop}>
        <Pressable style={styles.backPill} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={18} color="white" />
          <Text style={styles.backPillText}>Back</Text>
        </Pressable>

        <View style={styles.topRightStack}>
          <View style={styles.livePill}>
            <View style={styles.liveDot} />
            <Text style={styles.livePillText}>
              {recordingComplete ? "REC STOPPED" : `REC ${elapsed}`}
            </Text>
          </View>

          {capturedUri ? (
            <View style={styles.photoTakenPill}>
              <Ionicons name="checkmark-circle" size={16} color="#fff" />
              <Text style={styles.photoTakenPillText}>Photo captured</Text>
            </View>
          ) : null}
        </View>
      </View>

      {capturedUri ? (
        <View style={styles.thumbWrap}>
          <Image source={{ uri: capturedUri }} style={styles.thumb} />
        </View>
      ) : null}

      <View style={styles.overlayBottom}>
        <Text style={styles.captureTitle}>Record Memory</Text>

        {shouldShowHelper ? (
          <Text style={styles.captureText}>
            Tap the white circle button or anywhere on the screen to take photo.
          </Text>
        ) : (
          <Text style={styles.captureTextMuted}>
            Photo and audio will be saved locally.
          </Text>
        )}

        {!recordingComplete ? (
          <View style={styles.cameraActions}>
            <Pressable
              style={styles.flipBtn}
              onPress={() =>
                setFacing((current) => (current === "back" ? "front" : "back"))
              }
              disabled={saving}
            >
              <Ionicons
                name="camera-reverse-outline"
                size={22}
                color="white"
              />
            </Pressable>

            <Pressable
              style={[styles.shutterOuter, (takingPhoto || saving) && styles.btnDisabled]}
              onPress={onTakePhoto}
              disabled={takingPhoto || saving}
            >
              <View style={styles.shutterInner}>
                {takingPhoto ? <ActivityIndicator color="#111" /> : null}
              </View>
            </Pressable>

            <Pressable
              style={[styles.stopPill, saving && styles.btnDisabled]}
              onPress={onStopRecording}
              disabled={saving}
            >
              <View style={styles.stopSquare} />
              <Text style={styles.stopPillText}>Stop Recording</Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      {showPreview ? (
        <View style={styles.previewOverlay}>
          <View style={styles.previewCard}>
            <Text style={styles.previewTitle}>Field Memory Preview</Text>

            <Image source={{ uri: capturedUri }} style={styles.previewImage} />

            <View style={styles.previewUtilityRow}>
              {previewAudioUri ? (
                <PreviewVoiceControls uri={previewAudioUri} />
              ) : (
                <View style={styles.previewSecondaryBtnEmpty} />
              )}

              <Pressable style={styles.previewSecondaryBtn} onPress={onGoHome}>
                <Text style={styles.previewSecondaryBtnText}>Home</Text>
              </Pressable>
            </View>

            <View style={styles.previewPrimaryRow}>
              <Pressable
                style={[styles.previewPrimaryBtn, saving && styles.btnDisabled]}
                onPress={onSaveMemory}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#0B0E12" />
                ) : (
                  <Text style={styles.previewPrimaryBtnText}>Save</Text>
                )}
              </Pressable>

              <Pressable
                style={[styles.previewDangerBtn, saving && styles.btnDisabled]}
                onPress={onRetake}
                disabled={saving}
              >
                <Text style={styles.previewDangerBtnText}>Retake</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#000",
  },

  camera: {
    flex: 1,
  },

  captureAnywhere: {
    ...StyleSheet.absoluteFillObject,
  },

  overlayTop: {
    position: "absolute",
    top: 16,
    left: 16,
    right: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },

  topRightStack: {
    alignItems: "flex-end",
    gap: 8,
  },

  thumbWrap: {
    position: "absolute",
    top: 92,
    right: 16,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.75)",
    backgroundColor: "rgba(0,0,0,0.4)",
  },

  thumb: {
    width: 84,
    height: 112,
  },

  overlayBottom: {
    position: "absolute",
    left: 18,
    right: 18,
    bottom: 28,
    backgroundColor: "rgba(11,14,18,0.78)",
    borderColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderRadius: 24,
    padding: 18,
  },

  backPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(11,14,18,0.72)",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
  },

  backPillText: {
    color: "white",
    fontWeight: "900",
  },

  livePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(160,0,0,0.92)",
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
  },

  liveDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "white",
  },

  livePillText: {
    color: "white",
    fontWeight: "900",
    fontSize: 13,
  },

  photoTakenPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(24,24,24,0.8)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
  },

  photoTakenPillText: {
    color: "white",
    fontWeight: "900",
    fontSize: 13,
  },

  captureTitle: {
    color: "white",
    fontSize: 24,
    fontWeight: "900",
    marginBottom: 6,
  },

  captureText: {
    color: "rgba(255,255,255,0.84)",
    fontSize: 15,
    fontWeight: "800",
    lineHeight: 20,
    marginBottom: 18,
  },

  captureTextMuted: {
    color: "rgba(255,255,255,0.62)",
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 20,
    marginBottom: 0,
  },

  cameraActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },

  flipBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },

  shutterOuter: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 4,
    borderColor: "white",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
  },

  shutterInner: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: "white",
    alignItems: "center",
    justifyContent: "center",
  },

  stopPill: {
    minWidth: 168,
    height: 52,
    borderRadius: 18,
    backgroundColor: "#C62828",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 16,
  },

  stopSquare: {
    width: 12,
    height: 12,
    borderRadius: 2,
    backgroundColor: "white",
  },

  stopPillText: {
    color: "white",
    fontSize: 18,
    fontWeight: "900",
  },

  previewOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.72)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },

  previewCard: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#0B0E12",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    padding: 16,
  },

  previewTitle: {
    color: "white",
    fontSize: 24,
    fontWeight: "900",
    marginBottom: 12,
    textAlign: "center",
  },

  previewImage: {
    width: "100%",
    aspectRatio: 3 / 4,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.04)",
    marginBottom: 14,
  },

  previewUtilityRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 10,
  },

  previewPrimaryRow: {
    flexDirection: "row",
    gap: 10,
  },

  previewSecondaryBtn: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },

  previewSecondaryBtnEmpty: {
    flex: 1,
  },

  previewSecondaryBtnText: {
    color: "white",
    fontWeight: "900",
  },

  previewPrimaryBtn: {
    flex: 1,
    backgroundColor: "white",
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },

  previewPrimaryBtnText: {
    color: "#0B0E12",
    fontWeight: "900",
  },

  previewDangerBtn: {
    flex: 1,
    backgroundColor: "#C62828",
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },

  previewDangerBtnText: {
    color: "white",
    fontWeight: "900",
  },

  previewBtnPressed: {
    opacity: 0.9,
  },

  btnDisabled: {
    opacity: 0.45,
  },

  centerWrap: {
    flex: 1,
    backgroundColor: "#0B0E12",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },

  gateTitle: {
    color: "white",
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 8,
    textAlign: "center",
  },

  gateText: {
    color: "rgba(255,255,255,0.7)",
    textAlign: "center",
    fontWeight: "700",
    marginBottom: 20,
    lineHeight: 20,
  },

  primaryBtn: {
    backgroundColor: "white",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 16,
    minWidth: 220,
    alignItems: "center",
  },

  primaryBtnText: {
    color: "#0B0E12",
    fontSize: 16,
    fontWeight: "900",
  },

  secondaryText: {
    color: "rgba(255,255,255,0.6)",
    fontWeight: "700",
  },
});
