// Real welcome screen lives in commit 2; this stub keeps the route
// registered so the OnboardingGate can navigate to it without error.
import { ActivityIndicator, View } from "react-native";

export default function WelcomeScreen() {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <ActivityIndicator size="large" />
    </View>
  );
}
