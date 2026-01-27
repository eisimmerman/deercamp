import React from "react";
import { StyleProp, Text, TextProps, TextStyle } from "react-native";

export type ThemedTextProps = TextProps & {
  type?: "default" | "defaultSemiBold" | "title" | "subtitle";
  style?: StyleProp<TextStyle>;
};

export function ThemedText({
  type = "default",
  style,
  ...rest
}: ThemedTextProps) {
  const base: TextStyle = { color: "#111827" };

  const variants: Record<string, TextStyle> = {
    default: { fontSize: 16 },
    defaultSemiBold: { fontSize: 16, fontWeight: "600" },
    title: { fontSize: 34, fontWeight: "800", letterSpacing: -0.3 },
    subtitle: { fontSize: 18, fontWeight: "700" },
  };

  return <Text {...rest} style={[base, variants[type], style]} />;
}
