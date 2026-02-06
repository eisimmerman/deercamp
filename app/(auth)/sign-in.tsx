// app/(auth)/sign-in.tsx
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Redirect, useRouter } from "expo-router";

import AppButton from "@/components/AppButton";

/**
 * DEV RULE:
 * In __DEV__, never stop on this screen. Go straight into the app.
 * Using <Redirect /> avoids the "shaking" loop you can get with useEffect + router.replace.
 */
export default function SignInScreen() {
  if (__DEV__) {
    return <Redirect href="/(tabs)" />;
  }

  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>DeerCamp</Text>
      <Text style={styles.subtitle}>Sign in to continue.</Text>

      <AppButton
        label="Continue to App (QA)"
        onPress={() => router.replace("/(tabs)")}
        style={{ marginTop: 18 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    paddingHorizontal: 20,
    paddingTop: 60,
  },
  title: {
    fontSize: 34,
    fontWeight: "900",
    color: "#fff",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "rgba(255,255,255,0.75)",
    lineHeight: 22,
  },
});
