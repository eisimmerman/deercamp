import { useRouter } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export const BOTTOM_NAV_BASE_HEIGHT = 86; // without safe-area

export default function BottomNav() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      <View style={styles.row}>
        <Pressable
          style={[styles.btn, styles.btnLight]}
          onPress={() => router.replace("/" as any)}
        >
          <Text style={styles.btnTextDark}>Home</Text>
        </Pressable>

        <Pressable style={[styles.btn, styles.btnLight]} onPress={() => router.back()}>
          <Text style={styles.btnTextDark}>Back</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#eaeaea",
    paddingTop: 10,
    paddingHorizontal: 14,
  },
  row: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    justifyContent: "center", // ✅ center the 2 buttons
  },
  btn: {
    height: 64,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    width: 160, // ✅ fixed width so Home/Back sit centered as a pair
  },
  btnLight: {
    backgroundColor: "#fff",
    borderWidth: 3,
    borderColor: "#111",
  },
  btnTextDark: {
    fontSize: 20,
    fontWeight: "900",
    color: "#111",
  },
});
