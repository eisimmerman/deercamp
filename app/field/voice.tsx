// app/field/voice.tsx
import React from "react";
import { StyleSheet, Text, View } from "react-native";

export default function FieldVoiceScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.h1}>Voice Capture</Text>
      <Text style={styles.sub}>Next: record voice + save locally.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#000", gap: 12 },
  h1: { fontSize: 28, fontWeight: "900", color: "#fff", marginTop: 10 },
  sub: { fontSize: 16, color: "rgba(255,255,255,0.70)", lineHeight: 22 },
});
