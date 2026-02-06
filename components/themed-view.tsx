// components/themed-view.tsx
import React from "react";
import { View, type ViewProps, type StyleProp, type ViewStyle } from "react-native";

export type ThemedViewProps = ViewProps & {
  style?: StyleProp<ViewStyle>;
};

/**
 * DeerCamp uses a calm, readable default surface.
 * This is intentionally minimal: a predictable wrapper around <View>.
 */
export function ThemedView({ style, ...rest }: ThemedViewProps) {
  return <View {...rest} style={style} />;
}

// Optional default export for convenience (won't break named import usage)
export default ThemedView;
