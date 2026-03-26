// app/new-entry.tsx
import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";

import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/src/lib/firebase";

export default function NewEntryScreen() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [saving, setSaving] = useState(false);

  const canSave = useMemo(
    () => !saving && (title.trim().length > 0 || details.trim().length > 0),
    [title, details, saving]
  );

  async function onSave() {
    if (!canSave) return;

    const user = auth.currentUser;
    if (!user) {
      Alert.alert("Sign in required", "Please sign in before saving a memory.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        type: "text" as const,
        title: title.trim(),
        details: details.trim(),
        authorId: user.uid,
        authorName: user.displayName ?? "", // optional
        createdAt: serverTimestamp(),
        clientCreatedAt: Date.now(),
        visibility: "private",
      };

      await addDoc(collection(db, "entries"), payload);

      Alert.alert("Saved", "Your memory was saved.");
      router.back();
    } catch (e: any) {
      console.error("Save memory failed:", e);
      Alert.alert("Save failed", e?.message ?? "Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>New memory</Text>

      <Text style={styles.label}>Title</Text>
      <TextInput
        value={title}
        onChangeText={setTitle}
        placeholder="e.g., Opening Morning"
        placeholderTextColor="rgba(255,255,255,0.35)"
        style={styles.input}
      />

      <Text style={styles.label}>Details</Text>
      <TextInput
        value={details}
        onChangeText={setDetails}
        placeholder="Add notes..."
        placeholderTextColor="rgba(255,255,255,0.35)"
        style={[styles.input, styles.textarea]}
        multiline
      />

      <View style={styles.row}>
        <Pressable style={[styles.btn, styles.btnGhost]} onPress={() => router.back()} disabled={saving}>
          <Text style={styles.btnGhostText}>Cancel</Text>
        </Pressable>

        <Pressable
          style={[styles.btn, styles.btnPrimary, !canSave ? styles.btnDisabled : null]}
          onPress={onSave}
          disabled={!canSave}
        >
          {saving ? <ActivityIndicator /> : <Text style={styles.btnPrimaryText}>Save</Text>}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000", paddingHorizontal: 20, paddingTop: 40 },
  title: { fontSize: 28, fontWeight: "900", color: "#fff", marginBottom: 20 },

  label: { color: "rgba(255,255,255,0.75)", fontWeight: "800", marginTop: 14, marginBottom: 8 },
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
  textarea: { minHeight: 140, textAlignVertical: "top" },

  row: { flexDirection: "row", gap: 12, marginTop: 20 },
  btn: { flex: 1, height: 56, borderRadius: 16, alignItems: "center", justifyContent: "center", borderWidth: 2 },
  btnGhost: { backgroundColor: "transparent", borderColor: "rgba(255,255,255,0.35)" },
  btnGhostText: { color: "#fff", fontWeight: "900", fontSize: 18 },

  btnPrimary: { backgroundColor: "#fff", borderColor: "#fff" },
  btnPrimaryText: { color: "#111", fontWeight: "900", fontSize: 18 },

  btnDisabled: { opacity: 0.45 },
});
