import auth from "@react-native-firebase/auth";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import AppButton from "@/components/AppButton";
import { BOTTOM_NAV_BASE_HEIGHT } from "@/components/BottomNav";
import { getNickname } from "@/lib/localPrefs";

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const bottomPad = BOTTOM_NAV_BASE_HEIGHT + insets.bottom + 12;

  const [emailOrStatus, setEmailOrStatus] = useState<string>("Signed out");
  const [nickname, setNicknameState] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const u = auth().currentUser;

    if (!u) setEmailOrStatus("Not signed in");
    else if (u.isAnonymous) setEmailOrStatus("Signed in (anonymous)");
    else setEmailOrStatus(u.email ? `Signed in as ${u.email}` : "Signed in");

    try {
      const n = await getNickname();
      setNicknameState(n);
    } catch {
      setNicknameState(null);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
      const unsub = auth().onAuthStateChanged(() => refresh());
      return () => unsub();
    }, [refresh])
  );

  const onPressSignOut = async () => {
    try {
      await auth().signOut();
      Alert.alert("Signed out", "You have been signed out.");
      router.replace("/(auth)/sign-in");
    } catch (e: any) {
      Alert.alert("Sign out failed", e?.message ?? "Unknown error");
    }
  };

  return (
    <View style={[styles.container, { paddingBottom: bottomPad }]}>
      <Text style={styles.h1}>My Profile</Text>

      <AppButton
        label="← Back to Home"
        onPress={() => router.replace("/(tabs)")}
        secondary
        compact
        style={styles.backBtn}
      />

      <View style={styles.section}>
        <Text style={styles.label}>Account</Text>
        <Text style={styles.value}>{emailOrStatus}</Text>

        <AppButton
          label="Sign Out"
          onPress={onPressSignOut}
          secondary
          compact
          style={{ alignSelf: "flex-start" }}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Nickname</Text>

        <Text style={styles.valueMuted}>
          {nickname ? `Current: ${nickname}` : "No nickname set yet."}
        </Text>

        <AppButton
          label="Set / Edit Nickname"
          onPress={() => router.push("/set-nickname")}
          secondary
          compact
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#000" },

  h1: {
    fontSize: 40,
    fontWeight: "900",
    marginTop: 8,
    marginBottom: 10,
    color: "#fff",
  },

  backBtn: {
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    marginBottom: 14,
  },

  section: {
    borderWidth: 2,
    borderColor: "#222",
    borderRadius: 18,
    padding: 14,
    marginBottom: 14,
    backgroundColor: "#0b0b0b",
  },

  label: { fontSize: 18, fontWeight: "900", marginBottom: 8, color: "#fff" },
  value: { fontSize: 16, fontWeight: "700", marginBottom: 12, color: "#ddd" },
  valueMuted: { fontSize: 14, color: "#999", marginBottom: 12 },
});
