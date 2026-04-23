import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: "#fff" },
          headerTitleStyle: { fontWeight: "600" },
        }}
      >
        <Stack.Screen name="index" options={{ title: "WindSiren" }} />
        <Stack.Screen name="spots/[slug]" options={{ title: "" }} />
      </Stack>
      <StatusBar style="auto" />
    </SafeAreaProvider>
  );
}
