import { View, Text, StyleSheet } from "react-native";

export default function QABanner() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>QA BUILD</Text>
      <Text style={styles.subtitle}>
        Authentication + data may be mocked or incomplete
      </Text>
      <Text style={styles.hint}>
        Report issues with screen name + steps
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#111",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  title: {
    color: "#ffcc00",
    fontWeight: "700",
    fontSize: 12,
    letterSpacing: 1,
  },
  subtitle: {
    color: "#eee",
    fontSize: 11,
    marginTop: 2,
  },
  hint: {
    color: "#aaa",
    fontSize: 10,
    marginTop: 2,
  },
});
