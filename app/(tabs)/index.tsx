// DeerCamp/app/(tabs)/index.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import auth from "@react-native-firebase/auth";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import AppButton from "@/components/AppButton";
import ParallaxScrollView from "@/components/parallax-scroll-view";
import BottomNav, { BOTTOM_NAV_BASE_HEIGHT } from "@/components/BottomNav";
import { getHeroImageKey, getHeroImageUri, getNickname } from "@/lib/localPrefs";

function heroSourceFromKey(key: string | null) {
  switch (key) {
    case "first-coffee":
      return require("@/assets/campcards/first-coffee.png");
    case "first-snow":
      return require("@/assets/campcards/first-snow.png");
    case "grandmas-kitchen":
      return require("@/assets/campcards/grandmas-kitchen.png");
    case "opening-morning":
      return require("@/assets/campcards/opening-morning.png");
    case "packers-burgers":
      return require("@/assets/campcards/packers-burgers.png");
    default:
      return require("@/assets/images/react-logo.png");
  }
}

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [isSignedIn, setIsSignedIn] = useState<boolean>(!!auth().currentUser);
  const [who, setWho] = useState<string>("");

  const [heroKey, setHeroKey] = useState<string | null>(null);
  const [heroUri, setHeroUri] = useState<string | null>(null);

  const heroSource = useMemo(() => {
    if (heroUri) return { uri: heroUri };
    return heroSourceFromKey(heroKey);
  }, [heroKey, heroUri]);

  const [nickname, setNicknameState] = useState<string | null>(null);

  useEffect(() => {
    const unsub = auth().onAuthStateChanged((u) => {
      setIsSignedIn(!!u);
      if (!u) setWho("");
      else if (u.isAnonymous) setWho("Signed in (anonymous)");
      else setWho(u.email ? `Signed in as ${u.email}` : "Signed in");
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const load = async () => {
      setHeroKey(await getHeroImageKey());
      setHeroUri(await getHeroImageUri());
      setNicknameState(await getNickname());
    };
    load();
  }, []);

  const continueAsGuest = async () => {
    try {
      if (!auth().currentUser) await auth().signInAnonymously();
      Alert.alert("Welcome", "You can now post memories (including voice).");
    } catch (e: any) {
      Alert.alert("Sign-in failed", e?.message ?? "Try again.");
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <ParallaxScrollView
        headerBackgroundColor={{ light: "#D0D0D0", dark: "#111" }}
        headerImage={
          <Pressable onPress={() => router.push("/choose-hero")} style={styles.heroWrap}>
            <Image
              source={heroSource}
              style={styles.heroImage}
              contentFit="cover"
              contentPosition="top"
            />
            <View style={styles.heroOverlay} />
          </Pressable>
        }
      >
        <View
          style={[
            styles.container,
            {
              paddingBottom: BOTTOM_NAV_BASE_HEIGHT + Math.max(insets.bottom, 10) + 18
            }
          ]}
        >
          <Pressable onPress={() => router.push("/choose-hero")} style={styles.heroCaption}>
            <Text style={styles.heroTitle}>Our Camp</Text>
            <Text style={styles.heroHint}>Tap to change cover photo</Text>
          </Pressable>

          <View style={styles.divider} />

          <Text style={styles.title}>DeerCamp</Text>
          <Text style={styles.subtitle}>
            {nickname ? `Welcome, ${nickname}` : "Your camp journal"}
          </Text>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Account</Text>
            <Text style={styles.muted}>{isSignedIn ? who : "You're not signed in yet."}</Text>

            {!isSignedIn && (
              <AppButton
                label="Continue as Guest"
                onPress={continueAsGuest}
                compact
                style={{ marginTop: 12 }}
              />
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Quick actions</Text>

            <AppButton
              label="+ New Memory"
              onPress={() => router.push("/new-entry")}
              compact
              style={{ marginTop: 10 }}
            />

            <AppButton
              label="View Memories"
              onPress={() => router.push("/(tabs)/memories")}
              secondary
              compact
              style={{ marginTop: 10 }}
            />

            <AppButton
              label="Set / Edit Nickname"
              onPress={() => router.push("/set-nickname")}
              secondary
              compact
              style={{ marginTop: 10 }}
            />
          </View>
        </View>
      </ParallaxScrollView>

      <BottomNav />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 14, backgroundColor: "#000" },

  title: { fontSize: 44, fontWeight: "900", color: "#fff", marginTop: 6 },
  subtitle: { fontSize: 20, color: "#bbb", marginTop: 6, marginBottom: 10 },

  card: {
    borderWidth: 2,
    borderColor: "#222",
    borderRadius: 18,
    padding: 14,
    backgroundColor: "#0b0b0b"
  },
  cardTitle: { fontSize: 18, fontWeight: "900", color: "#fff" },
  muted: { marginTop: 10, fontSize: 14, color: "#999", lineHeight: 20 },

  heroWrap: { height: 280, width: "100%" },
  heroImage: { ...StyleSheet.absoluteFillObject },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.25)"
  },

  heroCaption: { marginTop: 12 },
  heroTitle: { fontSize: 22, fontWeight: "900", color: "#fff" },
  heroHint: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: "700",
    color: "rgba(255,255,255,0.6)"
  },

  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.15)",
    marginVertical: 14
  }
});
