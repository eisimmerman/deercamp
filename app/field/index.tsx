// app/field/index.tsx
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";

export default function FieldModeScreen() {
  const params = useLocalSearchParams<{ captured?: string }>();
  const [showBanner, setShowBanner] = useState(false);

  const capturedType = useMemo(() => {
    const v = params?.captured;
    return typeof v === "string" ? v : undefined;
  }, [params]);

  useEffect(() => {
    if (capturedType === "photo") {
      setShowBanner(true);
      const t = setTimeout(() => setShowBanner(false), 1600);
      return () => clearTimeout(t);
    }
  }, [capturedType]);

  return (
    <View style={{ flex: 1, backgroundColor: "#000", paddingHorizontal: 18, paddingTop: 44 }}>
      {/* Big confirmation banner */}
      {showBanner && (
        <View
          style={{
            backgroundColor: "#111",
            borderWidth: 1,
            borderColor: "#2a2a2a",
            borderRadius: 18,
            paddingVertical: 14,
            paddingHorizontal: 16,
            marginBottom: 18,
          }}
        >
          <Text style={{ color: "#fff", fontSize: 22, fontWeight: "800", letterSpacing: 0.5 }}>
            PHOTO CAPTURED
          </Text>
          <Text style={{ color: "#bdbdbd", fontSize: 14, marginTop: 4 }}>
            Saved locally (for now).
          </Text>
        </View>
      )}

      <Text style={{ color: "#fff", fontSize: 48, fontWeight: "900", letterSpacing: -0.7 }}>
        Field Mode
      </Text>
      <Text style={{ color: "#9aa0a6", fontSize: 18, marginTop: 8, maxWidth: 520 }}>
        Choose a capture type. Built for gloves, cold, and low light.
      </Text>

      {/* Card */}
      <View
        style={{
          marginTop: 28,
          borderRadius: 28,
          borderWidth: 1,
          borderColor: "#2a2a2a",
          backgroundColor: "#0a0a0a",
          padding: 18,
        }}
      >
        <Text style={{ color: "#fff", fontSize: 28, fontWeight: "900", marginBottom: 14 }}>
          Capture
        </Text>

        {/* PHOTO button */}
        <Pressable
          onPress={() => router.push("/field/photo")}
          style={({ pressed }) => [
            {
              height: 84,
              borderRadius: 22,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 1,
              borderColor: "#2a2a2a",
              backgroundColor: "#000",
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Text style={{ color: "#fff", fontSize: 28, fontWeight: "900", letterSpacing: 1 }}>
            PHOTO
          </Text>
        </Pressable>

        {/* VOICE button (left as-is for now) */}
        <Pressable
          onPress={() => {}}
          style={({ pressed }) => [
            {
              height: 84,
              borderRadius: 22,
              alignItems: "center",
              justifyContent: "center",
              marginTop: 14,
              backgroundColor: "#f1f1f1",
              opacity: pressed ? 0.9 : 1,
            },
          ]}
        >
          <Text style={{ color: "#111", fontSize: 28, fontWeight: "900", letterSpacing: 1 }}>
            VOICE
          </Text>
        </Pressable>

        <Text style={{ color: "#6e6e6e", fontSize: 14, marginTop: 16 }}>
          Tip: We’ll add voice commands (“Take photo”, “Stop voice”) after the tap flows are bulletproof.
        </Text>
      </View>
    </View>
  );
}
