import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "../lib/auth-context";

export default function RootLayout() {
  return (
    <AuthProvider>
      <SafeAreaProvider>
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: "#fff" },
            headerTitleStyle: { fontWeight: "600" },
          }}
        >
          <Stack.Screen name="index" options={{ title: "WindSiren" }} />
          <Stack.Screen name="spots/[slug]" options={{ title: "" }} />
          <Stack.Screen name="map" options={{ title: "Map" }} />
          <Stack.Screen name="sign-in" options={{ title: "Sign in" }} />
          <Stack.Screen name="sign-up" options={{ title: "Create account" }} />
          <Stack.Screen name="profile" options={{ title: "Account" }} />
        </Stack>
        <StatusBar style="auto" />
      </SafeAreaProvider>
    </AuthProvider>
  );
}
