import React, { useEffect } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { useAuth } from "@/auth/useAuth";

export default function FieldScreen() {
  const router = useRouter();
  const { initializing, user } = useAuth();
  const signedIn = !!user && !user.isAnonymous;

  useEffect(() => {
    if (!initializing && !signedIn) {
      router.replace("/sign-in");
    }
  }, [initializing, signedIn, router]);

  if (initializing || !signedIn) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Field Mode</Text>
      <Text style={styles.subtitle}>
        Record a memory from the field with camera open and audio recording right away,
        then save it on this device first.
      </Text>

      <Pressable style={styles.actionBtn} onPress={() => router.push("/field/voice")}>
        <Ionicons name="radio-outline" size={22} color="#0B0E12" />
        <Text style={styles.actionBtnText}>Record Memory</Text>
      </Pressable>

      <Text style={styles.helper}>
        Record Memory opens the camera immediately, starts audio automatically, and saves
        the memory locally for later upload.
      </Text>

      <Pressable style={styles.actionBtnAlt} onPress={() => router.push("/field/photo")}>
        <Ionicons name="camera-outline" size={22} color="white" />
        <Text style={styles.actionBtnAltText}>Capture Photo Only</Text>
      </Pressable>

      <Pressable style={styles.actionBtnAlt} onPress={() => router.push("/new-entry")}>
        <Ionicons name="create-outline" size={22} color="white" />
        <Text style={styles.actionBtnAltText}>Text Memory</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B0E12",
    paddingHorizontal: 18,
    paddingTop: 26,
  },

  title: {
    color: "white",
    fontSize: 34,
    fontWeight: "900",
    marginBottom: 8,
  },

  subtitle: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 22,
    marginBottom: 20,
  },

  helper: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
    marginTop: 10,
    marginBottom: 22,
  },

  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "white",
    paddingVertical: 16,
    borderRadius: 18,
  },

  actionBtnText: {
    color: "#0B0E12",
    fontSize: 18,
    fontWeight: "900",
  },

  actionBtnAlt: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderColor: "rgba(255,255,255,0.14)",
    borderWidth: 1,
    paddingVertical: 16,
    borderRadius: 18,
    marginBottom: 12,
  },

  actionBtnAltText: {
    color: "white",
    fontSize: 17,
    fontWeight: "900",
  },
});
