import { router, Stack } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  DEFAULT_USER_PREFS,
  getUserPrefs,
  updateUserPrefs,
  type UserKitePrefs,
} from "@windsiren/core";
import { useAuth } from "../lib/auth-context";
import { supabase } from "../lib/supabase";

// Mobile twin of /profile/preferences. Lets the user tweak the four
// kite thresholds and saves to users row. Verdicts on the dashboard +
// spot pages re-resolve against these on the next focus.
export default function ProfilePrefsScreen() {
  const { user } = useAuth();
  const [loaded, setLoaded] = useState<UserKitePrefs | null>(null);
  const [minWind, setMinWind] = useState<string>("");
  const [maxGust, setMaxGust] = useState<string>("");
  const [minAir, setMinAir] = useState<string>("");
  const [minWater, setMinWater] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    if (!user) {
      router.replace("/sign-in");
      return;
    }
    let cancelled = false;
    (async () => {
      const prefs = await getUserPrefs(supabase, user.id);
      if (cancelled) return;
      setLoaded(prefs);
      setMinWind(String(prefs.minWindKn));
      setMaxGust(prefs.maxGustKn !== null ? String(prefs.maxGustKn) : "");
      setMinAir(prefs.minAirTempC !== null ? String(prefs.minAirTempC) : "");
      setMinWater(
        prefs.minWaterTempC !== null ? String(prefs.minWaterTempC) : "",
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  async function save() {
    if (!user) return;
    setBusy(true);
    setError(null);
    setSavedAt(null);
    const result = await updateUserPrefs(supabase, user.id, {
      minWindKn: parseOrDefault(minWind, DEFAULT_USER_PREFS.minWindKn),
      maxGustKn: parseOrNull(maxGust),
      minAirTempC: parseOrNull(minAir),
      minWaterTempC: parseOrNull(minWater),
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setSavedAt(Date.now());
  }

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <Stack.Screen options={{ title: "Kite preferences" }} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.intro}>
            Tune what counts as a GO day for you. Every spot's verdict and the
            dashboard score read from these numbers.
          </Text>

          {!loaded ? (
            <ActivityIndicator style={{ marginTop: 32 }} />
          ) : (
            <>
              <Field
                label="Minimum wind"
                hint="Days that don't reach this wind speed are NO GO. Defaults to 15 kn if blank."
                unit="kn"
                value={minWind}
                onChangeText={setMinWind}
                placeholder="15"
              />
              <Field
                label="Maximum gust"
                hint="Optional ceiling. Leave blank to ignore gust."
                unit="kn"
                value={maxGust}
                onChangeText={setMaxGust}
                placeholder="Optional"
              />
              <Field
                label="Minimum air temp"
                hint="Optional. Below this, day is NO GO."
                unit="°C"
                value={minAir}
                onChangeText={setMinAir}
                placeholder="Optional"
              />
              <Field
                label="Minimum water temp"
                hint="Optional. Pulled from spot tide / sea data."
                unit="°C"
                value={minWater}
                onChangeText={setMinWater}
                placeholder="Optional"
              />

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <Pressable
                onPress={save}
                disabled={busy}
                style={({ pressed }) => [
                  styles.saveBtn,
                  busy && { opacity: 0.5 },
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Text style={styles.saveBtnText}>
                  {busy ? "Saving…" : "Save preferences"}
                </Text>
              </Pressable>
              {savedAt ? (
                <Text style={styles.savedNote}>Saved · verdicts updated</Text>
              ) : null}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({
  label,
  hint,
  unit,
  value,
  onChangeText,
  placeholder,
}: {
  label: string;
  hint: string;
  unit: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.fieldRow}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#a1a1aa"
          keyboardType="number-pad"
          style={styles.input}
        />
        <Text style={styles.fieldUnit}>{unit}</Text>
      </View>
      <Text style={styles.fieldHint}>{hint}</Text>
    </View>
  );
}

function parseOrDefault(raw: string, fallback: number): number {
  const trimmed = raw.trim();
  if (trimmed === "") return fallback;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : fallback;
}

function parseOrNull(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  scroll: { padding: 20, paddingBottom: 40 },
  intro: { fontSize: 13, color: "#3f3f46", marginBottom: 20 },
  field: { marginBottom: 18 },
  fieldLabel: { fontSize: 13, fontWeight: "600", color: "#18181b" },
  fieldRow: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  input: {
    width: 110,
    borderColor: "#d4d4d8",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 15,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    color: "#18181b",
  },
  fieldUnit: { fontSize: 13, color: "#71717a" },
  fieldHint: { marginTop: 4, fontSize: 11, color: "#71717a" },
  error: {
    backgroundColor: "#fef2f2",
    color: "#7f1d1d",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    fontSize: 13,
    marginBottom: 16,
  },
  saveBtn: {
    backgroundColor: "#059669",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 8,
  },
  saveBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  savedNote: {
    marginTop: 10,
    fontSize: 12,
    color: "#047857",
    textAlign: "center",
  },
});
