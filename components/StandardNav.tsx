import { useRouter } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

type Props = {
  showHome?: boolean;
  showBack?: boolean;
  showAdd?: boolean;
  addHref?: string; // default "/new-entry"
  homeHref?: string; // default "/(tabs)"
  onBack?: () => void;
};

export default function StandardNav({
  showHome = true,
  showBack = true,
  showAdd = true,
  addHref = "/new-entry",
  homeHref = "/(tabs)",
  onBack,
}: Props) {
  const router = useRouter();

  const safeBack = () => {
    if (onBack) return onBack();
    if (router.canGoBack()) router.back();
    else router.replace(homeHref as any);
  };

  return (
    <View style={styles.wrap}>
      {showHome ? (
        <Pressable
          onPress={() => router.replace(homeHref as any)}
          style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
          hitSlop={10}
        >
          <Text style={styles.btnText}>Home</Text>
        </Pressable>
      ) : (
        <View style={styles.spacer} />
      )}

      {showBack ? (
        <Pressable
          onPress={safeBack}
          style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
          hitSlop={10}
        >
          <Text style={styles.btnText}>Back</Text>
        </Pressable>
      ) : (
        <View style={styles.spacer} />
      )}

      {showAdd ? (
        <Pressable
          onPress={() => router.push(addHref as any)}
          style={({ pressed }) => [styles.btnPrimary, pressed && styles.btnPressed]}
          hitSlop={10}
        >
          <Text style={styles.btnTextPrimary}>+ Add</Text>
        </Pressable>
      ) : (
        <View style={styles.spacer} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: "#e6e6e6",
    backgroundColor: "#fff",
  },
  spacer: { flex: 1 },
  btn: {
    flex: 1,
    height: 56,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: "#000",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  btnPrimary: {
    flex: 1,
    height: 56,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: "#000",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#000",
  },
  btnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
  btnText: {
    fontSize: 18,
    fontWeight: "900",
    color: "#000",
  },
  btnTextPrimary: {
    fontSize: 18,
    fontWeight: "900",
    color: "#fff",
  },
});
