import React, { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { CameraView, CameraType, useCameraPermissions } from "expo-camera";

import { auth } from "@/lib/firebase";
import { saveLocalMemory } from "@/lib/localMemories";

export default function FieldPhotoScreen() {
  const user = auth.currentUser;
  const authorId = user?.uid || "anonymous";
  const authorName =
    user?.displayName?.trim() || user?.email?.trim() || "DeerCamp Member";

  const cameraRef = useRef<CameraView | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>("back");
  const [capturedUri, setCapturedUri] = useState("");
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [saving, setSaving] = useState(false);
  const [takingPhoto, setTakingPhoto] = useState(false);

  const canSave = useMemo(() => {
    return capturedUri.trim().length > 0 && !saving;
  }, [capturedUri, saving]);

  if (!user || user.isAnonymous) {
    return (
      <View style={styles.centerWrap}>
        <Text style={styles.gateTitle}>Sign in required</Text>
        <Text style={styles.gateText}>
          Please sign in before adding a photo memory.
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

  if (!permission) {
    return (
      <View style={styles.centerWrap}>
        <ActivityIndicator />
        <Text style={styles.gateText}>Loading camera permissions…</Text>
      </View>
    );
  }

  if (!permission.granted) {
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
          DeerCamp needs camera permission so you can capture a field photo.
        </Text>

        <Pressable style={styles.primaryBtn} onPress={requestPermission}>
          <Text style={styles.primaryBtnText}>Allow Camera</Text>
        </Pressable>

        <Pressable onPress={() => router.back()} style={{ marginTop: 14 }}>
          <Text style={styles.secondaryText}>Cancel</Text>
        </Pressable>
      </View>
    );
  }

  async function onTakePhoto() {
    if (!cameraRef.current || takingPhoto) return;

    try {
      setTakingPhoto(true);

      const result = await cameraRef.current.takePictureAsync({
        quality: 0.75,
      });

      if (!result?.uri) {
        throw new Error("No photo was returned by the camera.");
      }

      setCapturedUri(result.uri);
    } catch (error: any) {
      console.error("take photo failed:", error);
      Alert.alert("Camera failed", error?.message ?? "Please try again.");
    } finally {
      setTakingPhoto(false);
    }
  }

  async function onSaveLocal() {
    if (!capturedUri.trim()) {
      Alert.alert("Add a photo", "Take at least one photo before saving.");
      return;
    }

    try {
      setSaving(true);

      const now = Date.now();

      await saveLocalMemory({
        id: `local-${authorId}-${now}`,
        title: title.trim() || "Field Photo",
        details: details.trim(),
        clientCreatedAt: now,
        authorId,
        authorName,
        photoUri: capturedUri,
        syncStatus: "pending",
        type: "photo",
      });

      Alert.alert(
        "Saved locally",
        "Your photo memory is saved on this device and queued for later upload.",
        [
          {
            text: "View Memories",
            onPress: () => router.replace("/(tabs)/memories"),
          },
        ]
      );
    } catch (error: any) {
      console.error("save local photo memory failed:", error);
      Alert.alert("Save failed", error?.message ?? "Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (!capturedUri) {
    return (
      <View style={styles.screen}>
        <View style={styles.cameraWrap}>
          <CameraView ref={cameraRef} style={styles.camera} facing={facing} />

          <View style={styles.overlayTop}>
            <Pressable style={styles.backPill} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={18} color="white" />
              <Text style={styles.backPillText}>Back</Text>
            </Pressable>
          </View>

          <View style={styles.overlayBottom}>
            <Text style={styles.captureTitle}>Capture Photo</Text>
            <Text style={styles.captureText}>
              Tap the button below to take a field photo and save it locally.
            </Text>

            <View style={styles.cameraActions}>
              <Pressable
                style={styles.flipBtn}
                onPress={() =>
                  setFacing((current) =>
                    current === "back" ? "front" : "back"
                  )
                }
              >
                <Ionicons
                  name="camera-reverse-outline"
                  size={22}
                  color="white"
                />
              </Pressable>

              <Pressable style={styles.shutterOuter} onPress={onTakePhoto}>
                <View style={styles.shutterInner}>
                  {takingPhoto ? <ActivityIndicator color="#111" /> : null}
                </View>
              </Pressable>

              <View style={styles.flipBtnGhost} />
            </View>
          </View>
        </View>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.reviewPage}>
      <Text style={styles.reviewTitle}>Review Photo Memory</Text>
      <Text style={styles.reviewText}>
        This saves to local storage now so it appears in Memories immediately.
      </Text>

      <Image source={{ uri: capturedUri }} style={styles.preview} />

      <Text style={styles.label}>Title</Text>
      <TextInput
        value={title}
        onChangeText={setTitle}
        placeholder="e.g. Morning Buck by the Creek"
        placeholderTextColor="rgba(255,255,255,0.35)"
        style={styles.input}
      />

      <Text style={styles.label}>Details</Text>
      <TextInput
        value={details}
        onChangeText={setDetails}
        placeholder="Add quick field notes."
        placeholderTextColor="rgba(255,255,255,0.35)"
        style={[styles.input, styles.textarea]}
        multiline
      />

      <View style={styles.row}>
        <Pressable
          style={[styles.secondaryBtn, saving && styles.btnDisabled]}
          onPress={() => setCapturedUri("")}
          disabled={saving}
        >
          <Text style={styles.secondaryBtnText}>Retake</Text>
        </Pressable>

        <Pressable
          style={[styles.primarySaveBtn, !canSave && styles.btnDisabled]}
          onPress={onSaveLocal}
          disabled={!canSave}
        >
          {saving ? (
            <ActivityIndicator color="#111" />
          ) : (
            <Text style={styles.primarySaveBtnText}>Save Locally</Text>
          )}
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#000",
  },

  cameraWrap: {
    flex: 1,
    backgroundColor: "#000",
  },

  camera: {
    flex: 1,
  },

  overlayTop: {
    position: "absolute",
    top: 16,
    left: 16,
    right: 16,
    flexDirection: "row",
    justifyContent: "flex-start",
  },

  overlayBottom: {
    position: "absolute",
    left: 18,
    right: 18,
    bottom: 28,
    backgroundColor: "rgba(11,14,18,0.72)",
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

  captureTitle: {
    color: "white",
    fontSize: 24,
    fontWeight: "900",
    marginBottom: 6,
  },

  captureText: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 20,
    marginBottom: 18,
  },

  cameraActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  flipBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },

  flipBtnGhost: {
    width: 52,
    height: 52,
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

  reviewPage: {
    padding: 18,
    backgroundColor: "#0B0E12",
    gap: 10,
  },

  reviewTitle: {
    color: "white",
    fontSize: 28,
    fontWeight: "900",
    marginTop: 10,
  },

  reviewText: {
    color: "rgba(255,255,255,0.7)",
    lineHeight: 20,
    fontWeight: "700",
    marginBottom: 6,
  },

  preview: {
    width: "100%",
    height: 360,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.08)",
    marginTop: 8,
  },

  label: {
    color: "rgba(255,255,255,0.78)",
    fontWeight: "800",
    marginTop: 10,
    marginBottom: 4,
  },

  input: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "white",
    fontWeight: "700",
  },

  textarea: {
    minHeight: 120,
    textAlignVertical: "top",
  },

  row: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
    marginBottom: 24,
  },

  secondaryBtn: {
    flex: 1,
    height: 56,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },

  secondaryBtnText: {
    color: "white",
    fontSize: 17,
    fontWeight: "900",
  },

  primarySaveBtn: {
    flex: 1,
    height: 56,
    borderRadius: 16,
    backgroundColor: "white",
    alignItems: "center",
    justifyContent: "center",
  },

  primarySaveBtnText: {
    color: "#111",
    fontSize: 17,
    fontWeight: "900",
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
