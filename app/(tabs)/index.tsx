import auth from "@react-native-firebase/auth";
import firestore from "@react-native-firebase/firestore";
import storage from "@react-native-firebase/storage";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";

import BottomNav, { BOTTOM_NAV_BASE_HEIGHT } from "../../components/BottomNav";
import { useUserProfile } from "../../lib/useUserProfile";

export default function HomeScreen() {
  const router = useRouter();
  const { profile } = useUserProfile();
  const user = auth().currentUser;
  const insets = useSafeAreaInsets();

  const [uploading, setUploading] = useState(false);
  const [localCoverUrl, setLocalCoverUrl] = useState<string>("");

  const coverUrl = useMemo(() => {
    return localCoverUrl || (profile as any)?.coverPhotoUrl || "";
  }, [localCoverUrl, profile]);

  const statusLabel = useMemo(() => {
    const name = profile?.displayName?.trim();
    if (!user) return "Sign in";
    return name ? `${name} ▾` : "Signed in ▾";
  }, [profile?.displayName, user]);

  const onPressStatusPill = () => {
    if (!user) {
      router.push("/sign-in" as any);
      return;
    }
    router.push("/profile" as any);
  };

  const onPressProfileTile = () => {
    if (!user) {
      router.push("/sign-in" as any);
      return;
    }
    router.push("/profile" as any);
  };

  const pickAndUploadCover = async () => {
    try {
      if (!user) {
        Alert.alert("Not signed in", "Sign in to set a camp cover photo.");
        return;
      }

      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          "Permission needed",
          "Please allow photo access to choose a cover image."
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.85,
      });

      if (result.canceled) return;

      const asset = result.assets?.[0];
      if (!asset?.uri) return;

      setUploading(true);

      const uid = user.uid;
      const ext = asset.uri.toLowerCase().includes(".png") ? "png" : "jpg";

      // Store cover under a stable folder for this user
      const path = `covers/${uid}/cover_${Date.now()}.${ext}`;
      const ref = storage().ref(path);

      await ref.putFile(asset.uri);
      const url = await ref.getDownloadURL();

      // Save URL on user profile
      await firestore().collection("users").doc(uid).set(
        {
          coverPhotoUrl: url,
          coverUpdatedAt: firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      setLocalCoverUrl(url);
    } catch (e: any) {
      Alert.alert("Cover upload failed", e?.message || "Unknown error.");
    } finally {
      setUploading(false);
    }
  };

  // ✅ Remove cover photo: clears Firestore field + tries to delete the storage object
  const removeCoverPhoto = async () => {
    try {
      if (!user) return;

      const uid = user.uid;

      setUploading(true);

      const currentUrl = coverUrl;

      // 1) Clear profile field first (so UI clears even if delete fails)
      await firestore().collection("users").doc(uid).set(
        {
          coverPhotoUrl: firestore.FieldValue.delete(),
          coverUpdatedAt: firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      // 2) Clear local state immediately
      setLocalCoverUrl("");

      // 3) Best-effort: delete from Storage if we can resolve a ref
      // This works for Firebase Storage download URLs.
      try {
        if (currentUrl) {
          const ref = storage().refFromURL(currentUrl);
          await ref.delete();
        }
      } catch {
        // ignore: URL might be old or already deleted
      }
    } catch (e: any) {
      Alert.alert("Remove failed", e?.message || "Unknown error.");
    } finally {
      setUploading(false);
    }
  };

  // ✅ Tap behavior: if cover exists => offer Replace or Remove
  const onPressCover = () => {
    if (!user) {
      Alert.alert("Not signed in", "Sign in to set a camp cover photo.");
      return;
    }

    if (!coverUrl) {
      pickAndUploadCover();
      return;
    }

    Alert.alert("Cover photo", "What would you like to do?", [
      { text: "Cancel", style: "cancel" },
      { text: "Replace Photo", onPress: pickAndUploadCover },
      { text: "Remove Photo", style: "destructive", onPress: removeCoverPhoto },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      <ScrollView
        contentContainerStyle={{
          paddingBottom:
            BOTTOM_NAV_BASE_HEIGHT + Math.max(insets.bottom, 10) + 24,
        }}
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.brand}>DeerCamp</Text>
            <Text style={styles.subtitle}>Your camp journal</Text>
          </View>

          <Pressable style={styles.statusPill} onPress={onPressStatusPill}>
            <Text style={styles.statusText}>{statusLabel}</Text>
          </Pressable>
        </View>

        {/* Cover (tap to replace/remove) */}
        <Pressable style={styles.coverCard} onPress={onPressCover}>
          {coverUrl ? (
            <Image source={{ uri: coverUrl }} style={styles.coverImage} />
          ) : (
            <View style={styles.coverPlaceholder}>
              <Text style={styles.coverTitle}>DeerCamp Cover Photo</Text>
              <Text style={styles.coverSub}>(tap to add a warm camp image)</Text>

              {uploading ? (
                <View style={{ marginTop: 14 }}>
                  <ActivityIndicator />
                </View>
              ) : null}
            </View>
          )}

          {uploading && coverUrl ? (
            <View style={styles.uploadOverlay}>
              <ActivityIndicator />
              <Text style={styles.uploadText}>Saving…</Text>
            </View>
          ) : null}
        </Pressable>

        {/* Centered label under cover */}
        <Text style={styles.ourCampLabel}>Our Camp</Text>

        {/* Quick actions */}
        <View style={styles.qaCard}>
          <Text style={styles.qaTitle}>Quick actions</Text>

          <View style={styles.tileRow}>
            <Pressable
              style={[styles.tile, styles.tileDark]}
              onPress={() => router.push("/feed" as any)}
            >
              <Text style={[styles.tileTop, styles.tileTextDark]}>Camp</Text>
              <Text
                style={[styles.tileBottom, styles.tileTextDark]}
                numberOfLines={1}
              >
                Feed
              </Text>
            </Pressable>

            <Pressable
              style={[styles.tile, styles.tileDark]}
              onPress={() => router.push("/new-entry" as any)}
            >
              <Text style={[styles.tileTop, styles.tileTextDark]}>+ Add</Text>
              <Text
                style={[styles.tileBottom, styles.tileTextDark]}
                numberOfLines={1}
              >
                Memory
              </Text>
            </Pressable>
          </View>

          <Pressable style={styles.profileBar} onPress={onPressProfileTile}>
            <Text style={styles.profileBarText}>My Profile</Text>
          </Pressable>
        </View>
      </ScrollView>

      <BottomNav />
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    marginTop: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  brand: {
    fontSize: 36,
    fontWeight: "900",
    lineHeight: 40,
  },
  subtitle: {
    fontSize: 18,
    color: "#666",
    marginTop: 4,
  },

  statusPill: {
    borderWidth: 2,
    borderColor: "#e5e5e5",
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignSelf: "flex-start",
    backgroundColor: "#fff",
  },
  statusText: {
    fontSize: 16,
    fontWeight: "800",
  },

  coverCard: {
    marginTop: 14,
    marginHorizontal: 16,
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#e5e5e5",
    backgroundColor: "#fff",
  },
  coverImage: {
    width: "100%",
    height: 220,
  },
  coverPlaceholder: {
    width: "100%",
    height: 220,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  coverTitle: {
    fontSize: 26,
    fontWeight: "900",
    color: "#777",
    textAlign: "center",
  },
  coverSub: {
    marginTop: 8,
    fontSize: 16,
    color: "#999",
    textAlign: "center",
  },

  uploadOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "rgba(255,255,255,0.85)",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  uploadText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#333",
  },

  ourCampLabel: {
    marginTop: 12,
    marginBottom: 18,
    textAlign: "center",
    fontSize: 16,
    fontWeight: "800",
    color: "#444",
  },

  qaCard: {
    marginHorizontal: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#e5e5e5",
    padding: 16,
  },
  qaTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#999",
    marginBottom: 12,
  },

  tileRow: {
    flexDirection: "row",
    gap: 14,
  },
  tile: {
    flex: 1,
    borderRadius: 22,
    paddingVertical: 22,
    paddingHorizontal: 12,
    minHeight: 132,
    justifyContent: "center",
    alignItems: "center",
  },
  tileDark: {
    backgroundColor: "#000",
  },

  tileTop: {
    fontSize: 30,
    fontWeight: "900",
    lineHeight: 34,
    textAlign: "center",
  },
  tileBottom: {
    marginTop: 6,
    fontSize: 26,
    fontWeight: "900",
    lineHeight: 30,
    textAlign: "center",
  },
  tileTextDark: {
    color: "#fff",
  },

  profileBar: {
    marginTop: 14,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: "#111",
    backgroundColor: "#fff",
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  profileBarText: {
    fontSize: 18,
    fontWeight: "900",
    color: "#111",
  },
});
