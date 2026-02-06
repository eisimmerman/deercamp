// app/(tabs)/_layout.tsx
import React from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

/**
 * Tabs layout (bottom navigation).
 * Auth gating should live outside this file.
 */
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,

        tabBarStyle: {
          backgroundColor: "#0B0E12",
          borderTopColor: "rgba(255,255,255,0.08)",
        },
        tabBarActiveTintColor: "white",
        tabBarInactiveTintColor: "rgba(255,255,255,0.6)",

        tabBarIcon: ({ color, size, focused }) => {
          const name = (() => {
            switch (route.name) {
              case "index":
                return focused ? "home" : "home-outline";
              case "explore":
                return focused ? "compass" : "compass-outline";
              case "memories":
                return focused ? "images" : "images-outline";
              case "profile":
                return focused ? "person" : "person-outline";
              default:
                return focused ? "ellipse" : "ellipse-outline";
            }
          })();

          // @ts-ignore - Ionicons name union can be noisy in TS; safe here.
          return <Ionicons name={name} size={size ?? 22} color={color} />;
        },
      })}
    >
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="explore" options={{ title: "Explore" }} />
      <Tabs.Screen name="memories" options={{ title: "Memories" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}
