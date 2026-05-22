// app/field/index.tsx
import React, { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

export default function FieldScreen() {
  const params = useLocalSearchParams<{ mode?: string | string[] }>();
  const mode = Array.isArray(params.mode) ? params.mode[0] : params.mode;

  useEffect(() => {
    if (mode === "photo") {
      router.replace({
        pathname: "/field/voice",
        params: { mode: "photo" },
      });
      return;
    }

    router.replace("/field/voice");
  }, [mode]);

  return (
    <View style={styles.screen}>
      <ActivityIndicator />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0B0E12",
  },
});
