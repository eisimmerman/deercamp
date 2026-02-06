// app/field/photo.tsx
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { doc, updateDoc } from "firebase/firestore";

import { auth, db, storage } from "@/src/lib/firebase";

type Params = {
  uri?: string;
  photoUri?: string;
  entryId?: string;
};

async function uriToBlob(uri: string): Promise<Blob> {
  const res = await fetch(uri);
  if (!res.ok) throw new Error(`Failed to fetch file uri: ${res.status}`);
  return await res.blob();
}

export default function FieldPhotoScreen() {
  const { uri, photoUri, entryId } = useLocalSearchParams<Params>();

  const localUri = useMemo(() => {
    const u = (uri || photoUri || "").toString();
    return u.trim().length ? u : "";
  }, [uri, photoUri]);

  const [uploading, setUploading] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string>("");

  const authorId = auth.currentUser?.uid || "anonymous";

  const onUpload = async () => {
    if (!localUri) {
      Alert.alert("No photo", "No photo URI was provided to this screen.");
      return;
    }

    try {
      setUploading(true);

      const blob = await uriToBlob(localUri);

      const filename = `photo_${Date.now()}.jpg`;
      const path = `entries/${authorId}/photos/${filename}`;

      const storageRef = ref(storage, path);

      await uploadBytes(storageRef, blob, {
        contentType: "image/jpeg",
      });

      const url = await getDownloadURL(storageRef);
      setDownloadUrl(url);

      // If we know which entry this photo belongs to, update Firestore
      if (entryId && entryId.toString().trim().length) {
        const entryRef = doc(db, "entries", entryId.toString());
        await updateDoc(entryRef, { photoUrl: url });
      }

      Alert.alert("Uploaded", "Photo uploaded successfully.");
    } catch (e: any) {
      console.error("Photo upload failed:", e);
      Alert.alert("Upload failed", e?.message ?? "Unknown error");
    } finally {
      setUploading(false);
    }
  };

  const onDone = () => {
    // Send user back (or route to entry detail if entryId exists)
    if (entryId && entryId.toString().trim().length) {
      router.replace(`/entry/${entryId.toString()}`);
      return;
    }
    router.back();
  };

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Text style={styles.title}>Photo</Text>
      <Text style={styles.muted}>
        Field Mode photo upload (Storage + optional Firestore update)
      </Text>

      <View style={styles.card}>
        {localUri ? (
          <Image source={{ uri: localUri }} style={styles.preview} />
        ) : (
          <View style={styles.previewEmpty}>
            <Text style={styles.previewEmptyText}>No photo URI found</Text>
          </View>
        )}

        {!!entryId && (
          <Text style={styles.meta}>
            Entry: <Text style={styles.metaStrong}>{entryId.toString()}</Text>
          </Text>
        )}

        <Text style={styles.meta}>
          Author: <Text style={styles.metaStrong}>{authorId}</Text>
        </Text>

        <View style={styles.row}>
          <Pressable
            onPress={onUpload}
            disabled={uploading || !localUri}
            style={({ pressed }) => [
              styles.btn,
              pressed && styles.btnPressed,
              (uploading || !localUri) && styles.btnDisabled,
            ]}
          >
            {uploading ? (
              <View style={styles.btnInner}>
                <ActivityIndicator />
                <Text style={styles.btnText}>Uploading…</Text>
              </View>
            ) : (
              <Text style={styles.btnText}>Upload Photo</Text>
            )}
          </Pressable>

          <Pressable
            onPress={onDone}
            style={({ pressed }) => [styles.btnAlt, pressed && styles.btnPressed]}
          >
            <Text style={styles.btnAltText}>Done</Text>
          </Pressable>
        </View>

        {!!downloadUrl && (
          <View style={styles.result}>
            <Text style={styles.resultLabel}>Download URL</Text>
            <Text selectable style={styles.resultUrl}>
              {downloadUrl}
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    padding: 14,
    gap: 10,
  },
  title: {
    fontSize: 22,
    fontWeight: "900",
    color: "#111827",
  },
  muted: {
    color: "#6b7280",
  },
  card: {
    backgroundColor: "white",
    borderRadius: 14,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#e5e7eb",
    gap: 10,
  },
  preview: {
    width: "100%",
    height: 360,
    borderRadius: 12,
    backgroundColor: "#f3f4f6",
  },
  previewEmpty: {
    width: "100%",
    height: 240,
    borderRadius: 12,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
  },
  previewEmptyText: {
    color: "#6b7280",
    fontWeight: "700",
  },
  meta: {
    color: "#374151",
    fontSize: 13,
  },
  metaStrong: {
    color: "#111827",
    fontWeight: "800",
  },
  row: {
    flexDirection: "row",
    gap: 10,
    marginTop: 6,
  },
  btn: {
    flex: 1,
    backgroundColor: "#111827",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  btnInner: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  btnPressed: { opacity: 0.85 },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: "white", fontWeight: "900" },

  btnAlt: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#e5e7eb",
    backgroundColor: "white",
    alignItems: "center",
    justifyContent: "center",
  },
  btnAltText: { color: "#111827", fontWeight: "900" },

  result: {
    marginTop: 8,
    padding: 10,
    borderRadius: 12,
    backgroundColor: "#f9fafb",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#e5e7eb",
    gap: 6,
  },
  resultLabel: { fontWeight: "900", color: "#111827" },
  resultUrl: { color: "#111827", fontSize: 12 },
});
