// app/field/index.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { signInAnonymously } from "firebase/auth";

import { auth } from "@/src/lib/firebase";
import { useUserProfile } from "@/src/lib/useUserProfile";

type Params = {
  entryId?: string;
};

export default function FieldIndexScreen() {
  const { entryId } = useLocalSearchParams<Params>();
  const { profile } = useUserProfile();
  const [busy, setBusy] = useState(false);

  // Ensure we always have a Firebase user (prevents true "anonymous" writes)
  useEffect(() => {
    if (!auth.currentUser) {
      signInAnonymously(auth).catch((e) =>
        console.warn("Anonymous sign-in failed:", e)
      );
    }
  }, []);

  const authorLabel = useMemo(() => {
    if (profile?.displayName && profile.displayName.trim()) {
      return profile.displayName;
    }
    if (auth.currentUser?.uid) {
      return "Signed in";
    }
    return "Anonymous";
  }, [profile]);

  async function onCapturePhoto() {
    if (busy) return;
    setBusy(true);

    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          "Camera permission required",
          "Please allow camera access to take a photo."
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        quality: 0.85,
        allowsEditing: false,
      });

      if (result.canceled) return;

      const uri = result.assets?.[0]?.uri;
      if (!uri) {
        Alert.alert("Capture failed", "No photo URI returned.");
        return;
      }

      router.push({
        pathname: "/field/photo",
        params: {
          uri,
          ...(entryId ? { entryId: String(entryId) } : {}),
        },
      });
    } catch (e: any) {
      console.error("Photo capture error:", e);
      Alert.alert("Photo error", e?.message ?? "Unknown error");
    } finally {
      setBusy(false);
    }
  }

  function onCaptureVoice() {
    router.push({
      pathname: "/field/voice",
      params: entryId ? { entryId: String(entryId) } : {},
    });
  }

  function onTextEntry() {
    router.push({
      pathname: "/new-entry",
      params: entryId ? { entryId: String(entryId) } : {},
    });
  }

  return (
    <View style={styles.page}>
      <Text style={styles.h1}>Capture</Text>
      <Text style={styles.sub}>Choose what you want to capture.</Text>

      <View style={styles.card}>
        <Text style={styles.meta}>
          Posting as{" "}
          <Text style={styles.metaStrong}>{authorLabel}</Text>
        </Text>

        <View style={styles.grid}>
          <Pressable
            onPress={onCapturePhoto}
            disabled={busy}
            style={({ pressed }) => [
              styles.tile,
              styles.tilePrimary,
              pressed && styles.pressed,
              busy && styles.disabled,
            ]}
          >
            <Text style={styles.tileTitlePrimary}>PHOTO</Text>
            <Text style={styles.tileBodyPrimary}>
              Take a photo and upload
            </Text>
          </Pressable>

          <Pressable
            onPress={onCaptureVoice}
            disabled={busy}
            style={({ pressed }) => [
              styles.tile,
              pressed && styles.pressed,
              busy && styles.disabled,
            ]}
          >
            <Text style={styles.tileTitle}>VOICE</Text>
            <Text style={styles.tileBody}>Record a voice memory</Text>
          </Pressable>

          <Pressable
            onPress={onTextEntry}
            disabled={busy}
            style={({ pressed }) => [
              styles.tile,
              pressed && styles.pressed,
              busy && styles.disabled,
            ]}
          >
            <Text style={styles.tileTitle}>TEXT</Text>
            <Text style={styles.tileBody}>Write a quick note</Text>
          </Pressable>
        </View>
      </View>

      <Pressable
        onPress={() => router.back()}
        style={({ pressed }) => [styles.back, pressed && styles.pressed]}
      >
        <Text style={styles.backText}>Back</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    padding: 16,
    backgroundColor: "#ffffff",
    gap: 10,
  },
  h1: {
    fontSize: 28,
    fontWeight: "900",
    color: "#111827",
  },
  sub: {
    color: "#6b7280",
    fontSize: 16,
  },
  card: {
    marginTop: 8,
    padding: 14,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#e5e7eb",
    backgroundColor: "#ffffff",
    gap: 12,
  },
  meta: {
    fontSize: 13,
    color: "#374151",
  },
  metaStrong: {
    fontWeight: "900",
    color: "#111827",
  },
  grid: {
    gap: 10,
  },
  tile: {
    padding: 14,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#e5e7eb",
    backgroundColor: "#f9fafb",
    gap: 6,
  },
  tilePrimary: {
    backgroundColor: "#111827",
    borderColor: "#111827",
  },
  tileTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#111827",
  },
  tileBody: {
    fontSize: 13,
    color: "#6b7280",
  },
  tileTitlePrimary: {
    fontSize: 18,
    fontWeight: "900",
    color: "#ffffff",
  },
  tileBodyPrimary: {
    fontSize: 13,
    color: "#e5e7eb",
  },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.6 },
  back: {
    alignSelf: "flex-start",
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#e5e7eb",
    backgroundColor: "#ffffff",
  },
  backText: {
    fontWeight: "900",
    color: "#111827",
  },
});
