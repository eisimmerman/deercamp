// app/(tabs)/index.tsx
import React, { useCallback } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useRouter } from "expo-router";

export default function HomeScreen() {
  const router = useRouter();

  const onMyMoment = useCallback(() => {
    router.push("/field");
  }, [router]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>DeerCamp</Text>
      <Text style={styles.subtitle}>Welcome back.</Text>

      <View style={styles.actions}>
        <Text style={styles.sectionLabel}>FIELD MODE</Text>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="My Moment"
          onPress={onMyMoment}
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && styles.primaryButtonPressed,
          ]}
        >
          <View style={styles.primaryButtonInner}>
            <Text style={styles.primaryButtonTitle}>MY MOMENT</Text>
            <Text style={styles.primaryButtonHint}>
              Tap to capture a Photo or Voice memory.
            </Text>
          </View>

          <Text style={styles.primaryButtonChevron}>›</Text>
        </Pressable>

        <Text style={styles.note}>Photo is live. Voice is next.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    paddingHorizontal: 20,
    paddingTop: 40,
  },
  title: {
    fontSize: 34,
    fontWeight: "900",
    color: "#fff",
    marginBottom: 8,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "rgba(255,255,255,0.75)",
    marginBottom: 28,
  },

  actions: {
    marginTop: 6,
  },
  sectionLabel: {
    color: "rgba(255,255,255,0.60)",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.6,
    marginBottom: 12,
  },

  // XL glove target
  primaryButton: {
    minHeight: 96,
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 18,
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  primaryButtonPressed: {
    transform: [{ scale: 0.99 }],
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  primaryButtonInner: {
    flex: 1,
    paddingRight: 12,
  },
  primaryButtonTitle: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "900",
    marginBottom: 6,
    letterSpacing: 1.0,
  },
  primaryButtonHint: {
    color: "rgba(255,255,255,0.70)",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
  },
  primaryButtonChevron: {
    color: "rgba(255,255,255,0.80)",
    fontSize: 40,
    fontWeight: "900",
    marginLeft: 12,
    marginTop: -2,
  },

  note: {
    marginTop: 14,
    color: "rgba(255,255,255,0.55)",
    fontSize: 12,
    fontWeight: "700",
  },
});
