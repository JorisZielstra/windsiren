import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StartSessionFab } from "../components/StartSessionFab";
import { AuthProvider, useAuth } from "../lib/auth-context";

export default function RootLayout() {
  return (
    <AuthProvider>
      <SafeAreaProvider>
        <OnboardingGate>
          <View style={{ flex: 1 }}>
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
              <Stack.Screen
                name="profile-prefs"
                options={{ title: "Kite preferences" }}
              />
              <Stack.Screen name="users/[userId]" options={{ title: "" }} />
              <Stack.Screen name="sessions/[id]" options={{ title: "" }} />
              <Stack.Screen name="welcome" options={{ headerShown: false }} />
              <Stack.Screen
                name="session-active"
                options={{ headerShown: false, gestureEnabled: false }}
              />
            </Stack>
            <StartSessionFab />
          </View>
        </OnboardingGate>
        <StatusBar style="auto" />
      </SafeAreaProvider>
    </AuthProvider>
  );
}

// Routes a signed-in user to /welcome until their users.onboarded_at is
// stamped, and routes them away once it is. Sign-in / sign-up screens
// stay accessible so the user can authenticate or switch accounts.
function OnboardingGate({ children }: { children: React.ReactNode }) {
  const { user, onboarded, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading || !user || onboarded === null) return;
    const top = segments[0] ?? "";
    const isAuthRoute = top === "sign-in" || top === "sign-up";
    if (isAuthRoute) return;
    const isWelcome = top === "welcome";
    if (!onboarded && !isWelcome) {
      router.replace("/welcome");
    } else if (onboarded && isWelcome) {
      router.replace("/");
    }
  }, [user, onboarded, loading, segments, router]);

  return <>{children}</>;
}
