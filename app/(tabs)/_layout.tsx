import React, { useEffect } from "react";
import { AppState } from "react-native";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useAuth } from "@/auth/useAuth";
import { processUploadQueueOnce } from "@/lib/capture/uploadWorker";

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

      void processUploadQueueOnce(10).catch((error) => {
        console.error("startup upload queue processing failed:", error);
      });
    }
  }, [initializing]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        void processUploadQueueOnce(10).catch((error) => {
          console.error("resume upload queue processing failed:", error);
        });
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  if (initializing) {
    return null;
  }

  return <Stack screenOptions={{ headerShown: false, animation: "none" }} />;
}