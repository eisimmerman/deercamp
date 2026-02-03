import React from "react";
import { Tabs } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

function BigTabBar({
  state,
  descriptors,
  navigation,
}: {
  state: any;
  descriptors: any;
  navigation: any;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        paddingTop: 12,
        paddingHorizontal: 14,
        paddingBottom: Math.max(insets.bottom, 12),
        backgroundColor: "#0B0F17",
        borderTopWidth: 1,
        borderTopColor: "rgba(255,255,255,0.10)",
      }}
    >
      <View style={{ flexDirection: "row", gap: 12 }}>
        {state.routes.map((route: any, index: number) => {
          const { options } = descriptors[route.key];
          const label =
            options.tabBarLabel ?? options.title ?? route.name ?? "Tab";

          const isFocused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          const onLongPress = () => {
            navigation.emit({
              type: "tabLongPress",
              target: route.key,
            });
          };

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              testID={options.tabBarButtonTestID}
              onPress={onPress}
              onLongPress={onLongPress}
              style={({ pressed }) => ({
                flex: 1,
                minHeight: 60, // glove-friendly target
                borderRadius: 16,
                alignItems: "center",
                justifyContent: "center",
                opacity: pressed ? 0.9 : 1,
                backgroundColor: isFocused ? "#FFFFFF" : "transparent",
                borderWidth: isFocused ? 0 : 2,
                borderColor: isFocused ? "transparent" : "rgba(255,255,255,0.65)",
              })}
            >
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: "800",
                  color: isFocused ? "#0B0F17" : "#FFFFFF",
                }}
                numberOfLines={1}
              >
                {String(label).toUpperCase()}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const tint = Colors[colorScheme ?? "light"].tint;

  return (
    <Tabs
      // IMPORTANT: replace the default tiny icon tab bar
      tabBar={(props) => <BigTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: tint, // safe to keep; not used by our custom bar
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
        }}
      />

      <Tabs.Screen
        name="memories"
        options={{
          title: "Memories",
        }}
      />

      <Tabs.Screen
        name="explore"
        options={{
          title: "Explore",
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
        }}
      />
    </Tabs>
  );
}
