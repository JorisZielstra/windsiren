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
import { dbRowToSpot, fetchTodayVerdict, type SpotWithVerdict } from "@windsiren/core";
import type { Verdict } from "@windsiren/shared";
import { supabase } from "../../lib/supabase";

const COLORS = {
  go: "#10b981",
  marginal: "#f59e0b",
  no_go: "#71717a",
  unknown: "#d4d4d8",
} as const;

function pinColorFor(decision: Verdict["decision"] | undefined): string {
  if (!decision) return COLORS.unknown;
  return COLORS[decision];
}

export default function MapScreen() {
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
      const results = await Promise.all(spots.map(fetchTodayVerdict));
      if (!cancelled) setItems(results);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
