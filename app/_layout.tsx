import React, { useEffect } from "react";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useAuth } from "../src/auth/useAuth";

SplashScreen.preventAutoHideAsync().catch(() => {
  // no-op
});

export default function RootLayout() {
  const { initializing } = useAuth();

  useEffect(() => {
    if (!initializing) {
      SplashScreen.hideAsync().catch(() => {
        // no-op
      });
    }
  }, [initializing]);

  if (initializing) {
    return null;
  }

  return <Stack screenOptions={{ headerShown: false, animation: "none" }} />;
}
