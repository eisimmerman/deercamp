import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useRouter } from "expo-router";

import AppButton from "@/components/AppButton";

export default function ProfileScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Profile</Text>
      <Text style={styles.subtitle}>Welcome, Hunter</Text>

      <View style={styles.section}>
        <AppButton
          label="Edit Nickname"
          onPress={() => router.push("/set-nickname")}
        />

        <View style={{ height: 12 }} />

        <AppButton
          label="Sign Out"
          onPress={() => router.replace("/(auth)/sign-in")}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    paddingHorizontal: 20,
    paddingTop: 40
  },
  title: {
    fontSize: 28,
    fontWeight: "900",
    color: "#fff",
    marginBottom: 8
  },
  subtitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "rgba(255,255,255,0.75)",
    marginBottom: 32
  },
  section: {
    gap: 12
  }
});
