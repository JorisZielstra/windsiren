import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../lib/auth-context";
import { supabase } from "../lib/supabase";

type ProfileRow = {
  display_name: string | null;
  profile_mode: string;
  locale: string;
  created_at: string;
};

export default function ProfileScreen() {
  const { user, loading, signOut } = useAuth();
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [fetching, setFetching] = useState(true);
  const [signingOut, setSigningOut] = useState(false);

  // Redirect if not authenticated (after initial hydration finishes).
  useEffect(() => {
    if (!loading && !user) {
      router.replace("/sign-in");
    }
  }, [loading, user]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    supabase
      .from("users")
      .select("display_name, profile_mode, locale, created_at")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) {
          setProfile(data);
          setFetching(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  async function onSignOut() {
    setSigningOut(true);
    await signOut();
    router.replace("/");
  }

  if (loading || !user || fetching) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator style={styles.loader} size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <View style={styles.body}>
        <Row label="Email" value={user.email ?? ""} mono />
        <Row label="Display name" value={profile?.display_name ?? "(not set)"} muted={!profile?.display_name} />
        <Row label="Profile mode" value={profile?.profile_mode ?? "intermediate"} capitalize />
        <Row label="Locale" value={profile?.locale ?? "nl-NL"} mono />
        <Row
          label="Member since"
          value={
            profile?.created_at
              ? new Date(profile.created_at).toLocaleDateString("en-NL", { dateStyle: "long" })
              : "—"
          }
        />

        <Pressable
          style={[styles.signOutBtn, signingOut && styles.signOutBtnDisabled]}
          onPress={onSignOut}
          disabled={signingOut}
        >
          <Text style={styles.signOutText}>
            {signingOut ? "Signing out…" : "Sign out"}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function Row({
  label,
  value,
  mono,
  muted,
  capitalize,
}: {
  label: string;
  value: string;
  mono?: boolean;
  muted?: boolean;
  capitalize?: boolean;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text
        style={[
          styles.rowValue,
          mono && styles.rowValueMono,
          muted && styles.rowValueMuted,
          capitalize && styles.rowValueCap,
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  body: { padding: 20 },
  loader: { flex: 1, marginTop: 40 },
  row: { marginBottom: 16 },
  rowLabel: { fontSize: 11, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 },
  rowValue: { fontSize: 15 },
  rowValueMono: { fontVariant: ["tabular-nums"] },
  rowValueMuted: { color: "#9ca3af" },
  rowValueCap: { textTransform: "capitalize" },
  signOutBtn: {
    marginTop: 24,
    borderWidth: 1,
    borderColor: "#d4d4d8",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  signOutBtnDisabled: { opacity: 0.6 },
  signOutText: { fontSize: 15, fontWeight: "600", color: "#18181b" },
});
