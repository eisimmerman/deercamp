// app/profile.tsx
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useUserProfile } from "../src/lib/useUserProfile";


import { auth, db } from "@/src/lib/firebase";



import { signOut as fbSignOut, updateProfile } from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";

export default function ProfileScreen() {
  const router = useRouter();
  const { profile } = useUserProfile();

  const user = auth.currentUser;
  const uid = user?.uid;

  const initialName = useMemo(() => {
    return profile?.displayName?.trim() || user?.displayName?.trim() || "";
  }, [profile?.displayName, user?.displayName]);

  const [nickname, setNickname] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setNickname(initialName);
  }, [initialName]);

  const goHome = () => {
    router.replace("/" as any);
  };

  const saveProfile = async () => {
    if (!uid || !user) {
      Alert.alert("Not signed in", "Please sign in to edit your profile.");
      router.replace("/sign-in" as any);
      return;
    }

    const name = nickname.trim();
    if (!name) {
      Alert.alert("Nickname required", "Please enter a nickname.");
      return;
    }

    setSaving(true);
    try {
      await setDoc(
        doc(db, "users", uid),
        {
          displayName: name,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      await updateProfile(user, { displayName: name });

      Alert.alert("Saved", "Your nickname has been updated.");
    } catch (e: any) {
      Alert.alert("Save failed", e?.message || "Unknown error.");
    } finally {
      setSaving(false);
    }
  };

  const signOut = async () => {
    Alert.alert("Sign out?", "You will need to sign in again.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          try {
            await fbSignOut(auth);
            router.replace("/sign-in" as any);
          } catch (e: any) {
            Alert.alert("Sign out failed", e?.message || "Unknown error.");
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Pressable style={styles.backHomeBtn} onPress={goHome}>
          <Text style={styles.backHomeText}>⬅ Back to Home</Text>
        </Pressable>

        <Text style={styles.title}>Profile</Text>

        <Text style={styles.label}>Nickname</Text>
        <TextInput
          value={nickname}
          onChangeText={setNickname}
          placeholder="Your name in camp"
          placeholderTextColor="#aaa"
          autoCapitalize="words"
          style={styles.input}
        />

        <Pressable
          style={[styles.saveBtn, saving ? styles.saveBtnDisabled : null]}
          onPress={saveProfile}
          disabled={saving}
        >
          <Text style={styles.saveBtnText}>{saving ? "Saving…" : "Save"}</Text>
        </Pressable>

        <Pressable style={styles.signOutBtn} onPress={signOut}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </Pressable>

        <Text style={styles.note}>
          Tip: This nickname will appear on your memories and comments.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  container: { padding: 16 },

  backHomeBtn: {
    borderWidth: 2,
    borderColor: "#111",
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignSelf: "flex-start",
    backgroundColor: "#fff",
    marginBottom: 14,
  },
  backHomeText: {
    fontSize: 16,
    fontWeight: "900",
    color: "#111",
  },

  title: {
    fontSize: 40,
    fontWeight: "900",
    marginBottom: 18,
    color: "#111",
  },

  label: {
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 8,
    color: "#111",
  },

  input: {
    borderWidth: 3,
    borderColor: "#111",
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 20,
    fontWeight: "800",
  },

  saveBtn: {
    marginTop: 14,
    height: 72,
    borderRadius: 22,
    backgroundColor: "#111",
    alignItems: "center",
    justifyContent: "center",
  },
  saveBtnDisabled: {
    backgroundColor: "#888",
  },
  saveBtnText: {
    fontSize: 22,
    fontWeight: "900",
    color: "#fff",
  },

  signOutBtn: {
    marginTop: 22,
    alignItems: "center",
    paddingVertical: 10,
  },
  signOutText: {
    fontSize: 18,
    fontWeight: "900",
    color: "#c00",
  },

  note: {
    marginTop: 18,
    fontSize: 14,
    fontWeight: "700",
    color: "#666",
  },
});
