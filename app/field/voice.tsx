// app/field/voice.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { CameraView, CameraType, useCameraPermissions } from "expo-camera";
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";

import { auth } from "@/lib/firebase";
import { getActiveCampId, getActiveCampName, saveLocalMemory } from "@/lib/localMemories";
import {
  createAudioSegment,
  createInitialSegmentState,
  createSegmentMemoryId,
  DEFAULT_AUDIO_SEGMENT_MS,
  getSegmentSummary,
  type SegmentManagerState,
} from "@/lib/capture/segmentManager";
import { enqueueUploadItems } from "@/lib/capture/uploadQueue";

const PHOTO_CAPTURE_COUNT_KEY = "deercamp.globalPhotoCaptureCount.v1";

const FIELD_MEMORY_DIR = `${FileSystem.documentDirectory || ""}deercamp-field-memories/`;

function getUriExtension(uri: string, fallback: string) {
  const clean = String(uri || "").split("?")[0]?.split("#")[0] || "";
  const match = clean.match(/\.([a-zA-Z0-9]+)$/);
  return match?.[1]?.toLowerCase() || fallback;
}

async function ensureDirectoryExists(directoryUri: string) {
  const info = await FileSystem.getInfoAsync(directoryUri);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(directoryUri, { intermediates: true });
  }
}

async function persistFileForUpload(params: {
  sourceUri: string;
  memoryId: string;
  fileName: string;
}) {
  const sourceUri = String(params.sourceUri || "").trim();
  const memoryId = String(params.memoryId || "").trim();
  const fileName = String(params.fileName || "").trim();

  if (!sourceUri) {
    throw new Error("Cannot persist upload file because source URI is missing.");
  }

  if (!memoryId || !fileName) {
    throw new Error("Cannot persist upload file because memory id or file name is missing.");
  }

  const sourceInfo = await FileSystem.getInfoAsync(sourceUri, { size: true });
  if (!sourceInfo.exists) {
    throw new Error(`Cannot persist upload file because source file does not exist: ${sourceUri}`);
  }

  const memoryDirectory = `${FIELD_MEMORY_DIR}${memoryId}/`;
  await ensureDirectoryExists(FIELD_MEMORY_DIR);
  await ensureDirectoryExists(memoryDirectory);

  const destinationUri = `${memoryDirectory}${fileName}`;

  if (sourceUri !== destinationUri) {
    const destinationInfo = await FileSystem.getInfoAsync(destinationUri);
    if (destinationInfo.exists) {
      await FileSystem.deleteAsync(destinationUri, { idempotent: true });
    }

    await FileSystem.copyAsync({
      from: sourceUri,
      to: destinationUri,
    });
  }

  const copiedInfo = await FileSystem.getInfoAsync(destinationUri, { size: true });
  if (!copiedInfo.exists) {
    throw new Error(`Cannot persist upload file because copy was not created: ${destinationUri}`);
  }

  return destinationUri;
}


function getFieldMemoryPlatformLabel() {
  if (Platform.OS === "ios") return "iOS";
  if (Platform.OS === "android") return "Android";
  return Platform.OS || "Unknown";
}

function buildFieldMemoryPlatformMeta() {
  const platform = getFieldMemoryPlatformLabel();

  return {
    platform,
    devicePlatform: platform,
    sourcePlatform: platform,
    appPlatform: platform,
    operatingSystem: platform,
    deviceInfo: {
      platform,
      os: platform,
      operatingSystem: platform,
      appSource: "CampFieldApp",
    },
  };
}

function isKeepAwakeActivationError(error: unknown) {
  const message = String(
    (error as any)?.message ||
      (error as any)?.reason?.message ||
      error ||
      ""
  );

  return message.toLowerCase().includes("unable to activate keep awake");
}


function formatDuration(ms: number) {
  const totalSeconds = Math.max(0, Math.floor((ms || 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export default function FieldVoiceScreen() {
  const params = useLocalSearchParams<{ mode?: string | string[] }>();
  const mode = Array.isArray(params.mode) ? params.mode[0] : params.mode;
  const photoOnly = mode === "photo";

  const user = auth.currentUser;
  const authorId = user?.uid || "anonymous";
  const authorName =
    user?.displayName?.trim() || user?.email?.trim() || "DeerCamp Member";

  const cameraRef = useRef<CameraView | null>(null);
  const autoStartedRef = useRef(false);
  const segmentTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const segmentStateRef = useRef<SegmentManagerState | null>(null);
  const currentSegmentStartedAtRef = useRef(0);
  const finalizingSegmentRef = useRef(false);
  const recordingCompleteRef = useRef(false);

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>("back");
  const [cameraReady, setCameraReady] = useState(false);
  const [capturedUri, setCapturedUri] = useState("");
  const [takingPhoto, setTakingPhoto] = useState(false);
  const [bootingAudio, setBootingAudio] = useState(!photoOnly);
  const [micDenied, setMicDenied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [recordingComplete, setRecordingComplete] = useState(false);
  const [helperCount, setHelperCount] = useState(0);
  const [activeCampId, setActiveCampIdState] = useState("");
  const [activeCampName, setActiveCampNameState] = useState("Camp Swede");

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);

  const elapsed = useMemo(
    () => formatDuration(recorderState.durationMillis || 0),
    [recorderState.durationMillis]
  );

  useEffect(() => {
    const errorUtils = (globalThis as any)?.ErrorUtils;
    const previousHandler =
      typeof errorUtils?.getGlobalHandler === "function"
        ? errorUtils.getGlobalHandler()
        : null;

    if (typeof errorUtils?.setGlobalHandler === "function") {
      errorUtils.setGlobalHandler((error: unknown, isFatal?: boolean) => {
        if (isKeepAwakeActivationError(error)) {
          console.warn("Keep awake activation failed; continuing capture.", error);
          return;
        }

        if (typeof previousHandler === "function") {
          previousHandler(error, isFatal);
        }
      });
    }

    const previousUnhandledRejection = (globalThis as any).onunhandledrejection;

    (globalThis as any).onunhandledrejection = (event: any) => {
      if (isKeepAwakeActivationError(event?.reason || event)) {
        console.warn(
          "Keep awake activation failed in promise; continuing capture.",
          event?.reason || event
        );
        event?.preventDefault?.();
        return true;
      }

      if (typeof previousUnhandledRejection === "function") {
        return previousUnhandledRejection(event);
      }

      return false;
    };

    return () => {
      if (
        typeof errorUtils?.setGlobalHandler === "function" &&
        typeof previousHandler === "function"
      ) {
        errorUtils.setGlobalHandler(previousHandler);
      }

      (globalThis as any).onunhandledrejection = previousUnhandledRejection;
    };
  }, []);

  const clearSegmentTimer = useCallback(() => {
    if (segmentTimerRef.current) {
      clearInterval(segmentTimerRef.current);
      segmentTimerRef.current = null;
    }
  }, []);

  const addCurrentRecordingAsSegment = useCallback(
    (uri: string, durationMs?: number) => {
      if (!segmentStateRef.current || !uri.trim()) return;

      const result = createAudioSegment({
        state: segmentStateRef.current,
        uri: uri.trim(),
        durationMs,
      });

      segmentStateRef.current = result.nextState;
    },
    []
  );

  const rotateSegment = useCallback(async () => {
    if (finalizingSegmentRef.current || recordingCompleteRef.current) return;
    if (!recorder.isRecording) return;

    try {
      finalizingSegmentRef.current = true;

      const segmentDurationMs =
        currentSegmentStartedAtRef.current > 0
          ? Date.now() - currentSegmentStartedAtRef.current
          : DEFAULT_AUDIO_SEGMENT_MS;

      await recorder.stop();

      const completedUri = recorder.uri?.trim() || "";
      addCurrentRecordingAsSegment(completedUri, segmentDurationMs);

      if (recordingCompleteRef.current) return;

      await recorder.prepareToRecordAsync();
      recorder.record();
      currentSegmentStartedAtRef.current = Date.now();
    } catch (error) {
      console.error("rotate audio segment failed:", error);
    } finally {
      finalizingSegmentRef.current = false;
    }
  }, [addCurrentRecordingAsSegment, recorder]);

  const startSegmentTimer = useCallback(() => {
    clearSegmentTimer();

    segmentTimerRef.current = setInterval(() => {
      void rotateSegment();
    }, DEFAULT_AUDIO_SEGMENT_MS);
  }, [clearSegmentTimer, rotateSegment]);

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

  useEffect(() => {
    let alive = true;

    void (async () => {
      try {
        const campId = await getActiveCampId();
        const campName = await getActiveCampName(campId);

        if (!alive) return;

        setActiveCampIdState(campId);
        setActiveCampNameState(campName);
      } catch (error) {
        console.error("read active camp target failed:", error);
      }
    })();

    return () => {
      alive = false;
    };
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
    if (photoOnly) return;

    try {
      clearSegmentTimer();

      setBootingAudio(true);
      setMicDenied(false);
      recordingCompleteRef.current = false;
      finalizingSegmentRef.current = false;

      const memoryId = createSegmentMemoryId(authorId);
      segmentStateRef.current = createInitialSegmentState(memoryId);

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

      currentSegmentStartedAtRef.current = Date.now();
      startSegmentTimer();
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
  }, [authorId, clearSegmentTimer, photoOnly, recorder, startSegmentTimer]);

  useEffect(() => {
    if (photoOnly) {
      setBootingAudio(false);
      return;
    }

    if (!user || user.isAnonymous) return;
    if (!cameraPermission?.granted) return;
    if (autoStartedRef.current) return;

    autoStartedRef.current = true;
    void startAutoRecording();
  }, [cameraPermission?.granted, photoOnly, startAutoRecording, user]);

  useEffect(() => {
    return () => {
      clearSegmentTimer();

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
  }, [clearSegmentTimer, recorder]);

  async function onRetryAudio() {
    autoStartedRef.current = true;
    await startAutoRecording();
  }

  async function takePhoto() {
    if (!cameraRef.current || !cameraReady) {
      throw new Error("Camera is still getting ready.");
    }

    const result = await cameraRef.current.takePictureAsync({
      quality: 0.75,
    });

    if (!result?.uri) {
      throw new Error("No photo was returned by the camera.");
    }

    await incrementPhotoCount();
    setCapturedUri(result.uri);
    return result.uri;
  }

  async function queuePhotoOnlyMemory(photoUri: string) {
    const memoryId = `local-photo-${authorId}-${Date.now()}`;
    const now = Date.now();
    const campId = await getActiveCampId();
    const persistedPhotoUri = await persistFileForUpload({
      sourceUri: photoUri,
      memoryId,
      fileName: "photo.jpg",
    });

    await saveLocalMemory({
      id: memoryId,
      title: "Field Photo",
      details: "Photo saved locally. DeerCamp will publish it when service is available.",
      clientCreatedAt: now,
      authorId,
      authorName,
      syncStatus: "pending",
      type: "photo",
      photoUri: persistedPhotoUri,
      captureVersion: 2,
      isSegmented: false,
      segmentCount: 0,
      parentMemoryTitle: "Field Photo",
      campId,
      targetCampName: await getActiveCampName(campId),
      ...buildFieldMemoryPlatformMeta(),
    });

    await enqueueUploadItems([
      {
        id: `${memoryId}-upload-photo-main`,
        memoryId,
        segmentId: "photo-main",
        segmentIndex: -1,
        uri: persistedPhotoUri,
        mediaType: "photo" as const,
        campId,
        authorId,
      },
    ]);
  }

  async function queueVoiceMemory(photoUri: string) {
    const campId = await getActiveCampId();
    const state = segmentStateRef.current;
    const summary = state ? getSegmentSummary(state) : null;
    const segments = summary?.segments || [];
    const totalDurationMs =
      summary?.totalDurationMs ||
      segments.reduce((sum, segment) => sum + Math.max(0, Number(segment.durationMs || 0)), 0) ||
      recorderState.durationMillis ||
      0;
    const memoryId = state?.memoryId || `local-${authorId}-${Date.now()}`;
    const now = Date.now();
    const persistedPhotoUri = await persistFileForUpload({
      sourceUri: photoUri,
      memoryId,
      fileName: "photo.jpg",
    });
    const persistedSegments = await Promise.all(
      segments.map(async (segment) => {
        const sourceUri = String(segment.uri || "").trim();
        if (!sourceUri) return segment;

        const extension = getUriExtension(sourceUri, "m4a");
        const persistedUri = await persistFileForUpload({
          sourceUri,
          memoryId,
          fileName: `audio-${String(segment.index).padStart(3, "0")}.${extension}`,
        });

        return {
          ...segment,
          uri: persistedUri,
        };
      })
    );
    const firstAudioUri = persistedSegments[0]?.uri?.trim() || "";
    const audioContentType = firstAudioUri.toLowerCase().endsWith(".mp3")
      ? "audio/mpeg"
      : firstAudioUri.toLowerCase().endsWith(".wav")
        ? "audio/wav"
        : firstAudioUri.toLowerCase().endsWith(".aac")
          ? "audio/aac"
          : "audio/mp4";

    const payload: any = {
      id: memoryId,
      title: "Field Memory",
      details: "Photo + voice saved locally. DeerCamp will publish it when service is available.",
      clientCreatedAt: now,
      authorId,
      authorName,
      syncStatus: "pending",
      type: "fieldMemory",
      photoUri: persistedPhotoUri,
      captureVersion: 2,
      isSegmented: segments.length > 0,
      segmentCount: segments.length,
      totalDurationMs: totalDurationMs || undefined,
      audioDurationMs: totalDurationMs || undefined,
      audioDurationSeconds: totalDurationMs ? Math.round(totalDurationMs / 1000) : undefined,
      audioContentType,
      parentMemoryTitle: "Field Memory",
      campId,
      targetCampName: await getActiveCampName(campId),
      ...buildFieldMemoryPlatformMeta(),
      segments: persistedSegments,
    };

    if (firstAudioUri) {
      payload.audioUri = firstAudioUri;
      payload.voiceUri = firstAudioUri;
    }

    await saveLocalMemory(payload);

    const uploadItems = [
      {
        id: `${memoryId}-upload-photo-main`,
        memoryId,
        segmentId: "photo-main",
        segmentIndex: -1,
        uri: persistedPhotoUri,
        mediaType: "photo" as const,
        campId,
        authorId,
      },
      ...persistedSegments.map((segment) => ({
        id: `${memoryId}-upload-${String(segment.index).padStart(3, "0")}`,
        memoryId,
        segmentId: segment.id,
        segmentIndex: segment.index,
        uri: segment.uri,
        mediaType: "audio" as const,
        campId,
        authorId,
      })),
    ];

    await enqueueUploadItems(uploadItems);
  }

  async function onTakePhoto() {
    if (takingPhoto || saving || recordingComplete) return;

    try {
      setTakingPhoto(true);
      const photoUri = await takePhoto();

      if (photoOnly) {
        setSaving(true);
        await queuePhotoOnlyMemory(photoUri);
        router.replace("/(tabs)/memories");
      }
    } catch (error: any) {
      console.error("take photo failed:", error);
      Alert.alert("Camera failed", error?.message ?? "Please try again.");
    } finally {
      setTakingPhoto(false);
      setSaving(false);
    }
  }

  async function onStopRecording() {
    if (saving || recordingCompleteRef.current || photoOnly) return;

    if (!capturedUri.trim()) {
      Alert.alert(
        "Take a photo first",
        "Tap the white circle button or anywhere on the screen before stopping."
      );
      return;
    }

    try {
      setSaving(true);
      clearSegmentTimer();
      recordingCompleteRef.current = true;
      setRecordingComplete(true);

      if (recorder.isRecording) {
        const finalDurationMs =
          currentSegmentStartedAtRef.current > 0
            ? Date.now() - currentSegmentStartedAtRef.current
            : recorderState.durationMillis || 0;

        await recorder.stop();

        const finalUri = recorder.uri?.trim() || "";
        addCurrentRecordingAsSegment(finalUri, finalDurationMs);
      }

      try {
        await setAudioModeAsync({
          allowsRecording: false,
        });
      } catch {}

      await queueVoiceMemory(capturedUri);
      router.replace("/(tabs)/memories");
    } catch (error: any) {
      console.error("stop and save recording failed:", error);
      Alert.alert("Save failed", error?.message ?? "Please try again.");
      recordingCompleteRef.current = false;
      setRecordingComplete(false);
    } finally {
      setSaving(false);
    }
  }

  function onGoBack() {
    clearSegmentTimer();
    router.replace("/(tabs)");
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
          DeerCamp needs camera permission to capture field memories.
        </Text>

        <Pressable style={styles.primaryBtn} onPress={requestCameraPermission}>
          <Text style={styles.primaryBtnText}>Allow Camera</Text>
        </Pressable>

        <Pressable onPress={onGoBack} style={{ marginTop: 14 }}>
          <Text style={styles.secondaryText}>Cancel</Text>
        </Pressable>
      </View>
    );
  }

  if (!photoOnly && micDenied) {
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
          Record Memory starts audio automatically when the camera opens.
        </Text>

        <Pressable style={styles.primaryBtn} onPress={onRetryAudio}>
          <Text style={styles.primaryBtnText}>Allow Microphone</Text>
        </Pressable>

        <Pressable onPress={onGoBack} style={{ marginTop: 14 }}>
          <Text style={styles.secondaryText}>Back</Text>
        </Pressable>
      </View>
    );
  }

  if (!photoOnly && bootingAudio && !recorderState.isRecording && !recordingComplete) {
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

      <Pressable
        style={styles.captureAnywhere}
        onPress={onTakePhoto}
        disabled={takingPhoto || saving || recordingComplete}
      />

      <View style={styles.overlayTop}>
        <Pressable style={styles.backPill} onPress={onGoBack}>
          <Ionicons name="arrow-back" size={18} color="white" />
          <Text style={styles.backPillText}>Back</Text>
        </Pressable>

        {!photoOnly ? (
          <View style={styles.livePill}>
            <View style={styles.liveDot} />
            <Text style={styles.livePillText}>
              {recordingComplete ? "REC STOPPED" : `REC ${elapsed}`}
            </Text>
          </View>
        ) : null}
      </View>

      {capturedUri ? (
        <View style={styles.thumbWrap}>
          <Image source={{ uri: capturedUri }} style={styles.thumb} />
        </View>
      ) : null}

      <View style={styles.overlayBottom}>
        <Text style={styles.captureTitle}>
          {photoOnly ? "Photo Only" : "Record Memory"}
        </Text>

        <Text style={styles.captureText}>
          {photoOnly ? "Tap to take photo." : "Audio auto-recording."}
        </Text>

        <View style={styles.campTargetPill}>
          <Ionicons name="navigate-circle-outline" size={16} color="white" />
          <Text style={styles.campTargetText}>
            Current Camp: {activeCampName || "Camp Swede"}{activeCampId ? "" : ""}
          </Text>
        </View>

        <View style={styles.cameraActions}>
          <Pressable
            style={styles.flipBtn}
            onPress={() =>
              setFacing((current) => (current === "back" ? "front" : "back"))
            }
            disabled={saving}
          >
            <Ionicons name="camera-reverse-outline" size={22} color="white" />
          </Pressable>

          <Pressable
            style={[
              styles.shutterOuter,
              (takingPhoto || saving) && styles.btnDisabled,
            ]}
            onPress={onTakePhoto}
            disabled={takingPhoto || saving || recordingComplete}
          >
            <View style={styles.shutterInner}>
              {takingPhoto || (photoOnly && saving) ? (
                <ActivityIndicator color="#111" />
              ) : null}
            </View>
          </Pressable>

          {!photoOnly ? (
            <Pressable
              style={[styles.stopPill, saving && styles.btnDisabled]}
              onPress={onStopRecording}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="white" />
              ) : (
                <>
                  <View style={styles.stopSquare} />
                  <Text style={styles.stopPillText}>Stop</Text>
                </>
              )}
            </Pressable>
          ) : (
            <View style={styles.stopPillPlaceholder} />
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#000" },
  camera: { flex: 1 },
  captureAnywhere: { ...StyleSheet.absoluteFillObject },

  overlayTop: {
    position: "absolute",
    top: 38,
    left: 16,
    right: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },

  thumbWrap: {
    position: "absolute",
    top: 112,
    right: 16,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.75)",
    backgroundColor: "rgba(0,0,0,0.4)",
  },

  thumb: { width: 84, height: 112 },

  overlayBottom: {
    position: "absolute",
    left: 18,
    right: 18,
    bottom: 30,
    backgroundColor: "rgba(11,14,18,0.66)",
    borderColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderRadius: 24,
    padding: 16,
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

  backPillText: { color: "white", fontWeight: "900" },

  livePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(160,0,0,0.92)",
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
  },

  liveDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "white" },
  livePillText: { color: "white", fontWeight: "900", fontSize: 13 },

  captureTitle: {
    color: "white",
    fontSize: 24,
    fontWeight: "900",
    marginBottom: 6,
  },

  captureText: {
    color: "rgba(255,255,255,0.78)",
    fontSize: 15,
    fontWeight: "800",
    lineHeight: 20,
    marginBottom: 14,
  },

  campTargetPill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 8,
    marginBottom: 14,
  },

  campTargetText: {
    color: "rgba(255,255,255,0.88)",
    fontSize: 13,
    fontWeight: "900",
  },

  cameraActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
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
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 4,
    borderColor: "white",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
  },

  shutterInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "white",
    alignItems: "center",
    justifyContent: "center",
  },

  stopPill: {
    width: 108,
    height: 52,
    borderRadius: 18,
    backgroundColor: "#C62828",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    paddingHorizontal: 12,
  },

  stopPillPlaceholder: {
    width: 108,
    height: 52,
  },

  stopSquare: { width: 12, height: 12, borderRadius: 2, backgroundColor: "white" },
  stopPillText: { color: "white", fontSize: 18, fontWeight: "900" },

  btnDisabled: { opacity: 0.45 },

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

  primaryBtnText: { color: "#0B0E12", fontSize: 16, fontWeight: "900" },
  secondaryText: { color: "rgba(255,255,255,0.6)", fontWeight: "700" },
});
