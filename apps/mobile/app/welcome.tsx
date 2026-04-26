import * as ImagePicker from "expo-image-picker";
import { router, Stack } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  addHomeSpot,
  dbRowToSpot,
  markOnboarded,
  SUGGESTED_HOME_SPOT_MAX,
  updateOwnProfile,
  uploadAvatar,
} from "@windsiren/core";
import type { Spot } from "@windsiren/shared";
import { useAuth } from "../lib/auth-context";
import { supabase } from "../lib/supabase";

export default function WelcomeScreen() {
  const { user, refreshOnboarded } = useAuth();

  const [spots, setSpots] = useState<Spot[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [pendingAsset, setPendingAsset] =
    useState<ImagePicker.ImagePickerAsset | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const [profileRes, spotsRes] = await Promise.all([
        supabase
          .from("users")
          .select("display_name, bio, avatar_url, email")
          .eq("id", user.id)
          .maybeSingle(),
        supabase.from("spots").select("*").eq("active", true).order("name"),
      ]);
      if (cancelled) return;
      const row = profileRes.data;
      const localPart = row?.email?.split("@")[0] ?? "";
      setDisplayName(row?.display_name?.trim() || localPart);
      setBio(row?.bio ?? "");
      setAvatarUrl(row?.avatar_url ?? null);
      setSpots((spotsRes.data ?? []).map(dbRowToSpot));
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  function toggleSpot(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

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

  async function finish(skip: boolean) {
    if (!user || busy) return;
    setBusy(true);
    setError(null);

    if (!skip) {
      // Avatar.
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
              pendingAsset.mimeType ??
              `image/${ext === "jpg" ? "jpeg" : ext}`,
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

      // Profile fields.
      const profileResult = await updateOwnProfile(supabase, user.id, {
        displayName,
        bio,
      });
      if (!profileResult.ok) {
        setBusy(false);
        setError(profileResult.message);
        return;
      }

      // Home spots — sequential to keep position ordering deterministic.
      for (const spotId of selected) {
        const r = await addHomeSpot(supabase, user.id, spotId);
        if (!r.ok) {
          setBusy(false);
          setError(`Couldn't add a home spot: ${r.message}`);
          return;
        }
      }
    }

    const stamp = await markOnboarded(supabase, user.id);
    if (!stamp.ok) {
      setBusy(false);
      setError(stamp.message);
      return;
    }

    // Bump the AuthProvider so the OnboardingGate redirects us out.
    await refreshOnboarded();
    setBusy(false);
    router.replace("/");
  }

  if (!user || !spots) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator style={styles.loader} size="large" />
      </SafeAreaView>
    );
  }

  const previewUri = pendingAsset?.uri ?? avatarUrl ?? null;
  const initial = (displayName || "?").charAt(0).toUpperCase();
  const overSuggested = selected.size > SUGGESTED_HOME_SPOT_MAX;

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Welcome to WindSiren</Text>
        <Text style={styles.intro}>
          Two things to set up — both optional, both editable later.
        </Text>

        <Text style={styles.sectionLabel}>🏠 HOME SPOTS</Text>
        <Text style={styles.sectionBody}>
          Pick the spots you actually drive to. Your dashboard score will be
          calculated only from these. Suggested 1–3.
        </Text>
        <View style={styles.spotList}>
          {spots.map((spot) => {
            const isSelected = selected.has(spot.id);
            return (
              <Pressable
                key={spot.id}
                onPress={() => toggleSpot(spot.id)}
                style={[styles.spotRow, isSelected && styles.spotRowSelected]}
              >
                <View
                  style={[
                    styles.checkbox,
                    isSelected && styles.checkboxChecked,
                  ]}
                >
                  {isSelected ? <Text style={styles.checkmark}>✓</Text> : null}
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.spotName,
                      isSelected && styles.spotNameSelected,
                    ]}
                  >
                    {spot.name}
                  </Text>
                  {spot.region ? (
                    <Text style={styles.spotRegion}>
                      {regionLabel(spot.region)}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.helperText}>
          {selected.size === 0
            ? "None selected — your score will cover all NL spots."
            : `${selected.size} selected${
                overSuggested
                  ? ` — we suggest 1–${SUGGESTED_HOME_SPOT_MAX} for a focused score.`
                  : ""
              }`}
        </Text>

        <Text style={[styles.sectionLabel, { marginTop: 32 }]}>👤 YOUR PROFILE</Text>
        <Text style={styles.sectionBody}>
          A name and photo so other kiters know who's posting.
        </Text>

        <View style={styles.avatarRow}>
          <View style={styles.avatarCircle}>
            {previewUri ? (
              <Image source={{ uri: previewUri }} style={styles.avatarImg} />
            ) : (
              <Text style={styles.avatarInitial}>{initial}</Text>
            )}
          </View>
          <View style={styles.avatarMeta}>
            <Text style={styles.label}>Profile photo (optional)</Text>
            <Pressable style={styles.btnSecondary} onPress={pickAvatar}>
              <Text style={styles.btnSecondaryText}>
                {pendingAsset ? "Change again" : "Choose photo"}
              </Text>
            </Pressable>
          </View>
        </View>

        <Text style={[styles.label, { marginTop: 20 }]}>Display name</Text>
        <TextInput
          style={styles.input}
          value={displayName}
          onChangeText={setDisplayName}
          maxLength={60}
          placeholder="How others see you"
          placeholderTextColor="#a1a1aa"
        />

        <Text style={[styles.label, { marginTop: 16 }]}>Bio (optional)</Text>
        <TextInput
          style={[styles.input, { height: 80, textAlignVertical: "top" }]}
          value={bio}
          onChangeText={setBio}
          maxLength={240}
          multiline
          placeholder="A line or two about your kiting"
          placeholderTextColor="#a1a1aa"
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.actions}>
          <Pressable
            style={[styles.btnPrimary, busy && { opacity: 0.5 }]}
            onPress={() => finish(false)}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnPrimaryText}>Get started</Text>
            )}
          </Pressable>
          <Pressable
            style={styles.btnText}
            onPress={() => finish(true)}
            disabled={busy}
          >
            <Text style={styles.btnTextLabel}>Skip for now</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function regionLabel(region: string): string {
  return (
    {
      wadden: "Wadden",
      north_holland: "North Holland",
      south_holland: "South Holland",
      zeeland: "Zeeland",
      ijsselmeer: "IJsselmeer",
    } as Record<string, string>
  )[region] ?? region;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  loader: { flex: 1, marginTop: 48 },
  scroll: { padding: 24, paddingBottom: 48 },
  title: { fontSize: 26, fontWeight: "700", color: "#18181b" },
  intro: { marginTop: 6, fontSize: 14, color: "#52525b" },
  sectionLabel: {
    marginTop: 28,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    color: "#71717a",
  },
  sectionBody: { marginTop: 6, fontSize: 13, color: "#3f3f46", lineHeight: 18 },
  spotList: { marginTop: 14, gap: 8 },
  spotRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#e4e4e7",
    borderRadius: 8,
    backgroundColor: "#fff",
  },
  spotRowSelected: {
    borderColor: "#10b981",
    backgroundColor: "#ecfdf5",
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: "#a1a1aa",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: { borderColor: "#10b981", backgroundColor: "#10b981" },
  checkmark: { color: "#fff", fontSize: 14, fontWeight: "700", lineHeight: 14 },
  spotName: { fontSize: 14, fontWeight: "500", color: "#18181b" },
  spotNameSelected: { color: "#065f46" },
  spotRegion: { fontSize: 11, color: "#71717a", marginTop: 2 },
  helperText: { marginTop: 10, fontSize: 12, color: "#71717a" },
  avatarRow: { marginTop: 14, flexDirection: "row", alignItems: "center", gap: 16 },
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
  label: { fontSize: 13, fontWeight: "500", color: "#374151", marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: "#d4d4d8",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  error: { color: "#b91c1c", marginTop: 12, fontSize: 13 },
  actions: { marginTop: 28, gap: 12, alignItems: "stretch" },
  btnPrimary: {
    backgroundColor: "#059669",
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  btnPrimaryText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  btnText: { alignItems: "center", paddingVertical: 8 },
  btnTextLabel: { fontSize: 13, color: "#71717a" },
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
