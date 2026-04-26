import * as ImagePicker from "expo-image-picker";
import { router, Stack } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { updateOwnProfile, uploadAvatar } from "@windsiren/core";
import { useAuth } from "../lib/auth-context";
import { supabase } from "../lib/supabase";

export default function ProfileEditScreen() {
  const { user, loading } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [pendingAsset, setPendingAsset] =
    useState<ImagePicker.ImagePickerAsset | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      .select("display_name, bio, avatar_url")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) {
          setDisplayName(data?.display_name ?? "");
          setBio(data?.bio ?? "");
          setAvatarUrl(data?.avatar_url ?? null);
          setLoadingProfile(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  async function pickAvatar() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError("Photo library access denied");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.9,
    });
    if (!result.canceled && result.assets[0]) {
      setPendingAsset(result.assets[0]);
      setError(null);
    }
  }

  async function onSave() {
    if (!user || busy) return;
    setBusy(true);
    setError(null);

    if (pendingAsset) {
      try {
        const response = await fetch(pendingAsset.uri);
        const blob = await response.blob();
        const ext = (
          pendingAsset.fileName?.split(".").pop() ??
          pendingAsset.uri.split(".").pop() ??
          "jpg"
        ).toLowerCase();
        const upload = await uploadAvatar(supabase, user.id, blob, {
          ext,
          contentType:
            pendingAsset.mimeType ?? `image/${ext === "jpg" ? "jpeg" : ext}`,
        });
        if (!upload.ok) {
          setBusy(false);
          setError(`Avatar upload failed: ${upload.message}`);
          return;
        }
        setAvatarUrl(upload.url);
        setPendingAsset(null);
      } catch (e) {
        setBusy(false);
        setError(`Avatar upload failed: ${(e as Error).message}`);
        return;
      }
    }

    const result = await updateOwnProfile(supabase, user.id, { displayName, bio });
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    router.back();
  }

  if (loading || !user || loadingProfile) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator style={styles.loader} size="large" />
      </SafeAreaView>
    );
  }

  const previewUri = pendingAsset?.uri ?? avatarUrl ?? null;
  const initial = (displayName || "?").charAt(0).toUpperCase();

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <Stack.Screen options={{ title: "Edit profile" }} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.form}
      >
        <View style={styles.avatarRow}>
          <View style={styles.avatarCircle}>
            {previewUri ? (
              <Image source={{ uri: previewUri }} style={styles.avatarImg} />
            ) : (
              <Text style={styles.avatarInitial}>{initial}</Text>
            )}
          </View>
          <View style={styles.avatarMeta}>
            <Text style={styles.label}>Profile photo</Text>
            <Pressable style={styles.btnSecondary} onPress={pickAvatar}>
              <Text style={styles.btnSecondaryText}>
                {pendingAsset ? "Change again" : "Choose photo"}
              </Text>
            </Pressable>
            {pendingAsset ? (
              <Text style={styles.hint}>Uploads on Save.</Text>
            ) : null}
          </View>
        </View>

        <Text style={[styles.label, { marginTop: 24 }]}>Display name</Text>
        <TextInput
          style={styles.input}
          value={displayName}
          onChangeText={setDisplayName}
          maxLength={60}
          placeholder="How others see you"
          placeholderTextColor="#a1a1aa"
        />

        <Text style={[styles.label, { marginTop: 20 }]}>Bio</Text>
        <TextInput
          style={[styles.input, { height: 100, textAlignVertical: "top" }]}
          value={bio}
          onChangeText={setBio}
          maxLength={240}
          multiline
          placeholder="A line or two about your kiting — optional"
          placeholderTextColor="#a1a1aa"
        />
        <Text style={styles.hint}>{bio.length}/240</Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.actions}>
          <Pressable style={[styles.btnPrimary, busy && { opacity: 0.5 }]} onPress={onSave} disabled={busy}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnPrimaryText}>Save</Text>}
          </Pressable>
          <Pressable style={styles.btnText} onPress={() => router.back()}>
            <Text style={styles.btnTextLabel}>Cancel</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  form: { padding: 24 },
  loader: { flex: 1, marginTop: 48 },
  label: { fontSize: 13, fontWeight: "500", color: "#374151", marginBottom: 6 },
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
  actions: { flexDirection: "row", alignItems: "center", gap: 16, marginTop: 24 },
  btnPrimary: { backgroundColor: "#18181b", paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8 },
  btnPrimaryText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  btnText: {},
  btnTextLabel: { fontSize: 14, color: "#6b7280" },
  avatarRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#f4f4f5",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImg: { width: 80, height: 80 },
  avatarInitial: { fontSize: 28, color: "#a1a1aa", fontWeight: "600" },
  avatarMeta: { flex: 1 },
  btnSecondary: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "#d4d4d8",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#fff",
  },
  btnSecondaryText: { fontSize: 13, color: "#18181b", fontWeight: "600" },
});
