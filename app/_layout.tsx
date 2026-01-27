import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import "react-native-reanimated";

import auth from "@react-native-firebase/auth";
import { useColorScheme } from "@/hooks/use-color-scheme";

export const unstable_settings = {
  anchor: "(tabs)",
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();

  const [bootstrapped, setBootstrapped] = useState(false);

  useEffect(() => {
    // Determine auth state, then route accordingly.
    const unsubscribe = auth().onAuthStateChanged((user) => {
      // IMPORTANT: route groups are not part of the URL path
      router.replace(user ? "/(tabs)" : "/sign-in");
      setBootstrapped(true);
    });

    return unsubscribe;
  }, [router]);

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      {/* Always render navigation container */}
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
      </Stack>

      {/* Overlay a simple boot screen so QA never sees blank */}
      {!bootstrapped && (
        <View
          style={{
            position: "absolute",
            inset: 0,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ActivityIndicator />
        </View>
      )}

      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
