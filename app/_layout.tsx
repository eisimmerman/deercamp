import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import auth from "@react-native-firebase/auth";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import "react-native-reanimated";

import { useColorScheme } from "@/hooks/use-color-scheme";

export const unstable_settings = {
  // You can keep this, but we now explicitly include (auth) + (tabs) below.
  anchor: "(tabs)",
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const segments = useSegments();

  const [isReady, setIsReady] = useState(false);
  const [isAuthed, setIsAuthed] = useState<boolean>(false);

  useEffect(() => {
    const unsub = auth().onAuthStateChanged((user) => {
      setIsAuthed(!!user);
      setIsReady(true);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!isReady) return;

    // segments[0] is the top-level route group: "(tabs)" or "(auth)" (or undefined at startup)
    const inAuthGroup = segments[0] === "(auth)";

    // QA-safe auth guard:
    // - If NOT signed in, force to /sign-in
    // - If signed in, keep out of auth screens
    if (!isAuthed && !inAuthGroup) {
      router.replace("/sign-in"); // NOTE: route groups are NOT in the URL
    } else if (isAuthed && inAuthGroup) {
      router.replace("/"); // goes to tabs index
    }
  }, [isReady, isAuthed, segments, router]);

  if (!isReady) {
    return (
      <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator />
        </View>
        <StatusBar style="auto" />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        {/* IMPORTANT: include BOTH route groups so "(auth)" exists */}
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />

        {/* Other routes */}
        <Stack.Screen name="modal" options={{ presentation: "modal", title: "Modal" }} />
      </Stack>

      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
