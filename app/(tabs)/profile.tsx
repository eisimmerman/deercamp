// app/(tabs)/profile.tsx
import React, { useCallback, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { signOut } from "firebase/auth";

import { auth } from "@/src/lib/firebase";

export default function ProfileScreen() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const user = auth.currentUser;

  const displayName = useMemo(() => {
    // Prefer Firebase displayName; fall back to email; else a neutral label
    return user?.displayName?.trim() || user?.email?.trim() || "Friend";
  }, [user?.displayName, user?.email]);

  const onEditNickname = useCallback(() => {
    router.push("/set-nickname");
  }, [router]);

  const onSignOut = useCallback(() => {
    Alert.alert("Sign out?", "You’ll need to sign in again to access DeerCamp.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          try {
            setBusy(true);

            // ✅ Real Firebase sign-out
            await signOut(auth);

            // ✅ Hard redirect to auth
            router.replace("/(auth)/sign-in");
          } catch (e) {
            console.error("Sign out error:", e);
            Alert.alert("Sign out failed", "Please try again.");
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  }, [router]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Profile</Text>

      <View style={styles.card}>
        <Text style={styles.welcome}>Welcome, {displayName}.</Text>
        <Text style={styles.meta}>
          {user?.isAnonymous ? "Signed in (anonymous)" : "Signed in"}
        </Text>
      </View>

      <Pressable
        style={({ pressed }) => [styles.btn, styles.btnGhost, pressed && styles.pressed]}
        onPress={onEditNickname}
        disabled={busy}
      >
        <Text style={styles.btnGhostText}>Edit Nickname</Text>
      </Pressable>

      <Pressable
        style={({ pressed }) => [styles.btn, styles.btnDanger, pressed && styles.pressed, busy && styles.disabled]}
        onPress={onSignOut}
        disabled={busy}
      >
        <Text style={styles.btnDangerText}>{busy ? "Signing out…" : "Sign Out"}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0B0E12", padding: 16 },
  title: { color: "white", fontSize: 34, fontWeight: "900", marginTop: 8, marginBottom: 14 },

  card: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
  },
  welcome: { color: "white", fontSize: 18, fontWeight: "900", marginBottom: 4 },
  meta: { color: "rgba(255,255,255,0.55)", fontWeight: "700" },

  btn: {
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    marginTop: 10,
  },
  btnGhost: { backgroundColor: "transparent", borderColor: "rgba(255,255,255,0.35)" },
  btnGhostText: { color: "white", fontWeight: "900", fontSize: 18 },

  btnDanger: { backgroundColor: "#fff", borderColor: "#fff" },
  btnDangerText: { color: "#0B0E12", fontWeight: "900", fontSize: 18 },

  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.55 },
});
