// app/(tabs)/index.tsx
import React from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";

import { auth } from "@/lib/firebase";

export default function HomeScreen() {
  const router = useRouter();
  const user = auth.currentUser;
  const signedIn = !!user && !user.isAnonymous;

  function openCampStatsMgr() {
    Alert.alert(
      "CampStatsMgr",
      "Next build step: tap a stand, then log Buck AM, Doe AM, Buck PM, or Doe PM. Counts will save offline and sync back to DeerCamp when connectivity is available."
    );
  }

  if (!signedIn) {
    return (
      <View style={styles.centerGate}>
        <Text style={styles.brand}>DeerCamp</Text>
        <Text style={styles.appName}>CampFieldApp</Text>
        <Text style={styles.gateTitle}>Sign in required.</Text>
        <Text style={styles.gateText}>Please sign in to continue.</Text>

        <Pressable
          style={styles.primaryBtn}
          onPress={() => router.replace("/sign-in")}
        >
          <Text style={styles.primaryBtnText}>Go to Sign In</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.brand}>DeerCamp</Text>
        <Text style={styles.appName}>CampFieldApp</Text>
        <Text style={styles.sectionLabel}>FIELD MODE</Text>
        <Text style={styles.headerText}>
          Capture camp memories and field stats with simple taps. DeerCamp handles
          saving, syncing, and posting behind the curtain.
        </Text>
      </View>

      <View style={styles.moduleGrid}>
        <Pressable
          style={({ pressed }) => [
            styles.moduleCard,
            styles.memoryCard,
            pressed && styles.moduleCardPressed,
          ]}
          onPress={() => router.push("/field/voice")}
          accessibilityLabel="Open CampMemoryMgr"
        >
          <View style={styles.moduleIconWrap}>
            <Text style={styles.moduleIcon}>🎙️</Text>
          </View>
          <Text style={styles.moduleKicker}>CMM</Text>
          <Text style={styles.moduleTitle}>CampMemoryMgr</Text>
          <Text style={styles.moduleText}>
            Open camera, auto-record audio, tap for photo, then stop. Field
            memories upload later when service is available.
          </Text>
          <View style={styles.moduleButton}>
            <Text style={styles.moduleButtonText}>Record Memory</Text>
          </View>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.moduleCard,
            styles.statsCard,
            pressed && styles.moduleCardPressed,
          ]}
          onPress={openCampStatsMgr}
          accessibilityLabel="Open CampStatsMgr"
        >
          <View style={styles.moduleIconWrap}>
            <Text style={styles.moduleIcon}>🦌</Text>
          </View>
          <Text style={styles.moduleKicker}>CSM</Text>
          <Text style={styles.moduleTitle}>CampStatsMgr</Text>
          <Text style={styles.moduleText}>
            Tap stand name, log Buck AM, Doe AM, Buck PM, or Doe PM, and build
            simple deer stand analytics over time.
          </Text>
          <View style={[styles.moduleButton, styles.moduleButtonGhost]}>
            <Text style={styles.moduleButtonGhostText}>Log Stand Stats</Text>
          </View>
        </Pressable>
      </View>

      <View style={styles.quickActionsCard}>
        <Text style={styles.quickActionsTitle}>Quick Actions</Text>

        <Pressable
          style={({ pressed }) => [
            styles.quickActionBtn,
            pressed && styles.quickActionBtnPressed,
          ]}
          onPress={() =>
            router.push({
              pathname: "/field/voice",
              params: { mode: "photo" },
            })
          }
          accessibilityLabel="Capture photo only memory"
        >
          <Text style={styles.quickActionText}>Photo Only</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.quickActionBtn,
            styles.quickActionBtnSecondary,
            pressed && styles.quickActionBtnPressed,
          ]}
          onPress={() => router.push("/memories")}
          accessibilityLabel="Access saved field memories"
        >
          <Text style={styles.quickActionSecondaryText}>Saved Memories</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#0B0E12",
  },

  content: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 30,
  },

  centerGate: {
    flex: 1,
    backgroundColor: "#0B0E12",
    alignItems: "center",
    justifyContent: "center",
    padding: 22,
  },

  header: {
    alignItems: "center",
    marginTop: 4,
    marginBottom: 18,
  },

  brand: {
    color: "white",
    fontSize: 44,
    fontWeight: "900",
    letterSpacing: -0.8,
    textAlign: "center",
  },

  appName: {
    marginTop: 6,
    color: "#D0B17A",
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: -0.2,
    textAlign: "center",
  },

  sectionLabel: {
    marginTop: 14,
    color: "rgba(255,255,255,0.45)",
    fontWeight: "900",
    letterSpacing: 4,
    fontSize: 14,
    textAlign: "center",
  },

  headerText: {
    marginTop: 12,
    color: "rgba(255,255,255,0.72)",
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 23,
    textAlign: "center",
    maxWidth: 420,
  },

  moduleGrid: {
    gap: 14,
  },

  moduleCard: {
    width: "100%",
    minHeight: 245,
    borderRadius: 28,
    padding: 20,
    borderWidth: 1,
    overflow: "hidden",
    justifyContent: "space-between",
  },

  memoryCard: {
    backgroundColor: "rgba(208,177,122,0.14)",
    borderColor: "rgba(208,177,122,0.28)",
  },

  statsCard: {
    backgroundColor: "rgba(255,255,255,0.052)",
    borderColor: "rgba(255,255,255,0.12)",
  },

  moduleCardPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },

  moduleIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.10)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },

  moduleIcon: {
    fontSize: 29,
  },

  moduleKicker: {
    color: "#D0B17A",
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 3,
    marginBottom: 5,
  },

  moduleTitle: {
    color: "white",
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: -0.5,
    marginBottom: 10,
  },

  moduleText: {
    color: "rgba(255,255,255,0.76)",
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 23,
    marginBottom: 18,
  },

  moduleButton: {
    alignSelf: "flex-start",
    minHeight: 48,
    borderRadius: 999,
    backgroundColor: "white",
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
  },

  moduleButtonText: {
    color: "#0B0E12",
    fontSize: 15,
    fontWeight: "900",
  },

  moduleButtonGhost: {
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },

  moduleButtonGhostText: {
    color: "white",
    fontSize: 15,
    fontWeight: "900",
  },

  quickActionsCard: {
    marginTop: 14,
    backgroundColor: "rgba(255,255,255,0.045)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    borderRadius: 22,
    padding: 16,
    gap: 10,
    alignItems: "stretch",
  },

  quickActionsTitle: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase",
    textAlign: "center",
    marginBottom: 2,
  },

  quickActionBtn: {
    backgroundColor: "white",
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 13,
    alignItems: "center",
  },

  quickActionBtnSecondary: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },

  quickActionBtnPressed: {
    opacity: 0.9,
  },

  quickActionText: {
    color: "#0B0E12",
    fontSize: 14,
    fontWeight: "900",
  },

  quickActionSecondaryText: {
    color: "white",
    fontSize: 14,
    fontWeight: "900",
  },

  gateTitle: {
    color: "white",
    fontSize: 26,
    fontWeight: "900",
    marginTop: 22,
    textAlign: "center",
  },

  gateText: {
    color: "rgba(255,255,255,0.66)",
    fontSize: 17,
    fontWeight: "700",
    marginTop: 8,
    marginBottom: 18,
    textAlign: "center",
  },

  primaryBtn: {
    marginTop: 18,
    backgroundColor: "white",
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 220,
  },

  primaryBtnText: {
    color: "#0B0E12",
    fontSize: 18,
    fontWeight: "900",
  },
});
