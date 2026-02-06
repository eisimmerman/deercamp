// app/set-nickname.tsx
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";

import { useUserProfile } from "../src/lib/useUserProfile";


import { auth, db } from "@/src/lib/firebase";



import { updateProfile } from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";

export default function SetNicknameScreen() {
  const router = useRouter();
  const user = auth.currentUser;
  const { profile } = useUserProfile();

  const [name, setName] = useState(profile?.displayName ?? "");
  const trimmed = useMemo(() => name.trim(), [name]);

  const save = async () => {
    if (!user) {
      Alert.alert("Not signed in", "Please sign in again.");
      return;
    }

    if (!trimmed) {
      Alert.alert("Nickname needed", "What do folks call you at camp?");
      return;
    }

    try {
      await setDoc(
        doc(db, "users", user.uid),
        {
          uid: user.uid,
          email: user.email ?? "",
          displayName: trimmed,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      await updateProfile(user, { displayName: trimmed });

      Alert.alert("Saved", `Alright, ${trimmed}.`);
      router.replace("/(tabs)" as any);
    } catch (err: any) {
      console.error("Failed to save nickname", err);
      Alert.alert("Could not save nickname", err?.message ?? "Please try again.");
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#FAFAFA", padding: 20 }}>
      <Text style={{ fontSize: 28, fontWeight: "800" }}>Camp Nickname</Text>

      <Text style={{ marginTop: 10, opacity: 0.7 }}>
        What do folks call you at camp?
      </Text>

      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="e.g., Gramps, One-Shot, Scout…"
        autoFocus
        style={{
          marginTop: 16,
          backgroundColor: "white",
          borderRadius: 12,
          paddingHorizontal: 12,
          paddingVertical: 12,
          fontSize: 18,
        }}
      />

      <Pressable
        onPress={save}
        style={{
          marginTop: 16,
          backgroundColor: "black",
          paddingVertical: 14,
          borderRadius: 14,
          alignItems: "center",
        }}
      >
        <Text style={{ color: "white", fontSize: 16, fontWeight: "800" }}>
          Save Nickname
        </Text>
      </Pressable>

      <Pressable
        onPress={() => router.back()}
        style={{
          marginTop: 12,
          backgroundColor: "rgba(0,0,0,0.08)",
          paddingVertical: 14,
          borderRadius: 14,
          alignItems: "center",
        }}
      >
        <Text style={{ fontSize: 16, fontWeight: "700" }}>Back</Text>
      </Pressable>
    </View>
  );
}
