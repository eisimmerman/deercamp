// app/_layout.tsx
import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";

// Initialize Firebase Web SDK (Expo Go compatible)
import "@/src/lib/firebase";


type FirebaseState =
  | { status: "loading" }
  | { status: "ready" }
  | { status: "error"; message: string };

export default function RootLayout() {
  const [fb, setFb] = useState<FirebaseState>({ status: "loading" });

  useEffect(() => {
    try {
      setFb({ status: "ready" });
    } catch (e: any) {
      setFb({ status: "error", message: e?.message ?? String(e) });
    }
  }, []);

  if (fb.status === "loading") {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <Text>Starting DeerCamp…</Text>
      </View>
    );
  }

  if (fb.status === "error") {
    return (
      <View style={{ flex: 1, padding: 20, justifyContent: "center" }}>
        <Text style={{ fontSize: 18, fontWeight: "700", marginBottom: 10 }}>
          Firebase not ready
        </Text>
        <Text style={{ opacity: 0.8 }}>{fb.message}</Text>
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}
