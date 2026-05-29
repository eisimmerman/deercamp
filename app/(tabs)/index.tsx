// app/(tabs)/index.tsx
import React, { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { auth } from "@/lib/firebase";
import { getActiveCampId, getActiveCampName } from "@/lib/localMemories";

const recordMemoryCta = require("../../assets/branding/deercamp_app_cta.png");

export default function HomeScreen() {
  const router = useRouter();
  const scheme = useColorScheme();
  const isLight = scheme === "light";

  const user = auth.currentUser;
  const signedIn = !!user && !user.isAnonymous;

  const pulse = useRef(new Animated.Value(1)).current;
  const glow = useRef(new Animated.Value(0.35)).current;
  const [campName, setCampName] = React.useState("Camp Swede");

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const campId = await getActiveCampId();
        const name = await getActiveCampName(campId);
        if (alive) setCampName(name || "Camp Swede");
      } catch {
        if (alive) setCampName("Camp Swede");
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(pulse, {
            toValue: 1.032,
            duration: 1100,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulse, {
            toValue: 1,
            duration: 1100,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(glow, {
            toValue: 0.7,
            duration: 1100,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(glow, {
            toValue: 0.35,
            duration: 1100,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      ])
    );

    pulseLoop.start();

    return () => {
      pulseLoop.stop();
    };
  }, [glow, pulse]);

  const theme = {
    screen: isLight ? "#EFE5D1" : "#0B0E12",
    card: isLight ? "rgba(255,255,255,0.74)" : "rgba(255,255,255,0.055)",
    border: isLight ? "rgba(63,43,26,0.18)" : "rgba(255,255,255,0.10)",
    text: isLight ? "#1B120C" : "white",
    muted: isLight ? "rgba(27,18,12,0.68)" : "rgba(255,255,255,0.66)",
    action: isLight ? "#3D2A17" : "white",
    actionText: isLight ? "white" : "#0B0E12",
    gold: "#D0B17A",
  };

  if (!signedIn) {
    return (
      <View style={[styles.centerGate, { backgroundColor: theme.screen }]}>
        <Text style={[styles.brand, { color: theme.text }]}>CampFieldApp</Text>
        <Text style={[styles.gateTitle, { color: theme.text }]}>Sign in required.</Text>
        <Text style={[styles.gateText, { color: theme.muted }]}>Please sign in to continue.</Text>

        <Pressable
          style={[styles.primaryBtn, { backgroundColor: theme.action }]}
          onPress={() => router.replace("/sign-in")}
        >
          <Text style={[styles.primaryBtnText, { color: theme.actionText }]}>Go to Sign In</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: theme.screen }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={[styles.brand, { color: theme.text }]}>CampFieldApp</Text>
        <Text style={[styles.sectionLabel, { color: theme.muted }]}>FIELD HUB</Text>
      </View>

      <View style={[styles.campCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Text style={[styles.campLabel, { color: theme.muted }]}>Current Camp</Text>
        <Text style={[styles.campName, { color: theme.text }]}>{campName}</Text>
      </View>

      <View style={[styles.moduleCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Text style={[styles.moduleEyebrow, { color: theme.gold }]}>CMM</Text>
        <Text style={[styles.moduleTitle, { color: theme.text }]}>Camp Memory Maker</Text>
        <Text style={[styles.moduleText, { color: theme.muted }]}>
          Capture photo + voice memories in the field.
        </Text>

        <Pressable
          style={({ pressed }) => [
            styles.ctaWrap,
            { borderColor: theme.border },
            pressed && styles.ctaWrapPressed,
          ]}
          onPress={() => router.push("/field/voice")}
          accessibilityLabel="Record audio and photo memory"
        >
          <Animated.View
            pointerEvents="none"
            style={[
              styles.pulseGlow,
              {
                opacity: glow,
                transform: [{ scale: pulse }],
              },
            ]}
          />

          <Animated.View style={[styles.ctaImageWrap, { transform: [{ scale: pulse }] }]}>
            <Image source={recordMemoryCta} style={styles.ctaImage} resizeMode="contain" />
          </Animated.View>
        </Pressable>

        <View style={styles.secondaryRow}>
          <Pressable
            style={({ pressed }) => [
              styles.secondaryBtn,
              { backgroundColor: theme.action },
              pressed && styles.secondaryBtnPressed,
            ]}
            onPress={() =>
              router.push({
                pathname: "/field/voice",
                params: { mode: "photo" },
              })
            }
          >
            <Ionicons name="camera-outline" size={20} color={theme.actionText} />
            <Text style={[styles.secondaryBtnText, { color: theme.actionText }]}>Photo Only</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.secondaryBtn,
              { backgroundColor: theme.action },
              pressed && styles.secondaryBtnPressed,
            ]}
            onPress={() => router.push("/memories")}
          >
            <Ionicons name="cloud-upload-outline" size={20} color={theme.actionText} />
            <Text style={[styles.secondaryBtnText, { color: theme.actionText }]}>Uploads</Text>
          </Pressable>
        </View>
      </View>

      <View style={[styles.moduleCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Text style={[styles.moduleEyebrow, { color: theme.gold }]}>CSM</Text>
        <Text style={[styles.moduleTitle, { color: theme.text }]}>Camp Stats Manager</Text>
        <Text style={[styles.moduleText, { color: theme.muted }]}>
          Log AM/PM buck and doe sightings by stand.
        </Text>

        <Pressable
          style={({ pressed }) => [
            styles.statsBtn,
            { backgroundColor: theme.gold },
            pressed && styles.secondaryBtnPressed,
          ]}
          onPress={() => router.push("/stats")}
        >
          <Ionicons name="stats-chart-outline" size={24} color="#0B0E12" />
          <Text style={styles.statsBtnText}>Log Deer Sightings</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 30 },
  centerGate: { flex: 1, alignItems: "center", justifyContent: "center", padding: 22 },
  header: { alignItems: "center", marginTop: 4, marginBottom: 12 },
  brand: { fontSize: 40, fontWeight: "900", letterSpacing: -0.8, textAlign: "center" },
  sectionLabel: { marginTop: 10, fontWeight: "900", letterSpacing: 4, fontSize: 14, textAlign: "center" },
  campCard: { borderWidth: 1, borderRadius: 20, padding: 14, marginBottom: 14 },
  campLabel: { fontSize: 12, fontWeight: "900", letterSpacing: 1.6, textTransform: "uppercase" },
  campName: { fontSize: 22, fontWeight: "900", marginTop: 2 },
  moduleCard: { borderWidth: 1, borderRadius: 24, padding: 16, marginBottom: 14, overflow: "hidden" },
  moduleEyebrow: { fontSize: 13, fontWeight: "900", letterSpacing: 2.2 },
  moduleTitle: { marginTop: 2, fontSize: 24, fontWeight: "900", letterSpacing: -0.3 },
  moduleText: { marginTop: 5, marginBottom: 12, fontSize: 15, fontWeight: "800", lineHeight: 21 },
  ctaWrap: { width: "100%", minHeight: 260, alignItems: "center", justifyContent: "center", borderRadius: 22, backgroundColor: "rgba(255,255,255,0.035)", borderWidth: 1, overflow: "hidden" },
  ctaWrapPressed: { opacity: 0.92 },
  pulseGlow: { position: "absolute", width: 230, height: 230, borderRadius: 115, backgroundColor: "rgba(208,177,122,0.22)", shadowColor: "#D0B17A", shadowOpacity: 0.85, shadowRadius: 28, shadowOffset: { width: 0, height: 0 } },
  ctaImageWrap: { width: "100%", alignItems: "center", justifyContent: "center" },
  ctaImage: { width: "100%", height: 245 },
  secondaryRow: { flexDirection: "row", gap: 10, marginTop: 12 },
  secondaryBtn: { flex: 1, minHeight: 58, borderRadius: 18, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
  secondaryBtnPressed: { opacity: 0.88 },
  secondaryBtnText: { fontSize: 15, fontWeight: "900" },
  statsBtn: { marginTop: 4, minHeight: 76, borderRadius: 22, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 12 },
  statsBtnText: { color: "#0B0E12", fontSize: 21, fontWeight: "900" },
  gateTitle: { fontSize: 26, fontWeight: "900", marginTop: 22, textAlign: "center" },
  gateText: { fontSize: 17, fontWeight: "700", marginTop: 8, marginBottom: 18, textAlign: "center" },
  primaryBtn: { marginTop: 18, borderRadius: 16, paddingVertical: 16, paddingHorizontal: 18, alignItems: "center", justifyContent: "center", minWidth: 220 },
  primaryBtnText: { fontSize: 18, fontWeight: "900" },
});
