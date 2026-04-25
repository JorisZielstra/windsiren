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
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="spots/[slug]" options={{ title: "" }} />
          <Stack.Screen name="sign-in" options={{ title: "Sign in" }} />
          <Stack.Screen name="sign-up" options={{ title: "Create account" }} />
          <Stack.Screen name="profile-edit" options={{ title: "Edit profile" }} />
          <Stack.Screen name="users/[userId]" options={{ title: "" }} />
          <Stack.Screen name="sessions/[id]" options={{ title: "" }} />
        </Stack>
        <StatusBar style="auto" />
      </SafeAreaProvider>
    </AuthProvider>
  );
}
