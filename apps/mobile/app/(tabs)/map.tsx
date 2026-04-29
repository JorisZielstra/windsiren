import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import MapView, { Marker } from "react-native-maps";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  dbRowToSpot,
  fetchTodayVerdict,
  getUserPrefs,
  prefsToThresholds,
  type SpotWithVerdict,
} from "@windsiren/core";
import type { Verdict } from "@windsiren/shared";
import { useAuth } from "../../lib/auth-context";
import { supabase } from "../../lib/supabase";

// Pulled from lib/theme — keep the pins in sync with verdict colors used
// across the rest of the app so the map reads the same as the dashboard.
const COLORS = {
  go: "#0fb89a",
  marginal: "#d88b3d",
  no_go: "#7e8a91",
  unknown: "#a7b2b9",
} as const;

// Quiet, paper-toned Google Maps style for Android. Hides POIs/transit/
// road labels so the colored pins do the talking, and tints land/water
// to match the North Sea palette (paper-sunk land, brand-soft water).
// iOS uses Apple's built-in mapType="mutedStandard" instead — no JSON
// needed since MapKit can't accept custom JSON styles.
const ANDROID_MAP_STYLE = [
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "labels", stylers: [{ visibility: "off" }] },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#efe9d9" }, { visibility: "simplified" }],
  },
  {
    featureType: "landscape",
    elementType: "geometry",
    stylers: [{ color: "#f3eee0" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#d6e8f2" }],
  },
  { featureType: "water", elementType: "labels", stylers: [{ visibility: "off" }] },
  {
    featureType: "administrative",
    elementType: "geometry.stroke",
    stylers: [{ color: "#c9c3b5" }, { weight: 0.6 }],
  },
  {
    featureType: "administrative.locality",
    elementType: "labels.text.fill",
    stylers: [{ color: "#324a59" }],
  },
  {
    featureType: "administrative.locality",
    elementType: "labels.text.stroke",
    stylers: [{ color: "#faf8f2" }, { weight: 2 }],
  },
];

function pinColorFor(decision: Verdict["decision"] | undefined): string {
  if (!decision) return COLORS.unknown;
  return COLORS[decision];
}

export default function MapScreen() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [items, setItems] = useState<SpotWithVerdict[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: rows, error: dbErr } = await supabase
        .from("spots")
        .select("*")
        .eq("active", true);
      if (cancelled) return;
      if (dbErr) {
        setError(dbErr.message);
        return;
      }
      const spots = (rows ?? []).map(dbRowToSpot);
      // Use the user's personalized thresholds so the map's verdict
      // colors line up with the dashboard's GO/MAYBE/NO_GO calls.
      const userPrefs = await getUserPrefs(supabase, userId);
      if (cancelled) return;
      const userThresholds = prefsToThresholds(userPrefs);
      const results = await Promise.all(
        spots.map((s) => fetchTodayVerdict(s, userThresholds)),
      );
      if (!cancelled) setItems(results);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>Failed to load: {error}</Text>
        </View>
      ) : !items ? (
        <ActivityIndicator style={styles.loader} size="large" />
      ) : (
        <MapView
          style={styles.map}
          mapType={Platform.OS === "ios" ? "mutedStandard" : "standard"}
          customMapStyle={Platform.OS === "android" ? ANDROID_MAP_STYLE : undefined}
          initialRegion={{
            latitude: 52.7,
            longitude: 4.9,
            latitudeDelta: 2.5,
            longitudeDelta: 2.5,
          }}
        >
          {items.map(({ spot, verdict }) => (
            <Marker
              key={spot.id}
              coordinate={{ latitude: spot.lat, longitude: spot.lng }}
              title={spot.name}
              description={
                verdict?.decision === "go"
                  ? "GO today"
                  : verdict?.decision === "marginal"
                    ? "Maybe today"
                    : verdict?.decision === "no_go"
                      ? "No go today"
                      : "Condition unknown"
              }
              onCalloutPress={() => router.push(`/spots/${spot.slug}`)}
              pinColor={Platform.OS === "ios" ? pinColorFor(verdict?.decision) : undefined}
            >
              {Platform.OS !== "ios" ? (
                // Android doesn't respect pinColor for custom hex values reliably.
                // Use a custom colored circle view instead.
                <View
                  style={[
                    styles.androidPin,
                    { backgroundColor: pinColorFor(verdict?.decision) },
                  ]}
                />
              ) : null}
            </Marker>
          ))}
        </MapView>
      )}
      <Pressable style={styles.backBtn} onPress={() => router.back()}>
        <Text style={styles.backBtnText}>← List</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  map: { flex: 1 },
  loader: { marginTop: 48 },
  errorBox: { margin: 16, padding: 16, backgroundColor: "#fef2f2", borderRadius: 8 },
  errorText: { color: "#991b1b" },
  backBtn: {
    position: "absolute",
    top: 10,
    left: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: 16,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 3,
  },
  backBtnText: { fontSize: 13, fontWeight: "600" },
  androidPin: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: "#fff",
  },
});
