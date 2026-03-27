// app/(tabs)/index.tsx
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { auth } from "@/lib/firebase";

export default function HomeScreen() {
  const router = useRouter();
  const user = auth.currentUser;

  const signedIn = !!user && !user.isAnonymous;

  if (!signedIn) {
    return (
      <View style={styles.container}>
        <Text style={styles.brand}>DeerCamp</Text>

        <Text style={styles.welcome}>Sign in required.</Text>
        <Text style={styles.muted}>Please sign in to continue.</Text>

        <Pressable
          style={styles.primaryBtn}
          onPress={() => router.replace("/sign-in")}
        >
          <Text style={styles.primaryBtnText}>Go to Sign In</Text>
        </Pressable>

        <View style={{ height: 140 }} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.brand}>DeerCamp</Text>

      <Text style={styles.welcome}>Welcome back.</Text>

      <Text style={styles.sectionLabel}>FIELD MODE</Text>

      <Pressable style={styles.momentCard} onPress={() => router.push("/field")}>
        <View style={{ flex: 1 }}>
          <Text style={styles.momentTitle}>MY MOMENT</Text>
          <Text style={styles.momentSubtitle}>
            Tap to capture a Photo or{"\n"}Voice memory.
          </Text>
        </View>

        <Ionicons
          name="chevron-forward"
          size={24}
          color="rgba(255,255,255,0.75)"
        />
      </Pressable>

      <Text style={styles.footerNote}>
        Capture in the field, then publish live when you are ready.
      </Text>

      <View style={styles.savedWrap}>
        <Pressable
          style={styles.savedBtn}
          onPress={() => router.push("/(tabs)/memories")}
        >
          <Ionicons name="images-outline" size={22} color="white" />
          <Text style={styles.savedBtnText}>Open Saved Memories</Text>
        </Pressable>

        <Text style={styles.savedHelper}>
          Open local field memories and publish older saved items to Feed.
        </Text>
      </View>

      <View style={{ height: 120 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B0E12",
    paddingHorizontal: 18,
    paddingTop: 18,
  },

  brand: {
    color: "white",
    fontSize: 46,
    fontWeight: "900",
    letterSpacing: -0.8,
    marginTop: 6,
  },

  welcome: {
    color: "rgba(255,255,255,0.78)",
    fontSize: 34,
    fontWeight: "900",
    letterSpacing: -0.6,
    marginTop: 14,
  },

  muted: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 17,
    fontWeight: "700",
    marginTop: 8,
    marginBottom: 18,
  },

  sectionLabel: {
    marginTop: 26,
    marginBottom: 10,
    color: "rgba(255,255,255,0.45)",
    fontWeight: "900",
    letterSpacing: 4,
    fontSize: 16,
  },

  momentCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderColor: "rgba(255,255,255,0.16)",
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 18,
  },

  momentTitle: {
    color: "white",
    fontSize: 36,
    fontWeight: "900",
    letterSpacing: 1,
    marginBottom: 8,
  },

  momentSubtitle: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 18,
    fontWeight: "800",
    lineHeight: 24,
  },

  footerNote: {
    marginTop: 18,
    color: "rgba(255,255,255,0.5)",
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 22,
  },

  savedWrap: {
    marginTop: 26,
  },

  savedBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    minHeight: 56,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 18,
  },

  savedBtnText: {
    color: "white",
    fontSize: 17,
    fontWeight: "900",
  },

  savedHelper: {
    marginTop: 10,
    color: "rgba(255,255,255,0.52)",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
  },

  primaryBtn: {
    marginTop: 18,
    backgroundColor: "white",
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
  },

  primaryBtnText: {
    color: "#0B0E12",
    fontSize: 18,
    fontWeight: "900",
  },
});
