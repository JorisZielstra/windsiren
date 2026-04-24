import { Link, router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../lib/auth-context";

export default function SignUpScreen() {
  const { signUp } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);

  async function onSubmit() {
    setError(null);
    setBusy(true);
    const result = await signUp(email.trim(), password);
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    if (result.needsConfirmation) {
      setNeedsConfirmation(true);
    } else {
      router.replace("/profile");
    }
  }

  if (needsConfirmation) {
    return (
      <SafeAreaView style={styles.container} edges={["bottom"]}>
        <View style={styles.form}>
          <Text style={styles.title}>Check your email</Text>
          <Text style={styles.body}>
            We sent a confirmation link to{" "}
            <Text style={styles.bodyStrong}>{email}</Text>. Open it on your
            phone to finish setting up your account, then come back and sign in.
          </Text>
          <Link href="/sign-in" replace asChild>
            <Pressable style={styles.btnSecondary}>
              <Text style={styles.btnSecondaryText}>Back to sign in</Text>
            </Pressable>
          </Link>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.form}
      >
        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          autoCorrect={false}
          placeholder="you@example.com"
          placeholderTextColor="#a1a1aa"
        />

        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="new-password"
          placeholder="••••••••"
          placeholderTextColor="#a1a1aa"
        />
        <Text style={styles.hint}>At least 6 characters.</Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable style={[styles.btn, busy && styles.btnDisabled]} onPress={onSubmit} disabled={busy}>
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnText}>Create account</Text>
          )}
        </Pressable>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <Link href="/sign-in" replace>
            <Text style={styles.footerLink}>Sign in</Text>
          </Link>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  form: { paddingHorizontal: 24, paddingTop: 24 },
  title: { fontSize: 22, fontWeight: "700", marginBottom: 12 },
  body: { fontSize: 14, color: "#4b5563", lineHeight: 20 },
  bodyStrong: { fontWeight: "700", color: "#111827" },
  label: { fontSize: 13, fontWeight: "500", color: "#374151", marginBottom: 6, marginTop: 16 },
  input: {
    borderWidth: 1,
    borderColor: "#d4d4d8",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  hint: { fontSize: 11, color: "#6b7280", marginTop: 4 },
  error: { color: "#b91c1c", marginTop: 12, fontSize: 13 },
  btn: {
    backgroundColor: "#18181b",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 24,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  btnSecondary: {
    borderWidth: 1,
    borderColor: "#d4d4d8",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 24,
  },
  btnSecondaryText: { color: "#18181b", fontSize: 15, fontWeight: "600" },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: 24 },
  footerText: { color: "#6b7280", fontSize: 13 },
  footerLink: { color: "#0369a1", fontSize: 13, fontWeight: "600" },
});
