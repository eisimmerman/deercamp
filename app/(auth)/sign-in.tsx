import React, { useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Redirect } from "expo-router";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from "firebase/auth";

import { auth } from "@/lib/firebase";
import { useAuth } from "@/auth/useAuth";

export default function SignInScreen() {
  const { initializing, user } = useAuth();
  const signedIn = !!user && !user.isAnonymous;

  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);

  const canSubmit = useMemo(() => {
    return email.trim().length > 3 && pw.trim().length >= 6 && !busy;
  }, [email, pw, busy]);

  if (initializing) {
    return null;
  }

  if (signedIn) {
    return <Redirect href="/(tabs)" />;
  }

  async function onSignIn() {
    const e = email.trim();
    const p = pw.trim();

    try {
      setBusy(true);
      await signInWithEmailAndPassword(auth, e, p);
    } catch (err: any) {
      console.error("sign in error:", err);
      Alert.alert("Sign in failed", err?.message ?? "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function onCreate() {
    const e = email.trim();
    const p = pw.trim();

    try {
      setBusy(true);
      await createUserWithEmailAndPassword(auth, e, p);
    } catch (err: any) {
      console.error("create account error:", err);
      Alert.alert("Create account failed", err?.message ?? "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sign in</Text>
      <Text style={styles.subtitle}>Use your email to access DeerCamp.</Text>

      <Text style={styles.label}>Email</Text>
      <TextInput
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder="you@email.com"
        placeholderTextColor="rgba(255,255,255,0.35)"
        style={styles.input}
      />

      <Text style={styles.label}>Password</Text>
      <TextInput
        value={pw}
        onChangeText={setPw}
        secureTextEntry
        placeholder="6+ characters"
        placeholderTextColor="rgba(255,255,255,0.35)"
        style={styles.input}
      />

      <View style={styles.row}>
        <Pressable
          style={[styles.btn, styles.btnGhost, (!canSubmit || busy) && styles.btnDisabled]}
          onPress={onCreate}
          disabled={!canSubmit}
        >
          <Text style={styles.btnGhostText}>{busy ? "…" : "Create Account"}</Text>
        </Pressable>

        <Pressable
          style={[styles.btn, styles.btnPrimary, (!canSubmit || busy) && styles.btnDisabled]}
          onPress={onSignIn}
          disabled={!canSubmit}
        >
          <Text style={styles.btnPrimaryText}>{busy ? "Signing in…" : "Sign In"}</Text>
        </Pressable>
      </View>

      <Text style={styles.hint}>
        Note: Email/Password must be enabled in Firebase Auth providers.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B0E12",
    paddingHorizontal: 20,
    paddingTop: 40,
  },

  title: {
    fontSize: 32,
    fontWeight: "900",
    color: "#fff",
    marginBottom: 6,
  },

  subtitle: {
    color: "rgba(255,255,255,0.7)",
    fontWeight: "700",
    marginBottom: 18,
  },

  label: {
    color: "rgba(255,255,255,0.75)",
    fontWeight: "800",
    marginTop: 14,
    marginBottom: 8,
  },

  input: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#fff",
    fontWeight: "700",
  },

  row: {
    flexDirection: "row",
    gap: 12,
    marginTop: 20,
  },

  btn: {
    flex: 1,
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
  },

  btnGhost: {
    backgroundColor: "transparent",
    borderColor: "rgba(255,255,255,0.35)",
  },

  btnGhostText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 16,
  },

  btnPrimary: {
    backgroundColor: "#fff",
    borderColor: "#fff",
  },

  btnPrimaryText: {
    color: "#111",
    fontWeight: "900",
    fontSize: 16,
  },

  btnDisabled: {
    opacity: 0.55,
  },

  hint: {
    marginTop: 14,
    color: "rgba(255,255,255,0.5)",
    fontSize: 12,
    fontWeight: "700",
  },
});
