import { View, Text, Button } from "react-native";
import { useRouter } from "expo-router";

export default function SignIn() {
  const router = useRouter();

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ fontSize: 18, marginBottom: 12 }}>Sign In</Text>

      {/* Temporary QA button */}
      <Button
        title="Continue to App (QA)"
        onPress={() => router.replace("/(tabs)")}
      />
    </View>
  );
}
