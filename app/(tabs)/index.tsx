// app/(tabs)/index.tsx
import React, { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

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

      <Pressable
        style={({ pressed }) => [
          styles.ctaWrap,
          pressed && styles.ctaWrapPressed,
        ]}
        onPress={() => router.push("/field")}
        accessibilityLabel="Tap to record memory"
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

      <Text style={styles.footerNote}>
        Tap the badge to record a field memory. DeerCamp saves first, then uploads
        behind the curtain.
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
          Review saved field memories, playback audio parts, and confirm uploads
          to Feed.
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
    marginBottom: 12,
    color: "rgba(255,255,255,0.45)",
    fontWeight: "900",
    letterSpacing: 4,
    fontSize: 16,
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

  footerNote: {
    marginTop: 18,
    color: "rgba(255,255,255,0.5)",
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 22,
  },

  savedWrap: {
    marginTop: 24,
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