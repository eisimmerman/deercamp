// app/field/photo.tsx
import React, { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { router } from "expo-router";

export default function FieldPhotoScreen() {
  useEffect(() => {
    router.replace({
      pathname: "/field/voice",
      params: { mode: "photo" },
    });
  }, []);

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
