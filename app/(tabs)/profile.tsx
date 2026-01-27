import auth from "@react-native-firebase/auth";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import AppButton from "@/components/AppButton";
import { BOTTOM_NAV_BASE_HEIGHT } from "@/components/BottomNav";
import { qaClear, qaGetNickname, qaIsSignedIn } from "@/lib/qaSession";

function getIsQaMode() {
  const envVal = (process.env.EXPO_PUBLIC_QA || "").toString().trim();
  return __DEV__ || envVal === "1" || envVal.toLowerCase() === "true";
}

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const isQaMode = useMemo(() => getIsQaMode(), []);
  const [firebaseEmail, setFirebaseEmail] = useState<string | null>(
    auth().currentUser?.email ?? null
  );
  const [hasFirebaseUser, setHasFirebaseUser] = useState<boolean>(
    !!auth().currentUser
  );

  const [qaSignedIn, setQaSignedIn] = useState(false);
  const [qaNickname, setQaNickname] = useState<string | null>(null);

  const bottomPad = BOTTOM_NAV_BASE_HEIGHT + insets.bottom + 12;

  const refreshSessionState = useCallback(async () => {
    // Firebase state
    const u = auth().currentUser;
    setHasFirebaseUser(!!u);
    setFirebaseEmail(u?.email ?? null);

    // QA state
    try {
      const signedIn = await qaIsSignedIn();
      const nick = await qaGetNickname();
      setQaSignedIn(signedIn);
      setQaNickname(nick);
    } catch {
      // If SecureStore isn't available (old dev client), keep QA state false/null
      setQaSignedIn(false);
      setQaNickname(null);
    }
  }, []);

  // ✅ Refresh every time Profile is shown again (fixes the "set nickname then it disappears" loop)
  useFocusEffect(
    useCallback(() => {
      refreshSessionState();

      const unsub = auth().onAuthStateChanged((u) => {
        setHasFirebaseUser(!!u);
        setFirebaseEmail(u?.email ?? null);
      });

      return () => unsub();
    }, [refreshSessionState])
  );

  const isActuallySignedIn = hasFirebaseUser || (isQaMode && qaSignedIn);

  const onPressSignOut = async () => {
    try {
      if (auth().currentUser) {
        await auth().signOut();
      }
      if (isQaMode) {
        await qaClear();
        setQaSignedIn(false);
        setQaNickname(null);
      }

      Alert.alert("Signed out", "You have been signed out.");
      router.replace("/sign-in");
    } catch (e: any) {
      Alert.alert("Sign out failed", e?.message ?? "Unknown error");
    }
  };

  const onPressResetQa = async () => {
    try {
      await qaClear();
      setQaSignedIn(false);
      setQaNickname(null);
      Alert.alert("QA reset", "QA session cleared. Use Sign In → Continue to App (QA) again.");
    } catch (e: any) {
      Alert.alert("Reset failed", e?.message ?? "Unknown error");
    }
  };

  return (
    <View style={[styles.container, { paddingBottom: bottomPad }]}>
      <AppButton
        label="← Back to Home"
        onPress={() => router.replace("/")}
        secondary
        compact
        style={styles.backBtn}
      />

      <Text style={styles.h1}>My Profile</Text>

      <View style={styles.section}>
        <Text style={styles.label}>Account</Text>

        {isActuallySignedIn ? (
          <>
            <Text style={styles.value}>
              {hasFirebaseUser
                ? `Signed in${firebaseEmail ? ` as ${firebaseEmail}` : ""}`
                : "Signed in (QA mock)"}
            </Text>

            <View style={styles.row}>
              <AppButton
                label="Sign Out"
                onPress={onPressSignOut}
                secondary
                compact
                style={{ flex: 1 }}
              />
              {isQaMode && (
                <AppButton
                  label="Reset QA"
                  onPress={onPressResetQa}
                  compact
                  style={{ flex: 1 }}
                />
              )}
            </View>
          </>
        ) : (
          <>
            <Text style={styles.value}>
              Not signed in{isQaMode ? " (QA build allows mock access)" : ""}.
            </Text>

            <AppButton
              label="Sign In"
              onPress={() => router.push("/sign-in")}
              compact
              style={styles.signInBtn}
            />
          </>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Nickname</Text>

        <Text style={styles.valueMuted}>
          {qaNickname ? `Current: ${qaNickname}` : "No nickname set yet."}
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
  container: { flex: 1, padding: 16 },
  backBtn: { alignSelf: "flex-start", paddingHorizontal: 14 },

  h1: { fontSize: 40, fontWeight: "900", marginTop: 14, marginBottom: 18 },

  section: {
    borderWidth: 2,
    borderColor: "#222",
    borderRadius: 18,
    padding: 14,
    marginBottom: 14,
  },

  label: { fontSize: 18, fontWeight: "900", marginBottom: 8 },
  value: { fontSize: 16, fontWeight: "700", marginBottom: 12 },
  valueMuted: { fontSize: 14, color: "#777", marginBottom: 12 },

  signInBtn: { alignSelf: "flex-start", paddingHorizontal: 18 },

  row: {
    flexDirection: "row",
    gap: 12,
  },
});
