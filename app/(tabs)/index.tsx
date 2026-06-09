// app/(tabs)/index.tsx
import React from "react";
import {
  Animated,
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
  const [showIntro, setShowIntro] = React.useState(false);
  const introOpacity = React.useRef(new Animated.Value(1)).current;
  const hoofScale = React.useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    if (!signedIn) {
      setShowIntro(false);
      introOpacity.setValue(1);
      hoofScale.setValue(1);
      return undefined;
    }

    setShowIntro(true);
    introOpacity.setValue(1);
    hoofScale.setValue(1);

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(hoofScale, {
          toValue: 1.08,
          duration: 650,
          useNativeDriver: true,
        }),
        Animated.timing(hoofScale, {
          toValue: 1,
          duration: 650,
          useNativeDriver: true,
        }),
      ])
    );

    pulse.start();

    const fadeTimer = setTimeout(() => {
      Animated.timing(introOpacity, {
        toValue: 0,
        duration: 450,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) {
          setShowIntro(false);
        }
      });
    }, 2000);

    return () => {
      clearTimeout(fadeTimer);
      pulse.stop();
    };
  }, [hoofScale, introOpacity, signedIn]);

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
    <View style={styles.screen}>
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

        <View style={[styles.moduleCard, styles.statsCard]}>
          <View style={styles.moduleIconWrap}>
            <Text style={styles.moduleIcon}>🦌</Text>
          </View>
          <Text style={styles.moduleKicker}>CSM</Text>
          <Text style={styles.moduleTitle}>CampStatsMgr</Text>
          <Text style={styles.moduleText}>
            Log Buck AM, Doe AM, Buck PM, and Doe PM counts by stand. Review
            synced sightings in the new stats dashboard.
          </Text>

          <View style={styles.moduleButtonRow}>
            <Pressable
              style={({ pressed }) => [
                styles.moduleButton,
                styles.moduleButtonGhost,
                pressed && styles.moduleActionPressed,
              ]}
              onPress={() => router.push("/field/stats")}
              accessibilityLabel="Open CampStatsMgr logger"
            >
              <Text style={styles.moduleButtonGhostText}>Log Stand Stats</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.moduleButton,
                pressed && styles.moduleActionPressed,
              ]}
              onPress={() => router.push("/stats-dashboard")}
              accessibilityLabel="Open CampStatsMgr dashboard"
            >
              <Text style={styles.moduleButtonText}>View Dashboard</Text>
            </Pressable>
          </View>
        </View>
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

      {showIntro && (
        <Animated.View
          style={[styles.introOverlay, { opacity: introOpacity }]}
          pointerEvents="auto"
        >
          <Text style={styles.introBrand}>DeerCamp</Text>
          <Text style={styles.introAppName}>CampFieldApp</Text>
          <Text style={styles.introSectionLabel}>FIELD MODE</Text>

          <Animated.View
            style={[styles.introHoofPulse, { transform: [{ scale: hoofScale }] }]}
          >
            <View style={styles.hoofMark}>
              <View style={[styles.hoofToe, styles.hoofToeLeft]} />
              <View style={[styles.hoofToe, styles.hoofToeRight]} />
              <View style={[styles.hoofDewClaw, styles.hoofDewClawLeft]} />
              <View style={[styles.hoofDewClaw, styles.hoofDewClawRight]} />
            </View>
          </Animated.View>

          <Text style={styles.introSubtext}>Capture memories. Log field stats.</Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#0B0E12",
  },

  introOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
    elevation: 20,
    backgroundColor: "#0B0E12",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 26,
  },

  introBrand: {
    color: "white",
    fontSize: 52,
    fontWeight: "900",
    letterSpacing: -1,
    textAlign: "center",
  },

  introAppName: {
    marginTop: 8,
    color: "#D0B17A",
    fontSize: 29,
    fontWeight: "900",
    letterSpacing: -0.2,
    textAlign: "center",
  },

  introSectionLabel: {
    marginTop: 18,
    color: "rgba(255,255,255,0.44)",
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 5,
    textAlign: "center",
  },

  introHoofPulse: {
    marginTop: 42,
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 2,
    borderColor: "rgba(208,177,122,0.56)",
    backgroundColor: "rgba(208,177,122,0.10)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#D0B17A",
    shadowOpacity: 0.34,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 0 },
  },

  hoofMark: {
    width: 84,
    height: 104,
    position: "relative",
  },

  hoofToe: {
    position: "absolute",
    top: 0,
    width: 31,
    height: 74,
    borderRadius: 24,
    backgroundColor: "#D0B17A",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.72)",
  },

  hoofToeLeft: {
    left: 7,
    transform: [{ rotate: "-9deg" }],
  },

  hoofToeRight: {
    right: 7,
    transform: [{ rotate: "9deg" }],
  },

  hoofDewClaw: {
    position: "absolute",
    bottom: 2,
    width: 23,
    height: 33,
    borderRadius: 18,
    backgroundColor: "#D0B17A",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.68)",
  },

  hoofDewClawLeft: {
    left: 14,
    transform: [{ rotate: "-20deg" }],
  },

  hoofDewClawRight: {
    right: 14,
    transform: [{ rotate: "20deg" }],
  },

  introSubtext: {
    marginTop: 34,
    color: "rgba(255,255,255,0.68)",
    fontSize: 17,
    fontWeight: "800",
    lineHeight: 23,
    textAlign: "center",
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

  moduleButtonRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    alignItems: "center",
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

  moduleActionPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.98 }],
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
