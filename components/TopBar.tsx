import auth from "@react-native-firebase/auth";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, Text, View } from "react-native";

type TopBarProps = {
  title: string;
  showBack?: boolean;
  rightAction?: "add" | "signout" | null;
};

export default function TopBar({
  title,
  showBack = true,
  rightAction = null,
}: TopBarProps) {
  const router = useRouter();

  const onBack = () => {
    try {
      (router as any).back?.();
    } catch {
      router.replace("/(tabs)" as any);
    }
  };

  const onAdd = () => {
    router.push("/new-entry" as any);
  };

  const onSignOut = async () => {
    await auth().signOut();
    router.replace("/sign-in" as any);
  };

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 2,
        borderBottomColor: "rgba(0,0,0,0.08)",
        backgroundColor: "#FAFAFA",
      }}
    >
      {/* LEFT */}
      <View style={{ width: 90 }}>
        {showBack && (
          <Pressable
            onPress={onBack}
            style={{
              backgroundColor: "white",
              borderWidth: 2,
              borderColor: "rgba(0,0,0,0.12)",
              paddingVertical: 8,
              paddingHorizontal: 12,
              borderRadius: 12,
            }}
          >
            <Text style={{ fontWeight: "900", fontSize: 16 }}>← Back</Text>
          </Pressable>
        )}
      </View>

      {/* CENTER */}
      <View style={{ flex: 1, alignItems: "center" }}>
        <Text
          style={{
            fontSize: 22,
            fontWeight: "900",
          }}
          numberOfLines={1}
        >
          {title}
        </Text>
      </View>

      {/* RIGHT */}
      <View style={{ width: 90, alignItems: "flex-end" }}>
        {rightAction === "add" && (
          <Pressable
            onPress={onAdd}
            style={{
              backgroundColor: "black",
              paddingVertical: 8,
              paddingHorizontal: 14,
              borderRadius: 12,
            }}
          >
            <Text style={{ color: "white", fontWeight: "900", fontSize: 16 }}>
              + Add
            </Text>
          </Pressable>
        )}

        {rightAction === "signout" && (
          <Pressable
            onPress={onSignOut}
            style={{
              backgroundColor: "white",
              borderWidth: 2,
              borderColor: "rgba(0,0,0,0.12)",
              paddingVertical: 8,
              paddingHorizontal: 12,
              borderRadius: 12,
            }}
          >
            <Text style={{ fontWeight: "900", fontSize: 16 }}>Sign out</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
