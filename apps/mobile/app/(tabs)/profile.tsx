import { Link, router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../lib/auth-context";
import { supabase } from "../../lib/supabase";

type ProfileRow = {
  display_name: string | null;
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
      .select("display_name, locale, created_at")
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
        <Row label="Locale" value={profile?.locale ?? "nl-NL"} mono />
        <Row
          label="Member since"
          value={
            profile?.created_at
              ? new Date(profile.created_at).toLocaleDateString("en-NL", { dateStyle: "long" })
              : "—"
          }
        />

        <View style={styles.actionsRow}>
          <Link href={`/users/${user.id}`} asChild>
            <Pressable style={styles.primaryBtn}>
              <Text style={styles.primaryBtnText}>View public profile</Text>
            </Pressable>
          </Link>
          <Link href="/profile-edit" asChild>
            <Pressable style={styles.secondaryBtn}>
              <Text style={styles.secondaryBtnText}>Edit profile</Text>
            </Pressable>
          </Link>
          <Link href="/profile-prefs" asChild>
            <Pressable style={styles.secondaryBtn}>
              <Text style={styles.secondaryBtnText}>Kite preferences</Text>
            </Pressable>
          </Link>
        </View>

        <Pressable
          style={[styles.signOutBtn, signingOut && styles.signOutBtnDisabled]}
          onPress={onSignOut}
          disabled={signingOut}
        >
          <Text style={styles.signOutText}>
            {signingOut ? "Signing out…" : "Sign out"}
          </Text>
        </Pressable>

        <View style={styles.attribution}>
          <Text style={styles.attributionText}>
            Weather data by{" "}
            <Text
              style={styles.attributionLink}
              onPress={() => Linking.openURL("https://open-meteo.com/")}
            >
              Open-Meteo.com
            </Text>{" "}
            (KNMI HARMONIE-AROME) · CC BY 4.0
          </Text>
        </View>
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
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#d4d4d8",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  signOutBtnDisabled: { opacity: 0.6 },
  signOutText: { fontSize: 15, fontWeight: "600", color: "#18181b" },
  attribution: { marginTop: 32, paddingHorizontal: 4 },
  attributionText: {
    fontSize: 11,
    color: "#a1a1aa",
    textAlign: "center",
    lineHeight: 16,
  },
  attributionLink: { color: "#71717a", textDecorationLine: "underline" },
  actionsRow: { flexDirection: "row", gap: 10, marginTop: 24, flexWrap: "wrap" },
  primaryBtn: { backgroundColor: "#18181b", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  primaryBtnText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  secondaryBtn: { borderWidth: 1, borderColor: "#d4d4d8", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  secondaryBtnText: { color: "#18181b", fontSize: 14, fontWeight: "600" },
});
