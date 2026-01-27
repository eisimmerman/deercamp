import React from "react";
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  ViewStyle,
} from "react-native";

type Props = {
  onPress: () => void;

  /** Preferred */
  label?: string;

  /** Back-compat alias */
  title?: string;

  /** Optional: allow child content (string or custom) */
  children?: React.ReactNode;

  /** Smaller height for dense screens */
  compact?: boolean;

  /** Outline style */
  secondary?: boolean;

  disabled?: boolean;

  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
};

export default function AppButton({
  onPress,
  label,
  title,
  children,
  compact = false,
  secondary = false,
  disabled = false,
  style,
  textStyle,
}: Props) {
  const text =
    label ??
    title ??
    (typeof children === "string" ? children : undefined);

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        compact ? styles.compact : styles.regular,
        secondary ? styles.secondary : styles.primary,
        disabled ? styles.disabled : null,
        pressed && !disabled ? styles.pressed : null,
        style,
      ]}
      accessibilityRole="button"
    >
      {text ? (
        <Text
          style={[
            styles.text,
            secondary ? styles.textSecondary : styles.textPrimary,
            compact ? styles.textCompact : styles.textRegular,
            textStyle,
          ]}
          numberOfLines={2}
          ellipsizeMode="tail"
        >
          {text}
        </Text>
      ) : (
        children
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    borderWidth: 2,
  },

  regular: {
    height: 62,
  },

  // ✅ Taller so 2-line labels (like "+ Add Memory") don't clip
  compact: {
    height: 54,
  },

  primary: {
    backgroundColor: "#000",
    borderColor: "#000",
  },

  secondary: {
    backgroundColor: "#fff",
    borderColor: "#000",
  },

  text: {
    fontWeight: "800",
    textAlign: "center",
  },

  textRegular: {
    fontSize: 20,
    lineHeight: 24,
  },

  // ✅ Slightly smaller + tighter line height for compact buttons
  textCompact: {
    fontSize: 16,
    lineHeight: 18,
  },

  textPrimary: {
    color: "#fff",
  },

  textSecondary: {
    color: "#000",
  },

  pressed: {
    opacity: 0.85,
  },

  disabled: {
    opacity: 0.45,
  },
});
