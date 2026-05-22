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
} from "react-native";
import { useRouter } from "expo-router";

import { auth } from "@/lib/firebase";

const recordMemoryCta = require("../../assets/branding/deercamp_app_cta.png");

export default function HomeScreen() {
  const router = useRouter();
  const user = auth.currentUser;
  const signedIn = !!user && !user.isAnonymous;

  const pulse = useRef(new Animated.Value(1)).current;
  const glow = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(pulse, {
            toValue: 1.035,
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
            toValue: 0.72,
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

  if (!signedIn) {
    return (
      <View style={styles.centerGate}>
        <Text style={styles.brand}>DeerCamp</Text>
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
        <Text style={styles.sectionLabel}>FIELD MODE</Text>
      </View>

      <Pressable
        style={({ pressed }) => [
          styles.ctaWrap,
          pressed && styles.ctaWrapPressed,
        ]}
        onPress={() => router.push("/field")}
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

        <Animated.View
          style={[
            styles.ctaImageWrap,
            {
              transform: [{ scale: pulse }],
            },
          ]}
        >
          <Image
            source={recordMemoryCta}
            style={styles.ctaImage}
            resizeMode="contain"
          />
        </Animated.View>
      </Pressable>

      <View style={styles.instructionsCard}>
        <Text style={styles.instructionsText}>
          Tap badge to record both audio and photo.
        </Text>

        <View style={styles.photoOnlyRow}>
          <Text style={styles.instructionsText}>Tap here for</Text>

          <Pressable
            style={({ pressed }) => [
              styles.photoOnlyBtn,
              pressed && styles.photoOnlyBtnPressed,
            ]}
            onPress={() =>
              router.push({
                pathname: "/field",
                params: { mode: "photo" },
              })
            }
            accessibilityLabel="Photo only"
          >
            <Text style={styles.photoOnlyBtnText}>Photo Only</Text>
          </Pressable>
        </View>
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
    paddingBottom: 40,
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
    marginTop: 8,
    marginBottom: 18,
  },

  brand: {
    color: "white",
    fontSize: 46,
    fontWeight: "900",
    letterSpacing: -0.8,
    textAlign: "center",
  },

  sectionLabel: {
    marginTop: 26,
    color: "rgba(255,255,255,0.45)",
    fontWeight: "900",
    letterSpacing: 4,
    fontSize: 16,
    textAlign: "center",
  },

  ctaWrap: {
    width: "100%",
    minHeight: 430,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.035)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
  },

  ctaWrapPressed: {
    opacity: 0.92,
  },

  pulseGlow: {
    position: "absolute",
    width: 330,
    height: 330,
    borderRadius: 165,
    backgroundColor: "rgba(208,177,122,0.22)",
    shadowColor: "#D0B17A",
    shadowOpacity: 0.85,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 0 },
  },

  ctaImageWrap: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },

  ctaImage: {
    width: "100%",
    height: 410,
  },

  instructionsCard: {
    marginTop: 22,
    backgroundColor: "rgba(255,255,255,0.045)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    borderRadius: 22,
    padding: 18,
    gap: 12,
  },

  instructionsText: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 18,
    fontWeight: "900",
    lineHeight: 26,
    textAlign: "center",
  },

  photoOnlyRow: {
    alignItems: "center",
    gap: 10,
  },

  photoOnlyBtn: {
    backgroundColor: "white",
    borderRadius: 999,
    paddingHorizontal: 22,
    paddingVertical: 12,
    minWidth: 180,
    alignItems: "center",
  },

  photoOnlyBtnPressed: {
    opacity: 0.9,
  },

  photoOnlyBtnText: {
    color: "#0B0E12",
    fontSize: 16,
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
