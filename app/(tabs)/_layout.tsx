// app/(tabs)/_layout.tsx
import React from "react";
import { Tabs } from "expo-router";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          display: "none",
          height: 0,
          position: "absolute",
        },
        tabBarShowLabel: false,
        sceneStyle: {
          backgroundColor: "#0B0E12",
        },
      }}
    />
  );
}