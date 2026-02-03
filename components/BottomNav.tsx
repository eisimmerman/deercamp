// DeerCamp/components/BottomNav.tsx
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Glove-friendly target: screens can use this for bottom padding if needed
export const BOTTOM_NAV_BASE_HEIGHT = 96;

type TabBarProps = {
  state: any;
  descriptors: any;
  navigation: any;
};

// Allow BottomNav to be used accidentally without props in screens.
// In that case, render nothing (prevents duplicate nav + fixes TS).
type Props = Partial<TabBarProps>;

export default function BottomNav({ state, descriptors, navigation }: Props) {
  const insets = useSafeAreaInsets();

  // If used without TabBar props (e.g., <BottomNav /> inside a screen),
  // render nothing. The real nav should come from Tabs tabBar.
  if (!state || !descriptors || !navigation) return null;

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      <View style={styles.row}>
        {state.routes.map((route: any, index: number) => {
          const { options } = descriptors[route.key];
          const label = options.title ?? route.name;
          const isFocused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          const onLongPress = () => {
            navigation.emit({ type: "tabLongPress", target: route.key });
          };

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              onPress={onPress}
              onLongPress={onLongPress}
              style={({ pressed }) => [
                styles.btn,
                isFocused ? styles.btnActive : styles.btnInactive,
                pressed ? styles.btnPressed : null
              ]}
            >
              <Text style={[styles.text, isFocused ? styles.textActive : styles.textInactive]}>
                {String(label).toUpperCase()}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.12)",
    backgroundColor: "#000",
    paddingHorizontal: 14,
    paddingTop: 12
  },

  row: { flexDirection: "row", gap: 12 },

  btn: {
    flex: 1,
    minHeight: 62, // glove-friendly
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2
  },

  btnActive: {
    backgroundColor: "#fff",
    borderColor: "#fff"
  },

  btnInactive: {
    backgroundColor: "transparent",
    borderColor: "rgba(255,255,255,0.65)"
  },

  btnPressed: {
    opacity: 0.9
  },

  text: { fontSize: 18, fontWeight: "900" },
  textActive: { color: "#111" },
  textInactive: { color: "#fff" }
});
